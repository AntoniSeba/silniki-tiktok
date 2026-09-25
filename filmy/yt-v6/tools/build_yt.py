"""Oś czasu długiego filmu o V6, zsynchronizowana z lektorem.

Źródła:
  - skrypty/yt-v6-8min-tts.txt: tekst lektora (to, co czyta ElevenLabs)
  - assets/words.json: słowa z whispera ze znacznikami czasu (na już wyciętym audio)

Każde słowo skryptu dostaje czas przez dopasowanie sekwencji do transkrypcji. Beaty i zdarzenia
w środku zdań są przypięte do fraz skryptu. Czego nie ma w nagraniu (np. brak drugiej części),
to dostaje czas szacowany z długości zdań, żeby cały film dało się oglądać.

Wynik: yt/timeline.js, tagi <video> i <audio> w index.html, wycinki B-rolla.
"""
import difflib
import json
import os
import re
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "..", "..", "skrypty", "yt-v6-8min-tts.txt")
WORDS = os.path.join(ROOT, "assets", "words.json")
VO = os.path.join(ROOT, "assets", "vo.mp3")

# szacowane długości beatów (sekundy), używane do skalowania przesunięć w środku beatów
EST = {
    "ch1": 1.6, "a_intake": 7.5, "a_covers": 4.5, "a_headers": 3.7, "a_acc": 4.5, "a_timing": 12.0,
    "a_heads": 12.0, "a_cyl": 10.5, "a_bottom": 3.5, "a_crank": 9.0,
    "ch2": 1.6, "c_four": 4.0, "c_intake": 6.0, "c_comp": 5.5, "c_spark": 1.2, "c_power": 6.3, "c_exh": 3.7,
    "c_timing": 11.0, "c_camcrank": 6.7, "c_six": 6.3, "c_overlap": 5.5, "c_i4": 7.4, "c_loop": 9.0,
    "ch3": 1.6, "k_q": 5.5, "k_60": 14.0, "k_90": 15.0, "k_120": 15.0, "k_catch": 5.0,
    "ch4": 2.2, "p_rem": 16.0, "p_share": 8.0, "p_uneven": 9.6, "p_buick": 10.4, "p_cut": 6.3, "p_60": 5.2,
    "p_90": 4.0, "p_1977": 6.3, "p_hero": 7.0, "p_sub": 7.8,
    "ch5": 1.6, "b_mass": 12.0, "b_i3": 9.6, "b_r6": 10.4, "b_cw": 6.7, "b_shaft": 17.0, "b_ok": 6.3,
    "ch6": 1.6, "v_long": 11.0, "v_volvo": 6.7, "v_v8": 7.4, "v_mid": 13.0, "v_cta": 6.3,
    "ch7": 1.6, "f_list1": 13.0, "f_list2": 12.0, "f_idea": 8.0, "f_cut": 2.6,
}
BEAT_ORDER = list(EST.keys())

