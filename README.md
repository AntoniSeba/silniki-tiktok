# Silniki TikTok

Wszystkie filmy o silnikach zrobione w HyperFrames (bez renderów MP4), modele 3D, skille do pisania skryptów i produkcji, B-roll, efekty dźwiękowe i skrypty.

## Struktura

| Folder | Zawartość |
|---|---|
| `filmy/` | projekty HyperFrames (index.html, film/main.js, model/, assets/ z lektorem, transkrypcją i B-rollem, tools/) |
| `modele-zrodla/` | interaktywne przeglądarki modeli 3D (źródła, z których powstały wersje filmowe) |
| `skille/` | skille Claude Code: `tiktok-silnik-skrypt` (skrypt) i `tiktok-silnik-film` (cała produkcja, szablon, modele, B-roll, dźwięki, narzędzia) |
| `broll/` | klipy B-roll (źródła z TikToka) |
| `dzwieki/` | efekty dźwiękowe z Mixkit (licencja darmowa, bez atrybucji) |
| `skrypty/` | skrypty (plan `.md` i tekst dla lektora `-tts.txt`) |

## Filmy

| Folder | Film | Długość |
|---|---|---|
| `klin-olejowy` | Klin olejowy (pierwszy film) | 75,6 s |
| `turbo` | Turbo; w środku `panewki-v2`: "Nie oszczędzasz paliwa, płacisz panewkami" (1200 obrotów) | 128,8 s |
| `dwojka` | "Dwójka" | 128,6 s |
| `v6` | V6 najlepszy silnik (pierwsza wersja) | 140,4 s |
| `v6-dlaczego-najlepszy` | V6, dlaczego najlepszy | 60 s |
| `v6-rozwiazanie` | V6, jedno rozwiązanie (przecięty czop) | 94,4 s |
| `v8-vs-v6` | V8 kontra V6 (wzorzec wizualiów) | 91 s |
| `zawieszenie` | Zawieszenie, które ciągle się sypie | 99 s |
| `wankel` | Silnik Wankla | 91,25 s |
| `r6-najlepszy` | Rzędowa szóstka, najlepszy silnik na świecie | 173 s |
| `nowy-2jz` | 2JZ: 1000 koni, w papierach 280 | 147,3 s |
| `downsizing` | Litr z turbo to największe kłamstwo motoryzacji | 168,55 s |
| `v8-najlepszy` | V8 najlepszy silnik (small block, popychacze) | 141,6 s |
| `r5-lepsze` | Rzędowa piątka lepsza od rzędowej szóstki | 166,18 s |
| `rozgrzewanie` | Rozgrzewając silnik na postoju, zabijasz go (część 7) | 173,06 s |
| `h6-najlepszy` | Bokser Porsche to najlepszy silnik na świecie (część 7); gotowy MP4: `filmy/h6-najlepszy/h6-najlepszy.mp4` | 142,52 s |
| `audi-piate-zero` | Silniki Audi: "Cztery zera na masce, piąte w środku" (część 7, wstawka TikTok Shop); gotowy MP4: `filmy/audi-piate-zero/audi-piate-zero.mp4` | 168,62 s |
| `yt-v6` | YouTube: V6 rozebrany do ostatniej śruby (8 min) | 461 s |
| `engagement-kit` | zestaw kart engagement (test) | 16 s |

## Uruchomienie filmu

```bash
cd filmy/<film>
npx --yes hyperframes@0.8.58 preview --port 4332
```
Studio: `http://localhost:4332/#project/<id>`. Render (zawsze jeden worker):
```bash
npx --yes hyperframes@0.8.58 render . -q high --workers 1 -o ./renders/video.mp4
```
Jeśli `index.html` ma atrybuty `data-hf-id` (dopisuje je Studio), renderuj z kopii bez nich (`skille/tiktok-silnik-film/assets/tools/render.sh`).

## Instalacja skilli na innym komputerze

```bash
bash zainstaluj-skille.sh
```
Kopiuje `skille/*` do `~/.claude/skills/`.

## Licencje i prawa

Repozytorium prywatne. Klipy w `broll/` i `filmy/*/assets/broll` pochodzą z TikToka od innych twórców (@filipzabielski65, @speedkar9, @brembohoward, @altuniverse.ai, @aimechanicvibes, @lilannachen.ytb, @nm_auto1, @d.krbxy): tylko do użytku roboczego, nie do publicznej redystrybucji. Efekty dźwiękowe: Mixkit (darmowa licencja).
