# Rozgrzewając silnik na postoju, zabijasz go. Skrypt do TTS (TikTok, ok. 2 min 50 s)

Tekst dla lektora bez nagłówków: `rozgrzewanie-na-postoju-tts.txt` (432 słowa; przy 2,35 do 2,55 słowa/s wyjdzie ok. 2:50 do 3:00 po wycięciu ciszy).
Liczby słownie, nazwy fonetycznie: "Szkoda" (na grafikach: Škoda), "de pe efu" (na grafikach: DPF), "tysiąc dwieście", "trzydzieści sekund", "sto złotych".
Pętla: ostatnie słowa "Więc jeszcze raz." wpadają w hook "Rozgrzewając silnik na postoju, zabijasz go."
Bez podsumowania na końcu: po CTA film się urywa.
Engagement: obietnica po hooku (bęben "Na końcu:", zakryte "??? ZŁ", odpowiedź "100 ZŁ MANDATU"), pytanie "Jak tata czy po trzydziestu sekundach?", karta serii (kolejny numer) w szczycie wartości, CTA do YouTube głosem i kartą.
Dlaczego ten temat: ten sam schemat co najlepszy film kanału ("1200 obrotów": sytuacja, którą znasz, oskarżenie, koszt), ale temat dotyczy każdego kierowcy, nie tylko fanów silników. Sezonowy (publikacja przy pierwszych przymrozkach, wraca co zimę). Konflikt tata kontra fabryka robi komentarze i oznaczanie ojców.
Callbacki do serii: poduszka olejowa na panewce i "tysiąc dwieście w piątce" (film "Nie oszczędzasz paliwa, płacisz panewkami").

Modele: silnik główny `r3-turbo` (litr z turbo, typowe auto spod bloku) albo `r5-audi`, jeśli potrzebny przezroczysty odlew (`setCasingGhost`) i turbo w modelu; `panewka-standalone.js` (poduszka olejowa cienieje); `turbo-standalone.js` (olej dociera do łożysk turbo). Plansze: cytat z instrukcji (`gQuote`), wykres temperatur płynu i oleju, DPF z kanalikami, obrotomierz, mandat.

---

## HOOK (plansza zaprojektowana, wzór oryginału "1200 obrotów"; klatka 0 w ruchu: zegar postoju już tyka, szron narasta na krawędziach kadru; nagłówek stoi od pierwszej klatki)

Rozgrzewając silnik na postoju, zabijasz go. A nauczył cię tego ojciec. Tak, wiem. Całe osiedle tak robi. Posłuchaj.

(Kicker "Sytuacja, którą znasz", termometr -8°C, zegar postoju od 0:00, chipy SKROBIESZ SZYBY / SILNIK CHODZI / "NIECH SIĘ ZAGRZEJE". Nagłówek "ROZGRZEWAJĄC SILNIK NA POSTOJU," od klatki 0, werdykt "ZABIJASZ GO" na słowie "zabijasz". Na "Całe osiedle" rząd aut z parą z wydechów albo B-roll zimowego osiedla rano, jeśli się znajdzie.)

## OBIETNICA (bęben "Na końcu:" z zakrytą kwotą "??? ZŁ")

Na końcu zobaczysz, ile może cię kosztować już druga minuta rozgrzewania. I nie chodzi o paliwo.

(Tylko bęben, bez nagłówka "Na końcu zobaczysz", żeby nie dublować. Zegar postoju z hooka może zostać w rogu i dalej tykać, bo wraca w nagrodzie.)

## KONTRA (dymek "Niech się zagrzeje", potem karta cytatu z instrukcji, na końcu split TATA / FABRYKA)

Tylko że każdy tata i każdy mechanik mówi to samo. Niech się zagrzeje, zimny silnik jest delikatny. A teraz otwórz instrukcję. Szkoda pisze wprost: nie rozgrzewać silnika na postoju. Ruszyć natychmiast po uruchomieniu. Więc kto ma rację, tata czy fabryka?

(Na "otwórz instrukcję" wjeżdża strona instrukcji Škody; zdanie "Nie rozgrzewać silnika na postoju." podświetla się dokładnie na słowach lektora. Na "tata czy fabryka?" dwa panele z pigułką "KONTRA", otwarta pętla.)

## ZIMNY START (model w przezroczystym bloku, zimny niebieskawy odcień odlewu, wtryskiwacze)

Zimny start na mrozie. Olej jest nawet sto razy gęstszy niż rozgrzany. Ścianki cylindrów są lodowate. A komputer leje więcej paliwa, bo na zimnym metalu benzyna słabo paruje.

(Na "sto razy gęstszy" jedna plansza: dwa lejki, zimny olej ledwo kapie, ciepły leje się strumieniem; liczby nie dublować w nagłówku. Na "leje więcej paliwa" większa mgiełka z wtryskiwacza na modelu.)