# (klucz, fraza w skrypcie, przesunięcie) — kolejność = kolejność w nagraniu
# klucz z prefiksem "@" to beat liczony od karty rozdziału: rozdział zaczyna się 0,2 s przed frazą,
# a pierwszy beat startuje po karcie
ANCHORS = [
    ("co_wale", "w wale korbowym", 0), ("co_thanks", "Dzięki niemu", 0), ("co_kombi", "w rodzinnych kombi", 0),
    ("co_nissan", "w Nissanie GT-R w Ferrari", 0), ("co_film", "W tym filmie", 0), ("co_works", "Zobaczysz jak pracuje", 0),
    ("co_60", "dlaczego ma akurat", 0), ("co_shake", "i czemu kiedyś", 0), ("co_four", "A w rozdziale czwartym", 0),
    ("map", "Siedem rozdziałów", 0), ("w_secret", "Jeden sekret", 0), ("w_start", "Zaczynamy od środka", 0),
    ("ch1", "Na samej górze", -0.3), ("w_kolektor", "kolektor dolotowy Rozdziela", 0),
    ("a_covers", "Pod nim po obu", 0), ("a_headers", "Z boków odchodzą", 0), ("a_acc", "Z przodu osprzęt", 0),
    ("a_timing", "Za pokrywą rozrządu", 0), ("w_chain", "Łańcuszek a nie pasek", 0), ("a_heads", "Zdejmujemy głowice", 0),
    ("w_valley", "Blok ma kształt", 0), ("w_compact", "Dzięki temu cały silnik", 0),
    ("a_cyl", "Teraz widać cylindry", 0), ("w_bore", "dziewięćdziesiąt cztery milimetry", 0), ("w_stroke", "osiemdziesiąt pięć milimetrów", 0),
    ("w_litres", "trzech i pół litra", 0), ("a_bottom", "Na dole miska", 0), ("w_caps", "pod nią pokrywy łożysk", 0),
    ("a_crank", "a na samym końcu", 0), ("w_remember", "Zapamiętaj go", 0),
    ("ch2", "Każdy cylinder robi", -0.2), ("w_ssie", "Ssie spręża", 0), ("w_spreza", "spręża pracuje", 0),
    ("w_pracuje", "pracuje i wydycha", 0), ("w_wydycha", "wydycha Tłok", 0),
    ("c_intake", "Tłok idzie w dół", 0), ("c_comp", "Oba zawory się zamykają", 0), ("w_ten", "dziesięć razy", 0),
    ("c_spark", "Iskra", 0), ("c_power", "Gazy rozprężają", 0), ("w_onlypower", "To jedyny moment", 0),
    ("c_exh", "Na koniec otwiera", 0), ("c_timing", "Co ciekawe zawory", 0), ("c_camcrank", "Cały ten cykl", 0),
    ("c_six", "A teraz pomnóż", 0), ("c_overlap", "Suw pracy trwa", 0), ("c_i4", "To pierwsza przewaga", 0),
    ("c_loop", "Tylko że ten równy", 0),
    ("ch3", "Dwa rzędy po trzy cylindry Tylko", -0.2), ("k_60", "Sześćdziesiąt stopni wydaje", 0),
    ("w_half", "połowa ze stu dwudziestu", 0), ("w_vq", "Tak zbudowany jest Nissan VQ", 0),
    ("k_90", "Dziewięćdziesiąt stopni to kąt", 0), ("w_cut2", "odcinając dwa cylindry", 0), ("w_brands", "Tak powstały pierwsze", 0),
    ("k_120", "I jest jeszcze sto", 0), ("w_turbo", "wkłada się tam turbosprężarki", 0), ("w_ferr", "Tak zbudowane są Ferrari", 0),
    ("w_f1rule", "W Formule Jeden przepisy", 0), ("k_catch", "Tylko że dwa z tych", 0),
    ("ch4", "Pamiętasz", -0.2), ("w_same", "Przy stu dwudziestu stopniach", 0), ("w_normal", "Dlatego Ferrari i McLaren", 0),
    ("w_stairs", "Schody zaczynają się", 0), ("p_share", "W silniku widlastym", 0), ("p_uneven", "Ale w V6 odstępy", 0),
    ("w_jerk", "Silnik szarpie", 0), ("p_buick", "I to nie jest teoria", 0), ("p_cut", "Rozwiązanie jest genialnie", 0),
    ("w_cutword", "przecina się na pół", 0), ("p_60", "W sześćdziesięciostopniowym V6 o kolejne", 0),
    ("w_e1", "Sześćdziesiąt plus sześćdziesiąt", 0), ("w_e2", "plus sześćdziesiąt wychodzi", 0), ("w_e3", "sześćdziesiąt wychodzi", 0),
    ("w_e4", "wychodzi równo", 0), ("w_e5", "równo sto dwadzieścia", 0.35),
    ("p_90", "W dziewięćdziesięciostopniowym o trzydzieści", 0), ("w_f1", "dziewięćdziesiąt plus trzydzieści", 0),
    ("w_f2", "plus trzydzieści też", 0), ("w_f3", "trzydzieści też daje", 0), ("w_f4", "daje sto dwadzieścia", 0),
    ("w_f5", "sto dwadzieścia Buick", 0), ("p_1977", "Buick w siedemdziesiątym", 0), ("p_hero", "Jeden detal", 0),
    ("p_sub", "Jeśli słyszysz", 0), ("w_subv8", "rozbieramy V8", 0),
    ("ch5", "Równy zapłon to jedno", -0.2), ("w_hundred", "sto razy na sekundę", 0), ("b_i3", "Każdy rząd V6", 0),
    ("w_swing", "kołysze się z przodu", 0), ("w_moment", "Inżynierowie nazywają to", 0),
    ("b_r6", "Rzędowa szóstka tego problemu", 0), ("w_bmw", "Dlatego BMW", 0),
    ("b_cw", "W V6 większość tego", 0), ("b_shaft", "W dziewięćdziesięciostopniowym zostaje więcej", 0),
    ("w_merc", "Tak robi na przykład Mercedes", 0), ("w_mocy", "trochę mocy", 0), ("w_miejsca", "trochę miejsca", 0),
    ("w_pieniedzy", "trochę pieniędzy", 0), ("w_coin", "kierowca dostaje silnik", 0), ("b_ok", "Czyli V6 nie jest", 0),
    ("w_notfeel", "Ale jest wyważony na tyle", 0),
    ("ch6", "To dlaczego nie wszyscy", -0.2), ("w_long", "Bo jest długa", 0), ("v_volvo", "Volvo próbowało", 0),
    ("w_volvomove", "musiało przenieść cały osprzęt", 0), ("v_v8", "A V8 Daje", 0), ("w_v8moc", "Daje więcej mocy", 0),
    ("w_tarcia", "więcej tarcia", 0), ("w_masy", "więcej masy", 0), ("w_spalanie", "większe spalanie", 0),
    ("v_mid", "V6 siedzi dokładnie", 0), ("w_nowin", "Nie wygrywa w żadnej", 0), ("v_cta", "I to jest dobre pytanie", 0),
    ("ch7", "I dlatego V6 jest wszędzie", -0.2), ("w_audi", "W Audi A6", 0), ("w_toyota", "W Toyocie", 0),
    ("w_vqw", "Nissan VQ przez", 0), ("f_list2", "W Nissanie GT-R z dwiema", 0), ("w_ferrari", "W Ferrari i McLarenie", 0),
    ("w_f1all", "I w każdym bolidzie", 0), ("f_idea", "Od rodzinnego kombi po najszybsze", 0),
    ("w_idea2", "Dwa rzędy po trzy cylindry na jednym", 0), ("f_cut", "I od jednego cięcia", 0),
]
# beat pierwszy po karcie rozdziału
CARD = {"ch1": ("a_intake", 1.6), "ch2": ("c_four", 1.6), "ch3": ("k_q", 1.6), "ch4": ("p_rem", 2.2),
        "ch5": ("b_mass", 1.6), "ch6": ("v_long", 1.6), "ch7": ("f_list1", 1.6)}

