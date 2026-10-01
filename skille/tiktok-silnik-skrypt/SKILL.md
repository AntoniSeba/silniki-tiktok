---
name: tiktok-silnik-skrypt
description: Pisanie skryptu do pionowego TikToka o silnikach dla kanału Antoniego (lektor ElevenLabs Adam, ok. 2:30 do 2:50 po wycięciu ciszy, ok. 400 do 440 słów). Kontrowersyjny temat zaczęty jasnym stwierdzeniem, obietnica z bębnem "Na końcu", kontra i otwarta pętla, budowa silnika, ponumerowane powody, uczciwa wada z ripostą, nagroda, pytanie-wybór do komentarzy, CTA do filmu na YouTube z linkiem w bio, urwany koniec BEZ podsumowania i zdanie pętli wpadające w hook. Zawiera zasady zapisu pod TTS (liczby słownie, nazwy fonetycznie), szablon, listę zrobionych tematów, pomysły na kolejne i wzorcowe skrypty. Używaj zawsze, gdy Antoni prosi o skrypt, temat, hook, tekst do lektora albo "zrób filmik o ..." (najpierw skrypt, film robi skill tiktok-silnik-film).
---

# TikTok o silnikach: skrypt

Wynikiem są ZAWSZE dwa pliki w `<workspace>/skrypty/`:
1. `<temat>.md`: plan z nagłówkami sekcji, notatkami, co jest na ekranie w każdej sekcji (model, plansza, split, bęben, karty), liczbą słów, zasadą pętli, listą faktów do sprawdzenia.
2. `<temat>-tts.txt`: sam tekst dla lektora, akapitami, bez nagłówków i notatek, gotowy do wklejenia w ElevenLabs.

Potem w czacie: krótko, co to za temat i hook, ile słów i ile wyjdzie czasu, pełne ścieżki do obu plików, i że czekasz na plik lektora. Grep półpauz na obu plikach = 0.

## 1. Temat

- **Kontrowersyjny**, z tezą, z którą część widzów się pokłóci w komentarzach: "X jest lepsze od Y", "X to największe kłamstwo motoryzacji", "Toyota zbudowała silnik na 1000 koni, a wpisała 280".
- Pierwsze zdanie filmu = **jasne stwierdzenie** tezy (nie pytanie retoryczne, nie wstęp). Druga osoba albo zaczepka mile widziane ("A ty w nie uwierzyłeś.").
- Temat musi dać się pokazać na naszych modelach 3D (lista w skillu filmowym, `reference/05-modele-3d.md`): R5 Audi, R6 S54, 2JZ, R3 turbo, V6, V8 (wałki w głowicach), small block V8, Wankel, zawieszenie, turbo, panewka, Porsche H6 bokser.
- Seria: filmy łączą się callbackami ("Sam mówiłem, że szóstka to najlepszy silnik na świecie"; "W poprzednim odcinku pokazałem ci przecięty czop..."). Kolejny film = kolejna "Część N".

Zrobione tematy (nie powtarzaj, można robić callbacki): klin olejowy; niskie obroty "nie oszczędzasz paliwa, płacisz panewkami" (1200 obrotów); "dwójka"; V6 najlepszy silnik; V6 jedno rozwiązanie (przecięty czop); V8 kontra V6 (V8 lepsze, bo nie oszukuje); R6 najlepszy silnik na świecie; 2JZ 1000 koni w papierach 280; Wankel ("Jaki pojeb wymyślił silnik Wankla?"); zawieszenie, które ciągle się sypie; turbo; litr z turbo to największe kłamstwo motoryzacji (downsizing); V8 najlepszy silnik (small block, popychacze); rzędowa piątka lepsza od rzędowej szóstki; bokser Porsche najlepszy silnik na świecie (część 7); 1.2 PureTech "Kurwa, tylko debil kupiłby ten silnik" (część 8, pasek w oleju, reklama skanera OBD); 1.2 PureTech najlepszy silnik na świecie (część 9, odwrócenie części 8); BMW robi najlepsze silniki na świecie (część 10, S54, VANOS, F1 1983, rekord wysokości 1919); YouTube: V6 rozebrany do ostatniej śruby (8 min, do niego prowadzi CTA).

Pomysły na kolejne (z modelami, które mamy): trzy cylindry to nie wstyd albo trzy cylindry to porażka (R3 i kołysanie); popychacze lepsze od wałków w głowicy; turbo lag to mit / nowe turbo; Wankel wraca (Mazda MX-30); 2JZ kontra RB26 (tylko jeśli jest model); diesel nie umarł; zawieszenie: dlaczego sportowe auta mają podwójne wahacze. Zawsze zaproponuj 2 do 3 i wybierz jeden, jeśli Antoni nie wskazał.

## 2. Struktura (szablon, ok. 420 słów)

Nagłówki sekcji z notatką ekranową w nawiasie są TYLKO w pliku `.md`.

