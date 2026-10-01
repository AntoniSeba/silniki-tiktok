---
name: tiktok-silnik-film
description: Produkcja pionowego TikToka (1080x1920, ok. 2,5 do 3 min) o silnikach dla kanału Antoniego, w HyperFrames z modelami 3D three.js, od lektora ElevenLabs do Studio (i MP4 tylko na polecenie). Zawiera cały standard kanału (checklista 10 punktów, smooth bez fleszy, zero pompowania zoomu i dublowanych animacji, pętla, kasyno, strefy TikToka, obietnica z bębnem, karta wyboru, karta serii, CTA YouTube, urwany koniec bez podsumowania), rytm i oś czasu, katalog komponentów wizualnych, szablon kodu, wszystkie modele 3D (Audi R5, BMW S54, 2JZ, R3 turbo, V6, V8, small block, Wankel, zawieszenie, turbo, panewka), B-roll, dźwięki i narzędzia. Używaj zawsze, gdy Antoni wrzuca plik lektora (ElevenLabs mp3) po skrypcie, prosi o film, TikToka, shorta, animację silnika, poprawki filmu, render MP4 albo pyta, jak robimy filmy. Skrypt pisze osobny skill tiktok-silnik-skrypt.
---

# TikTok o silnikach: produkcja filmu

Ten skill to kompletny sposób, w jaki robimy filmy dla Antoniego. Każda zasada wynika z jego uwag albo z wyników filmów. Nie upraszczaj, nie pomijaj komponentów: "pamiętaj o WSZYSTKICH komponentach".

Najpierw przeczytaj (zawsze, w tej kolejności):
1. `reference/01-standard-kanalu.md`: WSZYSTKIE zasady, cytaty, historia.
2. `reference/02-rytm-i-os-czasu.md`: liczby rytmu, szkielet osi czasu, pełna lista ujęć wzorcowego filmu.
3. `reference/03-komponenty-wizualne.md`: katalog elementów i gdzie są w kodzie.
Potem według potrzeby: `04-pipeline.md` (kroki techniczne), `05-modele-3d.md` (modele i API), `06-broll.md`, `07-dzwiek.md`, `08-pulapki.md`, `09-oddanie.md`.

## Zasady nie do złamania (skrót)

1. **Klatka 0 w ruchu**: silnik rozerwany i płynnie się składa, wał się kręci, kamera jedzie, nagłówek i etykiety stoją od pierwszej klatki.
2. **Smooth**: zero fleszy, trzęsienia, podskoków, backOut, stempli ze skali 1,8. Zapłon to miękki żar, nie stroboskop. Wał ze stałą prędkością cały film.
3. **Zero pompowania kamery**: w obrębie ujęcia stała odległość i fov, tylko orbita. Żadnego "zbliżenie, oddalenie, zbliżenie".
4. **Zero dublowania**: dwa kolejne ujęcia z tą samą animacją scal w jedno z ciągłą orbitą; jedna informacja pokazana raz (nagłówek nie powtarza bębna, licznika, tarczy, etykiet).
5. **Zmiana co 2 do 3 s, zasada kasyna**: różne długości i rodzaje ujęć, każde wejście na słowie lektora.
6. **Strefy TikToka**: treść w pasie y 250 do 1430, poniżej y 1000 max x 850. Nic uciętego.
7. **Pętla**: ostatnia klatka = pierwsza (zmierz), ostatnie słowa wpadają w hook.
8. **Engagement**: bęben "Na końcu:" po hooku (staje na odpowiedzi w nagrodzie), karta wyboru "A czy B?" po momencie aha, karta serii "Część N" w szczycie wartości, na końcu CTA do YouTube ("V6 rozebrany do ostatniej śruby, 8 min, link w bio") głosem i kartą.
9. **Koniec urwany, BEZ podsumowania**: po CTA 1 do 2 słowa pętli i od razu hook.
10. **Domyślnie bez napisów na środku** (od filmu V8); zaproponuj jednym zdaniem.
11. **SFX tylko po zaakceptowanej tabeli**.
12. **Render MP4 tylko na wyraźne polecenie**, zawsze `--workers 1` z izolowanej kopii. Po zmianach otwieraj Studio.
13. Nie wycinaj z nagrania nic (poza ciszą i podsumowaniem) bez pytania. Nie zakładaj kont. Nie zabijaj cudzych procesów.
14. W tekstach i plikach NIGDY półpauz ani pauz (znaki U+2014 i U+2013); grep na końcu = 0. Bez emoji. Ścieżki zawsze bezwzględne.

15. **B-roll i gęstość (2026-09-28)**: B-roll w każdym filmie (także w hooku, ok. 10 do 12 na film, z napisami ze słów lektora), NIGDY więcej niż 2 ujęcia 3D pod rząd, ujęcia 1,3 do 3 s.
16. **Hook jak w 2JZ**: cięcia co ok. 1 s (3D, B-roll, 3D), słowa hooka zapalają się na słowach lektora, kluczowe słowo duże z akcentem, silnik składa się w 0,55 s, a na 2 do 3 mocnych słowach krótki błysk, najazd i drgnięcie kamery oraz ostry zapłon. To wyjątek od zasady 2, tylko do ok. 7 s. Wzór: `filmy/puretech-debil`.
17. **Reklama z TikTok Shop**: produkt w użyciu (plansza albo B-roll) i karta koszyka ze strzałką w dół; szczegóły w `01-standard-kanalu.md`, sekcja M.