# szacunki dla pierwszej minuty, gdyby nie było nagrania
CO_EST = {"co_thanks": 1.9, "co_wale": 0.9, "co_kombi": 3.4, "co_nissan": 4.6, "co_film": 7.5, "co_works": 9.4, "co_60": 10.4,
          "co_shake": 12.1, "co_four": 13.6, "map": 17.2, "w_secret": 18.1, "w_start": 18.9}


def norm(w):
    w = w.lower()
    w = re.sub(r"[^0-9a-ząćęłńóśźż]", "", w)
    return w


def tokens(text):
    return [norm(w) for w in re.findall(r"[0-9A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż'\-]+", text) if norm(w)]


script = tokens(open(SCRIPT).read())
times = [None] * len(script)
ends = [None] * len(script)
vo_dur = 0.0
if os.path.exists(WORDS) and os.path.exists(VO):
    words = json.load(open(WORDS))
    wn = [norm(w["text"]) for w in words]
    sm = difflib.SequenceMatcher(None, script, wn, autojunk=False)
    exact = 0
    for tag, a0, a1, b0, b1 in sm.get_opcodes():
        if tag == "equal":
            for k in range(a1 - a0):
                times[a0 + k] = words[b0 + k]["start"]
                ends[a0 + k] = words[b0 + k]["end"]
            exact += a1 - a0
        elif tag == "replace":
            # liczby i przekręcenia (skrypt "sześćdziesiąt", whisper "60"): czas dzielony w obrębie tego,
            # co whisper usłyszał w tym miejscu, o ile tempo wychodzi ludzkie
            s0, s1 = words[b0]["start"], words[b1 - 1]["end"]
            n = a1 - a0
            if 0.08 <= (s1 - s0) / n <= 1.2:
                for k in range(n):
                    times[a0 + k] = s0 + (s1 - s0) * k / n
                    ends[a0 + k] = s0 + (s1 - s0) * (k + 1) / n
    matched = [i for i, t in enumerate(times) if t is not None]
    # luki w środku interpolujemy liniowo po indeksie słowa
    for i0, i1 in zip(matched, matched[1:]):
        for k in range(i0 + 1, i1):
            times[k] = times[i0] + (times[i1] - times[i0]) * (k - i0) / (i1 - i0)
    vo_dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", VO]).decode())
    last_matched = matched[-1] if matched else -1
    print(f"dopasowane słowa: {exact} dokładnie + {len(matched) - exact} z zamian/{len(script)}, nagranie {vo_dur:.1f} s, ostatnie dopasowane słowo: #{last_matched} '{script[last_matched] if matched else ''}'")