```
## HOOK (split dwóch silników albo plansza z danymi na ruchu; klatka 0 w ruchu; nagłówek stoi od pierwszej klatki)
<Jasne, kontrowersyjne stwierdzenie.> [+ opcjonalnie zaczepka lub wyprzedzenie zarzutu: "Tak, wiem. Sam mówiłem, że..."] Posłuchaj.

## OBIETNICA (bęben "Na końcu:")
Na końcu zobaczysz, <konkretna, ciekawa rzecz, której odpowiedź pokażemy w nagrodzie>.

## KONTRA (model, nagłówki zmieniane na słowach)
Tylko że <najmocniejszy kontrargument / to, co mówią wszyscy>. <Krótkie zdanie z etykietą, np. "Mówi się, że to dziwoląg.">. Więc czemu <otwarta pętla>?

## CZYM JEST (budowa na modelu: cylindry, wał, kąty, kolejność zapłonu)
<3 do 5 krótkich zdań z liczbami, które da się pokazać na modelu.>

## POWÓD 1: <TEMAT> ... ## POWÓD 5: <TEMAT>
Pierwszy powód to <temat jednym słowem>. <mechanizm, liczby, porównanie, przykład z autem>
(3 do 5 powodów, każdy 50 do 80 słów; każdy zaczyna się dokładnie "Pierwszy / Drugi / Trzeci / Czwarty / Piąty powód to X." bo na tym słowie kręci się bęben i wchodzi ujęcie "Powód N")

## UCZCIWIE (wada + riposta)
Uczciwie? <prawdziwa wada naszej tezy>. <ale / riposta, która wraca do tezy>.

## NAGRODA (bęben staje na odpowiedzi)
A teraz obiecane. <odpowiedź na obietnicę, konkret: nazwa, liczby, rekord>. <mocne zdanie zamykające tezę>.

## PYTANIE (karta wyboru)
To jak? <A> czy <B>? Napisz w komentarzu, co wybierasz.

## CTA YOUTUBE (karta YouTube)
A jeśli chcesz zobaczyć, jak prawdziwy silnik wygląda w środku, rozebrany do ostatniej śruby, osiem minut o V6 masz na moim YouTubie. Link w bio.

## URWANIE W PĘTLĘ (bez podsumowania)
<1 do 3 słowa, które gramatycznie wpadają w pierwsze zdanie hooka, np. "Więc powtórzę.">
```

Proporcje (przy 420 słowach): hook 15 do 25, obietnica 15 do 20, kontra 30 do 40, czym jest 30 do 40, powody razem 220 do 260, uczciwie 40 do 50, nagroda 45 do 60, pytanie 10, CTA 30 (stałe), pętla 2 do 3.

## 3. Zasady treści

- **Mechanizm, nie ogólniki.** Każdy powód ma liczbę, kąt, kolejność, porównanie albo konkretne auto. Najlepiej coś, co da się zanimować (zapłon co 144°, suw pracy 180°, pół litra na cylinder, zakładki suwów, rytm 3-2-3-2).
- **Krótkie zdania**, jedna myśl na zdanie (każde zdanie to potencjalne cięcie co 2 do 3 s). Zdania 4 do 14 słów.
- **Otwarte pętle**: obietnica na początku, pytanie "Więc czemu...?" w kontrze; zamknięcie w nagrodzie.
- **Wyprzedzanie zarzutów** ("Tak, wiem.", "Uczciwie?") buduje wiarygodność i komentarze.
- **Uczciwie** zawsze jest: prawdziwa wada i riposta. Nie przemilczaj faktów, raczej świadomie złagodź sformułowanie i zapisz to w faktach (np. "pod maską zwykłego kompaktu", bo szóstki poprzecznie istnieją w Volvo S80).
- **Callback do serii** tam, gdzie pasuje ("o której już mówiłem").
- Druga osoba ("zobaczysz", "napisz", "wsiadasz ty"), luźny język, dozwolone mocne słowa w hooku, jeśli pasują do tematu.
- **Nagroda musi dowieźć obietnicę** dosłownie (obietnica "który pięciocylindrowiec dziewięć razy z rzędu zdobył tytuł silnika roku" → nagroda "Audi dwa i pół litra te ef es i. Dziewięć razy z rzędu...").
- **Pytanie** to wybór z dwóch opcji, na który da się odpowiedzieć dopiero po obejrzeniu. Nigdy transakcja ("napisz TAK, a...").
- **Bez "obserwuj" w tekście** (karta serii jest tylko na ekranie).
- **NIGDY podsumowania na końcu.** Antoni: "końcówka z podsumowaniem jest słaba", na podsumowaniu jest skok wyjść. Po "Link w bio." tylko zdanie pętli.
- **Pętla**: ostatnie słowa czytane razem z pierwszym zdaniem tworzą jedno zdanie ("Więc powtórzę. Rzędowa piątka jest lepsza od rzędowej szóstki."; "Dlatego mówię wprost. Litr z turbo to...").

## 4. Zapis pod TTS (ElevenLabs, Adam)

