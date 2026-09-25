#!/bin/bash
# Generuje polski lektor do 20 scen i sprawdza dlugosc kazdej linii.
# Uruchom z katalogu projektu: bash zrob-lektora.sh
set -e
cd "$(dirname "$0")"
TTS=/Users/antoni/.hermes/hermes-agent/venv/bin/edge-tts
GLOS=pl-PL-MarekNeural
RATE="+8%"
RATE_PO="+30%"
WY=assets/lektor
mkdir -p "$WY"

linie=(
  "Dlaczego V6 wygrywa z rzedem?"
  "Szesc cylindrow w dwoch rzedach."
  "Kazdy rzad ma trzy cylindry."
  "Mit: idealnie wywazony."
  "Nieprawda. Rzedowa trojka."
  "Trzy cylindry to liczba nieparzysta."
  "Dlatego kolysze sie wzdluz walu."
  "Ratuje go tlumik drgan."
  "A mimo to V6 wygrywa."
  "Krotki blok to najwieksza zaleta."
  "Tak pracuje jeden cylinder."
  "Moment siega stu piecdziesieciu procent."
  "Tlok spreza mieszanke."
  "Czworka: dwiescie siedemdziesiat."
  "Iskra zapala mieszanke."
  "Zaplony nachodza na siebie."
  "Spaliny wychodza do kolektora."
  "Od dwoch i pol litra w gore."
  "Formula jeden przeszla na V6."
  "Nie idealny, ale najlepszy."
)

echo "=== GENERUJE LEKTORA ==="
for i in "${!linie[@]}"; do
  nr=$(printf "%02d" $((i + 1)))
  plik="$WY/scena-$nr.mp3"
  rm -f "$plik"
  # sceny 5 i 14 wychodza za dlugie w tempie podstawowym, przyspieszamy je mocniej
  if [ "$nr" = "05" ] || [ "$nr" = "14" ]; then
    R="$RATE_PO"
  else
    R="$RATE"
  fi
  "$TTS" --voice "$GLOS" --rate="$R" --text "${linie[$i]}" --write-media "$plik" >/dev/null 2>&1
  d=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$plik" 2>/dev/null || echo 0)
  ok="OK"
  awk -v d="$d" 'BEGIN{ if (d+0 > 2.9) exit 1 }' || ok="ZA DLUGIE"
  printf "  scena %s  %5.2f s  %s\n" "$nr" "$d" "$ok"
done
echo "=== KONIEC ==="