else:
    last_matched = -1
    print("brak nagrania: czasy szacowane")

T = {}
pos = 0
missing = []
for key, phrase, off in ANCHORS:
    ph = tokens(phrase)
    idx = None
    for i in range(pos, len(script) - len(ph) + 1):
        if script[i:i + len(ph)] == ph:
            idx = i
            break
    if idx is None:
        raise SystemExit(f"fraza nie znaleziona w skrypcie: {key} '{phrase}'")
    pos = idx + 1
    t = times[idx] if (times[idx] is not None and idx <= last_matched) else None
    if t is None:
        missing.append(key)
        T[key] = None
    else:
        T[key] = round(t + off, 3)

# pierwsza minuta bez nagrania: szacunki
for k, v in CO_EST.items():
    if T.get(k) is None:
        T[k] = v
if T.get("ch1") is None:
    T["ch1"] = 22.0

# beaty po kartach rozdziałów
for ch, (beat, dur) in CARD.items():
    if T.get(ch) is not None:
        T[beat] = round(T[ch] + dur, 3)
        if beat == "a_intake" and T.get("w_kolektor") is not None:
            T[beat] = round(max(T[beat], T["w_kolektor"] - 0.3), 3)

# brakujące beaty: od ostatniego znanego z szacowaną długością
prev = None
for b in BEAT_ORDER:
    if T.get(b) is None:
        T[b] = round(T[prev] + EST[prev], 3)
    prev = b
