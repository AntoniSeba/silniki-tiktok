"""Wymuszone dopasowanie tekstu skryptu do lektora bez modelu rozpoznawania mowy.

Używamy, gdy whisper nie jest dostępny (brak sieci do modeli), a tekst znamy słowo w słowo.
1. Fragmenty mowy z assets/silence-map.json (każda wycięta cisza to twarda granica); ciche
   fragmenty (oddech, szum, szczyt poniżej -30 dB) odrzucamy.
2. Każde słowo syntezujemy po polsku (espeak-ng "pl" i MBROLA "mb-pl1") do przypisania słów do fragmentów.
3. Programowanie dynamiczne przypisuje słowa do fragmentów (długość fragmentu kontra suma
   przewidywanych długości, granice najchętniej na interpunkcji).
4. W każdym fragmencie DTW między syntezą (sklejone słowa, znane granice) a nagraniem, na cechach
   MFCC + energia + udział wysokich częstotliwości (sz, cz, s) + dźwięczność.
5. Wynik: wariant frazowy (espeak, cała fraza, czasy słów ze zdarzeń syntezatora); MBROLA ze sklejonych
   słów liczymy kontrolnie, rozjazdy powyżej 70 ms trafiają do transcript.align-debug.json.

użycie: python3 tools/force_align.py skrypt-tts.txt assets/vo-cut.mp3 assets/silence-map.json assets/transcript.json film/words.js
"""
import json, math, os, subprocess, sys, tempfile
import numpy as np
import librosa
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from espeak_words import synth as synth_phrase

TXT, AUDIO, SMAP, OUT_JSON, OUT_JS = sys.argv[1:6]
SR, HOP = 16000, 160
PUNCT = ".,?!:;"
VOICES = [("pl", "165"), ("mb-pl1", "150")]

words = open(TXT, encoding="utf-8").read().split()
W = len(words)
tmp = tempfile.mkdtemp()
audio, _ = librosa.load(AUDIO, sr=SR)


