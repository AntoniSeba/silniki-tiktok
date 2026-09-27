"""Czasy słów bez Whispera: espeak-ng czyta skrypt słowo po słowie, MFCC + DTW dopasowuje syntezę do lektora.
użycie: python3 tools/align_dtw.py <skrypt-tts.txt> assets/vo-cut.mp3 assets/transcript.json
Wynik: lista {text, start, end} (tekst ze skryptu, czasy z nagrania). Na wypadek braku dostępu do modeli Whispera."""
import json, re, subprocess, sys, tempfile, os
import numpy as np, librosa

TXT, AUD, OUT = sys.argv[1:4]
SR, HOP = 16000, 320
SPOKEN = {"v6": "fał sześć", "v8": "fał osiem", "v10": "fał dziesięć"}
words = open(TXT, encoding="utf-8").read().split()
tmp = tempfile.mkdtemp()

def synth(text):
    p = os.path.join(tmp, "w.wav")
    subprocess.run(["espeak-ng", "-v", "pl", "-s", "165", "-w", p, text], check=True)
    y, _ = librosa.load(p, sr=SR)
    y, _ = librosa.effects.trim(y, top_db=35)
    return y

chunks, spans, pos = [], [], 0
for w in words:
    key = re.sub(r"[^\wąćęłńóśźż]", "", w.lower())
    y = synth(SPOKEN.get(key, key) or w)
    spans.append((pos, pos + len(y)))
    chunks.append(y); pos += len(y)
    if re.search(r"[.?!,]$", w):
        gap = np.zeros(int(SR * (0.09 if w.endswith(",") else 0.14)), dtype=np.float32)
        chunks.append(gap); pos += len(gap)
syn = np.concatenate(chunks)
real, _ = librosa.load(AUD, sr=SR)

def feats(y):
    m = librosa.feature.mfcc(y=y, sr=SR, n_mfcc=20, hop_length=HOP, n_fft=1024)
    m = np.vstack([m, librosa.feature.delta(m)])
    return (m - m.mean(1, keepdims=True)) / (m.std(1, keepdims=True) + 1e-6)

A, B = feats(syn), feats(real)
print("klatki syntezy", A.shape[1], "nagrania", B.shape[1])
_, wp = librosa.sequence.dtw(X=A, Y=B, metric="cosine", subseq=False)
wp = wp[::-1]
m = np.full(A.shape[1], -1)
for i, j in wp:
    if m[i] < 0: m[i] = j
fr = lambda s: m[min(A.shape[1] - 1, s // HOP)] * HOP / SR
out = [{"text": w, "start": round(fr(a), 3), "end": round(fr(b), 3)} for w, (a, b) in zip(words, spans)]
json.dump(out, open(OUT, "w"), ensure_ascii=False, indent=0)
print(len(out), "słów")
print(" ".join(f"{o['text']}@{o['start']:.2f}" for o in out))