# brakujące słowa w środku beatów: pozycja proporcjonalna w beacie
SUB_EST = {  # słowo: (beat, szacowane przesunięcie)
    "w_kolektor": ("a_intake", 0.0), "w_chain": ("a_timing", 6.5), "w_valley": ("a_heads", 4.0), "w_compact": ("a_heads", 9.2),
    "w_bore": ("a_cyl", 1.4), "w_stroke": ("a_cyl", 3.8), "w_litres": ("a_cyl", 6.4), "w_caps": ("a_bottom", 1.6), "w_remember": ("a_crank", 5.5),
    "w_ssie": ("c_four", 0.2), "w_spreza": ("c_four", 0.7), "w_pracuje": ("c_four", 1.2), "w_wydycha": ("c_four", 1.8),
    "w_ten": ("c_comp", 2.2), "w_onlypower": ("c_power", 2.5),
    "w_half": ("k_60", 2.8), "w_vq": ("k_60", 10.0), "w_cut2": ("k_90", 4.6), "w_brands": ("k_90", 8.0), "w_turbo": ("k_120", 3.0),
    "w_ferr": ("k_120", 8.0), "w_f1rule": ("k_120", 11.5),
    "w_same": ("p_rem", 1.0), "w_normal": ("p_rem", 5.5), "w_stairs": ("p_rem", 10.5), "w_jerk": ("p_uneven", 3.5),
    "w_cutword": ("p_cut", 2.6), "w_e1": ("p_60", 0.2), "w_e2": ("p_60", 1.1), "w_e3": ("p_60", 1.6), "w_e4": ("p_60", 2.6), "w_e5": ("p_60", 3.2),
    "w_f1": ("p_90", 0.2), "w_f2": ("p_90", 0.9), "w_f3": ("p_90", 1.3), "w_f4": ("p_90", 2.2), "w_f5": ("p_90", 2.7), "w_subv8": ("p_sub", 3.5),
    "w_hundred": ("b_mass", 5.8), "w_swing": ("b_i3", 4.0), "w_moment": ("b_i3", 6.5), "w_bmw": ("b_r6", 7.0),
    "w_merc": ("b_shaft", 3.4), "w_mocy": ("b_shaft", 7.2), "w_miejsca": ("b_shaft", 8.2), "w_pieniedzy": ("b_shaft", 9.2),
    "w_coin": ("b_shaft", 11.0), "w_notfeel": ("b_ok", 2.5),
    "w_long": ("v_long", 3.0), "w_volvomove": ("v_volvo", 1.2), "w_v8moc": ("v_v8", 1.0), "w_tarcia": ("v_v8", 2.6),
    "w_masy": ("v_v8", 3.4), "w_spalanie": ("v_v8", 4.3), "w_nowin": ("v_mid", 8.6),
    "w_audi": ("f_list1", 1.2), "w_toyota": ("f_list1", 4.2), "w_vqw": ("f_list1", 7.2), "w_ferrari": ("f_list2", 4.0),
    "w_f1all": ("f_list2", 8.0), "w_idea2": ("f_idea", 3.5),
}
D = {}
for i, b in enumerate(BEAT_ORDER):
    nx = T[BEAT_ORDER[i + 1]] if i + 1 < len(BEAT_ORDER) else None
    D[b] = round((nx - T[b]) if nx is not None else EST[b], 3)
for k, (beat, off) in SUB_EST.items():
    if T.get(k) is None:
        T[k] = round(T[beat] + off * D[beat] / EST[beat], 3)

last_end = max((e for e in ends if e is not None), default=0.0)
T["vo_end"] = round(vo_dur, 3)
T["end"] = round(max(T["f_cut"] + EST["f_cut"], (vo_dur + 0.35) if last_matched >= len(script) - 3 else 0), 3)
D["f_cut"] = round(T["end"] - T["f_cut"], 3)

# przebitki: (kotwica, przesunięcie, długość albo "until:klucz", plik, start w pliku, pozycja ramki, nadpis, tytuł)
BR = [
    ("co_kombi", 0.0, "until:co_nissan", "4-altuniverse.ai", 1.0, "r", "Na drodze", "Rodzinne kombi"),
    ("co_works", 0.0, "until:co_60", "5-aimechanicvibes", 4.6, "r", "W cylindrze", "Zapłon"),
    ("a_acc", 1.4, 1.2, "2-speedkar9", 2.2, "r", "Prawdziwy silnik", "Osprzęt"),
    ("a_timing", 1.2, 1.3, "2-speedkar9", 34.6, "c", "Prawdziwy silnik", "Rozrząd"),
    ("a_heads", 1.6, 1.2, "2-speedkar9", 12.0, "r", "Prawdziwy silnik", "Głowice"),
    ("a_crank", 1.6, 1.2, "2-speedkar9", 42.0, "r", "Prawdziwy silnik", "Wał korbowy"),
    ("c_spark", 0.0, "until:c_power", "5-aimechanicvibes", 5.1, "r", "W cylindrze", "Iskra"),
    ("k_q", 0.0, 1.4, "2-speedkar9", 3.0, "c", "Prawdziwa V6", "Dwa rzędy"),
    ("w_spalanie", 0.0, 1.3, "1-filipzabielski65", 0.3, "r", "Koszt", "Większe spalanie"),
    ("w_audi", 0.0, 1.8, "4-altuniverse.ai", 4.0, "r", "Na drodze", "Audi A6 Avant"),
]