18. **Logo marki w hooku (2026-10-01)**: film o marce ma jej logo w hooku od klatki 0 (z akcentem na mocnym słowie) i w ostatniej klatce. Logo i materiały POBIERAM z internetu (Wikimedia Commons, oficjalne źródła marki), nie rysuję własnych podróbek; zapis w `broll/logos` albo `broll/`, w raporcie podaję skąd.

## Przebieg pracy

Gdy Antoni wrzuca plik lektora (np. `/Users/antoni/Downloads/ElevenLabs_..._Adam - Compelling_pvc_sp100_s50_sb80_v3.mp3`) po skrypcie, to jest polecenie "zrób film ze wszystkimi komponentami". Nie dopytuj.

1. **Skrypt**: odszukaj `skrypty/<temat>.md` (plan z notatkami, co na ekranie) i `skrypty/<temat>-tts.txt`. Jeśli ich nie ma, najpierw skill `tiktok-silnik-skrypt`.
2. **Projekt**: `bash ~/.claude/skills/tiktok-silnik-film/assets/tools/new_project.sh "<workspace>/videos" <id> <modele...>` (modele w `05-modele-3d.md`; do porównań zwykle bohater + drugi silnik).
3. **Lektor**: `cd <projekt> && bash tools/prepare_vo.sh "<plik ElevenLabs>"`; zanotuj D; sprawdź, czy nie ma podsumowania do ucięcia; wypisz `słowo@czas`.
4. **Oś czasu**: tabela ujęć na słowach według `02-rytm-i-os-czasu.md`; sprawdź reguły (dublowanie, zmiana co 2 do 3 s, "Powód N" otwierane krótkim 3D, miejsca kart).
5. **Kod**: przerób `film/main.js` i `index.html` z szablonu (film R5): `SHOTS`, `CAM` (klucze kamer), `states` (stany silników), `TOPS` (nagłówki), plansze w `index.html` + `drawBoard`, `RW`/`BURSTS`/`ANS`/`T_ANS` (bęben), `SPLIT_UI` (etykiety splitów), karty (czasy w `drawEng`), `D`, kicker "Seria silniki · część N" i pigułka "Część N" (N = poprzedni film + 1; R5 był częścią 6).
6. **Weryfikacja** (`04-pipeline.md` punkt 5): lint, Studio, surowy podgląd, zrzut KAŻDEGO ujęcia, konsola, szew pętli, grep półpauz, checklista.
7. **Oddanie** (`09-oddanie.md`): krótki raport, link do Studio, ścieżki. Bez renderu.
8. **Render** tylko po "wygeneruj mp4" / "renderuj": `assets/tools/render.sh`, wynik do `/Users/antoni/Downloads/<id>.mp4`, sprawdzenie długości, poziomu i klatek.

## Zasoby w skillu

| Ścieżka | Co to |
|---|---|
| `assets/template/` | szablon filmu (R5 kontra R6, najnowszy, po wszystkich poprawkach): `index.html`, `film/main.js`, `hyperframes.json`, `package.json`, `meta.json` |
| `assets/reference-films/` | kod wcześniejszych filmów: `v8-najlepszy` (krzyż wału, kąt 90°, B-roll ze stemplami, moneta), `v8-vs-v6` (film pochwalony przez Antoniego), `downsizing` (napisy na środku, turbo, R3, paragon, manometr), `r6-najlepszy` (S54 + V6, mains, twist), `nowy-2jz` (2JZ, licznik KM), `panewki-v2` (panewka, klin olejowy), `wankel` (jeden plik HTML) |
| `assets/models/` | modele w wersji filmowej + `vendor` (three.js); API w `reference/05-modele-3d.md` |
| `assets/broll/` | 5 sprawdzonych klipów + 3 nieużyte; opis i dobre fragmenty w `reference/06-broll.md` |
| `assets/sfx/` | 14 efektów z Mixkit + przykładowe znaczniki; zasady w `reference/07-dzwiek.md` |
| `assets/tools/` | `new_project.sh`, `prepare_vo.sh`, `cut_silence.py`, `align.py`, `make_captions.py`, `transcribe_whisper.py`, `build_sfx.py`, `render.sh`, `debug-snippets.js` |

## Gotowe filmy (dla orientacji)

W `/Users/antoni/Downloads/`: `litr-z-turbo.mp4` (downsizing, 168,6 s), `v8-najlepszy.mp4` (141,6 s), `wankel.mp4`. Projekty i skrypty w folderze sesji `.../scratch-2026-09-20-17b148/videos` i `/skrypty` (dopóki sesja istnieje). Skrypty wzorcowe są też w skillu `tiktok-silnik-skrypt/examples/`.