## POWÓD 1: PALIWO (przekrój cylindra: film benzyny na gładzi, olej znika, pierścienie trą)

Pierwszy powód to paliwo. Benzyna, która nie odparowała, osiada na ściankach cylindra. Działa jak rozpuszczalnik i zmywa z nich olej. Pierścienie trą wtedy o gładź prawie na sucho. Dlatego silnik zużywa się najbardziej zaraz po zimnym starcie. W jeździe te minuty szybko mijają. Na postoju je przedłużasz.

(Tarcie jako spokojny żar na pierścieniach, bez fleszy. Na "W jeździe" i "Na postoju" dwa paski "strefy zużycia": krótki dla jazdy, długi dla postoju, rysowane płynnie.)

## POWÓD 2: OLEJ (miska olejowa, krople benzyny i wody; korek wlewu z białym majonezem; panewka z cieniejącą poduszką)

Drugi powód to olej. Część benzyny spływa obok pierścieni do miski. W zimnym silniku skrapla się też woda ze spalania. Gorący olej by to odparował, ale na jałowym grzeje się tak wolno, że benzyna i woda w nim zostają. Stąd biały majonez pod korkiem wlewu. A rozrzedzony olej to cieńsza poduszka na panewkach, o której już mówiłem.

(Na "majonez" zbliżenie na korek wlewu, jedyne takie ujęcie w filmie. Na "poduszka na panewkach" model panewki z filmu o 1200 obrotach, poduszka płynnie cienieje; mała miniatura tamtego odcinka jako callback.)

## POWÓD 3: CZAS (wykres: dwie linie temperatury w czasie, płyn i olej; wskazówka zegara)

Trzeci powód to czas. Na jałowym silnik pracuje prawie bez obciążenia, więc daje mało ciepła. Grzeje się dużo wolniej niż w spokojnej jeździe. Dlatego fabryka każe ruszać. A wskazówka cię oszukuje. Pokazuje płyn, nie olej. Drgnie po kilku minutach, a olej wciąż jest daleko w tyle.

(Wykres rysuje się na słowach: najpierw "postój" kontra "jazda" (jazda rośnie szybciej), potem na "Pokazuje płyn, nie olej" druga linia oleju odstaje od linii płynu. Na "fabryka każe ruszać" na moment wraca podświetlone zdanie z instrukcji, bez nowej animacji.)

## POWÓD 4: DIESEL (plansza DPF: kanaliki filtra zapełniają się sadzą, termometr spalin poniżej progu wypalania)

Czwarty powód to diesel. Jest tak oszczędny, że na jałowym daje jeszcze mniej ciepła. Na mrozie potrafi stać kwadrans, a wskazówka ledwo drgnie. Sadza zbiera się w filtrze cząstek stałych, a spaliny są za zimne, żeby ją wypalić. Każde poranne rozgrzewanie to krok bliżej do zapchanego de pe efu.

(Etykieta na planszy "DPF", nie "de pe ef". Sadza narasta warstwami przy każdym "porannym rozgrzewaniu", bez migania.)

## UCZCIWIE (model: olej płynie do wałków i do turbo; timer 0:30 z ikonami pasa i lusterek; obrotomierz z dwiema zakazanymi strefami)

Uczciwie? Chwilę silnik jednak potrzebuje. Olej musi dotrzeć do wałków i do turbo. Zapnij pas, ustaw lusterka, to jakieś trzydzieści sekund. Potem jedź spokojnie, dopóki olej jest zimny. Ani pod odcięcie, ani na tysiąc dwieście w piątce. Ale trzydzieści sekund, a nie dziesięć minut.

(Ścieżka oleju świeci się od pompy do głowicy i do łożysk turbo. Na obrotomierzu strefy "ODCIĘCIE" i "1200 W PIĄTCE" (callback). Na końcu dwie liczby obok siebie: "30 SEKUND" jasno, "10 MINUT" przekreślone.)

## NAGRODA (bęben staje na "100 ZŁ MANDATU"; zegar postoju przechodzi przez 1:00 i zmienia się w napis POSTÓJ; znak obszaru zabudowanego)

A teraz obiecane. Auto stojące dłużej niż minutę to w przepisach już postój. A na postoju w terenie zabudowanym silnik ma być wyłączony. Nawet jeśli tylko skrobiesz szyby. Czyli druga minuta rozgrzewania to sto złotych mandatu. Płacisz dwa razy. Raz mechanikowi, raz policji.

(Małym drukiem pod znakiem: "art. 60 ust. 2 pkt 3 PoRD". Na "Płacisz dwa razy" dwa paragony obok siebie: warsztat i mandat.)

## PYTANIE (karta wyboru: JAK TATA / PO 30 SEKUNDACH)

To jak? Rozgrzewasz jak tata czy ruszasz po trzydziestu sekundach? Napisz w komentarzu, jak robisz ty.