def scaled(key, off):
    if key in D and key in EST and EST[key] > 0:
        return T[key] + off * D[key] / EST[key]
    return T[key] + off


bri = []
for key, off, dur, src, ms, pos, kick, title in BR:
    t0 = round(scaled(key, off), 3)
    t1 = round(T[dur[6:]] if isinstance(dur, str) else t0 + dur, 3)
    t1 = max(t1, t0 + 0.6)
    bri.append({"t0": t0, "t1": t1, "src": src, "ms": ms, "pos": pos, "kick": kick, "title": title})

os.makedirs(os.path.join(ROOT, "yt"), exist_ok=True)
with open(os.path.join(ROOT, "yt", "timeline.js"), "w") as f:
    f.write("// wygenerowane przez tools/build_yt.py, nie edytować ręcznie\n")
    f.write("export const T = " + json.dumps(T, indent=1) + ";\n")
    f.write("export const EST = " + json.dumps(EST) + ";\n")
    f.write("export const D = " + json.dumps(D) + ";\n")
    f.write("export const BRI = " + json.dumps(bri, indent=1, ensure_ascii=False) + ";\n")

cut_dir = os.path.join(ROOT, "assets", "broll", "cut")
os.makedirs(cut_dir, exist_ok=True)
for old in os.listdir(cut_dir):
    os.remove(os.path.join(cut_dir, old))
for i, b in enumerate(bri):
    subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-ss", str(b["ms"]),
                    "-i", os.path.join(ROOT, "assets", "broll", b["src"] + ".mp4"), "-t", str(round(b["t1"] - b["t0"] + 0.2, 2)),
                    "-an", "-c:v", "libx264", "-crf", "20", "-preset", "veryfast", "-pix_fmt", "yuv420p",
                    "-movflags", "+faststart", os.path.join(cut_dir, f"i{i}.mp4")], check=True)

vids = []
for i, b in enumerate(bri):
    d = round(b["t1"] - b["t0"], 3)
    vids.append(f'      <video id="bb{i}" class="bgv" src="assets/broll/cut/i{i}.mp4" data-start="{b["t0"]}" data-duration="{d}" data-media-start="0" data-track-index="20" muted playsinline></video>')
    vids.append(f'      <video id="bf{i}" class="fgv {b["pos"]}" src="assets/broll/cut/i{i}.mp4" data-start="{b["t0"]}" data-duration="{d}" data-media-start="0" data-track-index="21" muted playsinline></video>')
if vo_dur > 0:
    vids.append(f'      <audio id="vo" src="assets/vo.mp3" data-start="0" data-duration="{round(vo_dur, 3)}" data-track-index="30"></audio>')

html_path = os.path.join(ROOT, "index.html")
html = open(html_path).read()
html = re.sub(r'\s+data-hf-id="[^"]*"', "", html)
html = re.sub(r"<!--BRI-START-->.*?<!--BRI-END-->", "<!--BRI-START-->\n" + "\n".join(vids) + "\n      <!--BRI-END-->", html, flags=re.S)
html = re.sub(r'data-duration="[0-9.]+" data-width="1920"', f'data-duration="{T["end"]}" data-width="1920"', html)
open(html_path, "w").write(html)

print(f"brak w nagraniu: {len(missing)} kotwic" + (f" (od '{missing[0]}')" if missing else ""))
print(f"przebitek: {len(bri)}, koniec filmu: {T['end']:.1f} s ({int(T['end'] // 60)}:{int(T['end'] % 60):02d})")