- **Liczby słownie**: "sto czterdzieści cztery stopnie", "dwa i pół litra", "tysiąc dziewięćset osiemdziesiątym siódmym", "czterysta koni", "dwadzieścia lat". Wyjątki, które lektor czyta dobrze: "V6", "V8", "V10".
- **Nazwy fonetycznie**, jak mają zabrzmieć po polsku: "Kwattro" (Quattro), "te ef es i" (TFSI), "er es trzy" (RS3), "Fokusa er es" (Focusa RS), "Rerl" (Röhrl), "Pajks Pik" (Pikes Peak), "Grupa be" (Grupa B), "dwa dżej zet" (2JZ), "er be dwadzieścia sześć" (RB26), "daunsajzing", "rajtsajzing", "Pjur Tek" (PureTech), "Fokus". W pliku `.md` zapisz, które nazwy są fonetycznie, i poprawną pisownię do grafik.
- Interpunkcja steruje pauzami: kropka = pauza, przecinek = oddech; pytajnik daje intonację ("Uczciwie?").
- Bez skrótów, symboli i nawiasów w tekście TTS (°, %, km/h zapisz słowami).
- Nie wstawiaj znaczników emocji ani pauz ElevenLabs.

## 5. Długość

- Tempo po wycięciu ciszy 2,35 do 2,55 słowa/s: R5 424 słowa = 166 s, R6 408 słów = 173 s, downsizing 470 słów = ok. 173 s (przed wycięciem podsumowania, potem 168,5 s), 2JZ 372 słowa = 147 s.
- Cel: 390 do 430 słów (ok. 2:40 do 2:55). Minimum ok. 370, maksimum 450.
- Policz: `wc -w <temat>-tts.txt`.

## 6. Fakty

Na końcu `.md` sekcja "Fakty do sprawdzenia przed nagraniem": każda liczba, rok, rekord, nazwa silnika i modelu auta, z tym, co jest pewne, a co świadomie złagodzone. Nie wymyślaj liczb; jeśli czegoś nie jesteś pewien, zmień sformułowanie na bezpieczne albo sprawdź (WebSearch). Przykład wzorcowy: `examples/r5-lepsze-od-r6.md`.

## 7. Notatki ekranowe w `.md`

Przy każdej sekcji w nawiasie: co jest na ekranie (split, bęben, plansza z czym, co świeci na modelu, stempel, karta). To plan dla skilla filmowego. Pamiętaj o jego zasadach: jedna informacja pokazana raz, bez dublowanych animacji, zmiana co 2 do 3 s. Na górze `.md`: liczba słów, szacowany czas, pętla (ostatnie słowa → hook), engagement (bęben i odpowiedź, pytanie, karta serii "Część N", CTA YT), modele.

## 8. Wzorce

- `examples/r5-lepsze-od-r6.md` + `-tts.txt`: NAJNOWSZY, pełny wzorzec struktury (hook z wyprzedzeniem zarzutu, 5 powodów, uczciwie, nagroda, pytanie, CTA YT, pętla bez podsumowania).
- `examples/downsizing-klamstwo.md` + `-tts.txt`: hook z oskarżeniem, test kontra droga, sekcja podsumowania OZNACZONA jako wycięta (tak NIE piszemy).
- `examples/r6-najlepszy-silnik.md`, `examples/v8-lepsze-od-v6.md`, `examples/2jz-tysiac-koni.md`: wcześniejsze; ich zakończenia z "zamknięciem pętli" w formie mini podsumowania są NIEAKTUALNE (dziś CTA YT + 1 do 3 słowa pętli).
- `examples/wankel.md`, `examples/zawieszenie-ciagle-sie-pierdoli.md`, `examples/v6-*.md`: krótsze (ok. 1,5 min) formaty z początków kanału; hooki w tonie zaczepnym.
- `examples/yt-v6-8min*.txt`: długi film na YouTube (do niego prowadzi CTA).

## 9. Reklama z TikTok Shop (np. skaner diagnostyczny OBD)

Antoni: reklama ma być "wpasowana do filmu, a nie że z dupy".
- Zasiej problem w jednym z powodów (np. "A kontrolka oleju zapala się, kiedy jest już za późno."), a produkt daj w sekcji UCZCIWIE jako radę ("Da się z nim żyć, ale trzeba go pilnować... Dlatego w takim aucie warto wozić mały skaner diagnostyczny."). Riposta wraca do tezy z produktem w zdaniu ("silnik, którego trzeba pilnować skanerem...").
- Miejsce: tuż przed nagrodą (widz czeka na bęben). Ok. 40 do 50 słów, całość nadal max 450.
- Treść: jak się używa (wpinasz pod kierownicą, na telefonie błędy i parametry), uczciwe ograniczenie ("Paska nie pokaże"), bez obietnic ponad produkt i bez zmyślonego "ja używam".
- Wezwanie: "Masz go w koszyku na dole filmu."
- W `.md`: notatka ekranowa (gniazdo OBD, skaner, telefon, karta produktu, strzałka do koszyka) i w faktach: oznaczenie "treść komercyjna" przy publikacji.
- Wzór: `skrypty/puretech-tylko-debil.md` i `-tts.txt` w `/Users/antoni/projekty/silniki-tiktok`.
