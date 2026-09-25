---
workflow: general-video
flow: automation
storyboard: no
message: "Na niskich obrotach pod gazem film olejowy jest najcieńszy dokładnie wtedy, gdy nacisk jest największy"
destination: tiktok-reels
aspect: 1080x1920
language: pl
length: 93s
angle: mechanism
---

## Intent

Insert wizualny do short-forma motoryzacyjnego. Kanał sprzedaje się wiarygodnością
techniczną, więc grafika ma pokazywać realny mechanizm, a nie dekorację. Styl:
przekrój techniczny, ciemne tło, kreskowanie jak na rysunku warsztatowym,
bursztynowy olej jako jedyny akcent. Bez emoji, bez stockowych ujęć silnika.

Ton: surowy, rzeczowy. Widz ma zobaczyć to, o czym mówi lektor, w tej samej sekundzie.

## Assets

- assets/vo.mp3 — lektor ElevenLabs (Adam), 93,5 s, język polski, mono 44,1 kHz. Steruje długością całego filmu.

## Customizations

- Przekrój łożyska ślizgowego w Three.js: panewka, czop wału, mimośrodowy klin olejowy.
- Powierzchnie cięcia kreskowane w przeciwne strony; kreskowanie czopu obraca się razem z nim i niesie czytelność obrotu.
- Kanał olejowy w czopie jako jednoznaczny znacznik obrotu.
- Strzałki przepływu poruszają się z połową prędkości czopu (średnia prędkość oleju w szczelinie).
- Odczyty HUD: obroty i grubość filmu w µm, przecinek dziesiętny po polsku.
- Stopka "przekrój schematyczny, luz powiększony" — luz jest wyolbrzymiony, żeby był widoczny.

## Notes

- Sceny synchronizowane do transkrypcji słowo w słowo (assets/vo.transcript.json), nie do szacunków.
- Czop i panewka muszą mieć tę samą grubość plastra; dłuższy czop zasłania luz i ujęcie przestaje cokolwiek pokazywać (błąd z pierwszej wersji).
- Typografia: Oswald (kondensowany grotesk) + IBM Plex Mono na liczby. Obie rodziny są prebundlowane przez renderer.
- Prototyp sceny 1 poza projektem: ../../scena-1-klin-olejowy.html