## CTA YOUTUBE (karta YouTube, znika na cięciu)

A jeśli chcesz zobaczyć, jak prawdziwy silnik wygląda w środku, rozebrany do ostatniej śruby, osiem minut o V6 masz na moim YouTubie. Link w bio.

## URWANIE W PĘTLĘ (bez podsumowania; od razu stan z klatki 0: plansza hooka, zegar postoju na 0:00)

Więc jeszcze raz.

---

## Fakty do sprawdzenia przed nagraniem

- Instrukcja Škody (Octavia III, Superb, Fabia), dosłownie: "Nie rozgrzewać silnika na postoju. Jeżeli to możliwe, należy ruszyć natychmiast po uruchomieniu silnika. W ten sposób silnik szybciej osiągnie normalną temperaturę pracy." Lektor czyta skrót ("Ruszyć natychmiast po uruchomieniu."); na karcie cytatu pełne zdania bez zmian.
- Art. 60 ust. 2 pkt 3 Prawa o ruchu drogowym: zakaz pozostawiania pracującego silnika podczas postoju na obszarze zabudowanym. Art. 2 pkt 30: postój to unieruchomienie pojazdu niewynikające z warunków lub przepisów ruchu, trwające dłużej niż 1 minutę. Stąd "druga minuta".
- Taryfikator: 100 zł za pozostawienie pracującego silnika na postoju w obszarze zabudowanym (rozporządzenie z grudnia 2021, Dz.U. 2021 poz. 2484). Sprawdzić w aktualnym taryfikatorze przed nagraniem. Kwoty 300 zł i "do 1000 zł" z niektórych artykułów dotyczą innych pozycji albo recydywy; nie używamy.
- Świadomie: przepisy dotyczą dróg publicznych, stref zamieszkania i stref ruchu. Na prywatnym parkingu osiedlowym bez oznakowanej strefy mandatu nie będzie. W tekście jest "w terenie zabudowanym", co jest zgodne z przepisem. Samochody wyłącznie elektryczne są wyłączone z zakazu.
- Lepkość: olej 5W-30 ma ok. 10,5 cSt w 100°C. Ekstrapolacja Walthera (ASTM D341) z 65 cSt w 40°C daje ok. 900 cSt w -5°C, ok. 1200 cSt w -8°C i ok. 1350 cSt w -10°C, czyli 85 do 130 razy więcej. "Nawet sto razy" jest uczciwe z dopiskiem "na mrozie"; w okolicy zera to ok. 60 razy.
- Wzbogacanie mieszanki na zimno, osadzanie się paliwa na zimnych ściankach cylindra i zmywanie filmu olejowego: mechanizm pewny.
- "Silnik zużywa się najbardziej zaraz po zimnym starcie": powszechnie przyjęte, dlatego bez liczby. Często cytowane "do 75% zużycia" jest niepewne i go nie używamy.
- Rozrzedzanie oleju paliwem i kondensacja wody przy zimnym silniku i krótkich trasach: pewne. Biały "majonez" pod korkiem wlewu jest typowy dla krótkich tras zimą. Świadomie nie mówimy, że bywa też objawem uszkodzonej uszczelki pod głowicą (to pewnie wyjdzie w komentarzach).
- Niższa lepkość oleju daje cieńszy film hydrodynamiczny na panewkach, stąd callback do "poduszki" z filmu o 1200 obrotach.
- Jałowy bieg: małe obciążenie, mało ciepła. Potwierdza to sama instrukcja Škody ("silnik szybciej osiągnie normalną temperaturę pracy" w jeździe). Wskazówka na zegarach pokazuje temperaturę płynu chłodzącego; olej nagrzewa się wolniej. W wielu autach wskazówka jest dodatkowo "uśredniona" i stoi na środku w szerokim zakresie temperatur.
- Diesel: wysoka sprawność, więc na jałowym mało ciepła; dlatego wiele diesli ma dodatkowe grzałki kabiny. "Potrafi stać kwadrans, a wskazówka ledwo drgnie": świadomie "potrafi" (zależy od auta i mrozu).
- DPF: sadza wypala się dopiero przy spalinach o temperaturze kilkuset stopni; na jałowym spaliny są dużo chłodniejsze. Bez konkretnych liczb w tekście.
- 30 sekund: ciśnienie oleju rośnie w kilka sekund, 30 s to bezpieczny zapas i częsta rekomendacja; turbo jest smarowane olejem silnika.
- Callback "ani na tysiąc dwieście w piątce" jest zgodny z filmem o panewkach: tam problemem był gaz na niskich obrotach; na zimnym silniku unikamy i wysokich obrotów, i dużego obciążenia na niskich.
- Pisownia do grafik: Škoda, DPF, PoRD, "art. 60 ust. 2 pkt 3".
