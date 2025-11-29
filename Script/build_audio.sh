#!/bin/bash 

# Directory one level above where this script lives
# If script is at project/scripts/build_audio.sh,
# SCRIPT_DIR will be project/
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

AUDIO_DIR="Audio_Parts"
OUT_DIR="Outputs"
LIST_FILE="audio_list.txt"

mkdir -p "$OUT_DIR"

# Clean old list file
rm -f "$LIST_FILE"

# Build concat list with full paths
shopt -s nullglob
files=("$AUDIO_DIR"/*.wav)

if [ ${#files[@]} -eq 0 ]; then
  echo "No .wav files found in $AUDIO_DIR"
  exit 1
fi

for f in "${files[@]}"; do
  echo "file '$f'" >> "$LIST_FILE"
done

# Now run ffmpeg concat using that list
ffmpeg -f concat -safe 0 -i "$LIST_FILE" \
  -c:a aac -b:a 192k \
  "$OUT_DIR/audio_merged.m4a"