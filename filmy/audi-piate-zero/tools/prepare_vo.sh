#!/usr/bin/env bash
# Lektor z ElevenLabs -> wycięta cisza -> poziom -> transkrypcja słowo w słowo.
# użycie (z katalogu projektu): bash tools/prepare_vo.sh "/Users/antoni/Downloads/ElevenLabs_....mp3"
# Wynik: assets/vo-raw.mp3 (oryginał), assets/vo-cut.mp3 (bez ciszy), assets/vo.mp3 (szczyt ok. -3,6 dBFS),
#        assets/silence-map.json, assets/transcript.json (+ kopia transcript.orig.json).
set -euo pipefail
SRC="$1"
cp "$SRC" assets/vo-raw.mp3
python3 tools/cut_silence.py assets/vo-raw.mp3 assets/vo-cut.mp3
MAX=$(ffmpeg -hide_banner -i assets/vo-cut.mp3 -af volumedetect -f null - 2>&1 | sed -n 's/.*max_volume: \(-*[0-9.]*\) dB/\1/p')
GAIN=$(python3 -c "print(round(-3.6 - ($MAX), 2))")
echo "szczyt po cięciu: $MAX dB, korekta: $GAIN dB"
ffmpeg -y -hide_banner -loglevel error -i assets/vo-cut.mp3 -af "volume=${GAIN}dB" -b:a 192k assets/vo.mp3
ffmpeg -hide_banner -i assets/vo.mp3 -af volumedetect -f null - 2>&1 | grep -E "max_volume|mean_volume"
ffprobe -v error -show_entries format=duration -of csv=p=0 assets/vo.mp3
# transkrypcja nadpisuje assets/transcript.json, więc najpierw kopia, jeśli istnieje
[ -f assets/transcript.json ] && cp assets/transcript.json assets/transcript.bak.json
npx --yes hyperframes@0.8.58 transcribe assets/vo-cut.mp3 -m medium -l pl --json
cp assets/transcript.json assets/transcript.orig.json
python3 - <<'EOF'
import json
w = json.load(open("assets/transcript.json"))
w = w if isinstance(w, list) else w.get("words", w)
print(len(w), "słów")
print(" ".join(f"{(x.get('text') or x.get('word')).strip()}@{x['start']:.2f}" for x in w))
EOF