def synth(text, voice, rate, path):
    subprocess.run(["espeak-ng", "-v", voice, "-s", rate, "-w", path, text], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    y, _ = librosa.load(path, sr=SR)
    yt, _ = librosa.effects.trim(y, top_db=35)
    return yt if len(yt) else y


def feats(y):
    m = librosa.feature.mfcc(y=y, sr=SR, n_mfcc=13, hop_length=HOP, n_fft=512)[1:]
    S = np.abs(librosa.stft(y, n_fft=512, hop_length=HOP)) ** 2
    fr = librosa.fft_frequencies(sr=SR, n_fft=512)
    hi = S[fr > 3500].sum(0) + 1e-9
    lo = S[(fr > 150) & (fr < 1500)].sum(0) + 1e-9
    en = np.log(S.sum(0) + 1e-9)
    ratio = np.log(hi / lo)
    zc = librosa.feature.zero_crossing_rate(y, frame_length=512, hop_length=HOP)[0]
    n = min(m.shape[1], len(en), len(ratio), len(zc))
    f = np.vstack([m[:, :n], librosa.feature.delta(m)[:, :n], en[None, :n], ratio[None, :n], zc[None, :n]])
    f = (f - f.mean(axis=1, keepdims=True)) / (f.std(axis=1, keepdims=True) + 1e-6)
    wts = np.array([1.0] * 12 + [0.5] * 12 + [2.0, 2.0, 1.0])[:, None]
    return f * wts


def peak_db(a, b):
    x = audio[int(a * SR):int(b * SR)]
    r = librosa.feature.rms(y=x, frame_length=400, hop_length=HOP)[0]
    return 20 * np.log10(r.max() + 1e-9)


segs = [s["dst"] for s in json.load(open(SMAP))["segments"]]
segs = [(a, b) for a, b in segs if peak_db(a, b) > -30]
S = len(segs)
real = np.array([b - a for a, b in segs])

syn = {}
for v, rate in VOICES:
    syn[v] = []
    for i, w in enumerate(words):
        clean = w.strip(PUNCT + "\"'")
        syn[v].append(synth(clean, v, rate, os.path.join(tmp, f"{v}-{i}.wav")))


def assign_words(pred):
    k = real.sum() / pred.sum()
    INF = 1e18
    dp = np.full((S + 1, W + 1), INF)
    back = np.zeros((S + 1, W + 1), dtype=int)
    dp[0][0] = 0
    cum = np.concatenate([[0], np.cumsum(pred)])
    ends_punct = [w[-1] in PUNCT for w in words]
    for s in range(1, S + 1):
        for w in range(1, W + 1):
            best, arg = INF, -1
            for j in range(max(0, w - 45), w):
                if dp[s - 1][j] >= INF:
                    continue
                c = math.log(max(real[s - 1] - 0.06, 0.05) / ((cum[w] - cum[j]) * k)) ** 2 * 4.0
                if w < W and not ends_punct[w - 1]:
                    c += 2.5
                v = dp[s - 1][j] + c
                if v < best:
                    best, arg = v, j
            dp[s][w] = best
            back[s][w] = arg
    out, w = [], W
    for s in range(S, 0, -1):
        j = back[s][w]
        out.append((s - 1, j, w))
        w = j
    return out[::-1]


def phrase_syn(j0, j1):
    y, sr, ev = synth_phrase(" ".join(words[j0:j1]), "pl", 165)
    y = librosa.resample(y, orig_sr=sr, target_sr=SR) if sr != SR else y
    st = [None] * (j1 - j0)
    for t, idx in ev:
        if st[idx] is None:
            st[idx] = int(t * SR)
    for n in range(len(st)):
        if st[n] is None:
            st[n] = st[n - 1] if n else 0
    # cisza na początku syntezy: pierwsze słowo od pierwszej próbki powyżej progu
    nz = np.flatnonzero(np.abs(y) > 0.01)
    if len(nz):
        st[0] = max(st[0], int(nz[0]))
        y = y[: int(nz[-1]) + 1]
    bounds = [(st[n], st[n + 1] if n + 1 < len(st) else len(y)) for n in range(len(st))]
    return y, bounds


def align(v, assign):
    times = [None] * W
    for s, j0, j1 in assign:
        a, b = segs[s]
        seg = audio[int(a * SR):int(b * SR)]
        _, (ta, tb) = librosa.effects.trim(seg, top_db=38)
        off = a + ta / SR
        seg = seg[ta:tb]
        if v == "phrase":
            ys, bounds = phrase_syn(j0, j1)
        else:
            parts, bounds, pos = [], [], 0
            for i in range(j0, j1):
                parts.append(syn[v][i])
                bounds.append((pos, pos + len(syn[v][i])))
                pos += len(syn[v][i])
            ys = np.concatenate(parts)
        if j1 - j0 == 1:
            times[j0] = (off, off + len(seg) / SR)
            continue
        X, Y = feats(ys), feats(seg)
        _, wp = librosa.sequence.dtw(X=X, Y=Y, metric="euclidean")
        wp = wp[::-1]
        first = {}
        for xi, yi in wp:
            first.setdefault(xi, yi)
        nx = X.shape[1]

        def to_real(sample):
            fi = min(nx - 1, int(round(sample / HOP)))
            return off + first[fi] * HOP / SR

        for n, i in enumerate(range(j0, j1)):
            times[i] = [to_real(bounds[n][0]), to_real(bounds[n][1])]
        times[j0][0] = off
        times[j1 - 1][1] = off + len(seg) / SR
    return times


preds = {v: np.array([len(x) / SR for x in syn[v]]) for v, _ in VOICES}
# przypisanie do fragmentów ze średnich długości obu głosów (stabilniejsze)
assign = assign_words(sum(preds.values()) / len(preds))
res = {v: align(v, assign) for v in ("phrase", "mb-pl1")}

final, flags = [], []
va, vb = "phrase", "mb-pl1"
for i in range(W):
    sa, sb = res[va][i][0], res[vb][i][0]
    # wariant frazowy (cała fraza, naturalna prozodia) wygrywał na spektrogramach; MBROLA tylko kontrolnie
    final.append(sa)
    if abs(sa - sb) > 0.07:
        flags.append((i, words[i], sa, sb))
# koniec słowa = początek następnego w tym samym fragmencie, inaczej koniec fragmentu
seg_of = {}
for s, j0, j1 in assign:
    for i in range(j0, j1):
        seg_of[i] = s
times = []
for i in range(W):
    if i + 1 < W and seg_of[i + 1] == seg_of[i]:
        e = final[i + 1]
    else:
        e = (res[va][i][1] + res[vb][i][1]) / 2
    times.append((final[i], max(e, final[i] + 0.04)))

out = [{"text": w, "start": round(s, 3), "end": round(e, 3)} for w, (s, e) in zip(words, times)]
json.dump(out, open(OUT_JSON, "w"), ensure_ascii=False, indent=0)
rows = ",\n".join(f"  [{json.dumps(w, ensure_ascii=False)}, {s:.3f}, {e:.3f}]" for w, (s, e) in zip(words, times))
open(OUT_JS, "w").write("// wygenerowane przez tools/force_align.py: słowo skryptu, start, koniec (s)\nexport const WORDS = [\n" + rows + "\n];\n")
json.dump({"assign": [[segs[s][0], segs[s][1], int(j0), int(j1)] for s, j0, j1 in assign],
           "flags": [[int(i), w, round(float(a), 3), round(float(b), 3)] for i, w, a, b in flags],
           "voices": {v: [[round(float(x[0]), 3), round(float(x[1]), 3)] for x in res[v]] for v in res}},
          open(OUT_JSON.replace(".json", ".align-debug.json"), "w"), ensure_ascii=False)
print(f"{W} słów, {S} fragmentów mowy, rozjazdów > 70 ms między głosami: {len(flags)}")
diffs = np.array([abs(res[va][i][0] - res[vb][i][0]) for i in range(W)])
print(f"rozjazd głosów: mediana {np.median(diffs)*1000:.0f} ms, p90 {np.percentile(diffs, 90)*1000:.0f} ms, max {diffs.max()*1000:.0f} ms")
for s, j0, j1 in assign:
    a, b = segs[s]
    print(f"[{a:7.2f} {b:7.2f}] " + " ".join(f"{words[i]}@{times[i][0]:.2f}" for i in range(j0, j1)))
