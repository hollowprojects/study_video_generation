# Study Video Generation Pipeline 🎧📽️

Generate long-form study / focus videos for YouTube using:

- **AI music** from Mubert (Creator plan / Render)
- **AI visuals** from DALL·E (via ChatGPT)
- **FFmpeg** for stitching audio, creating videos, and adding a subtle Ken Burns effect

The goal is to keep the workflow:
- **Cheap** (leveraging tools you already pay for)
- **Semi-automated** (minimal manual steps once things are set up)
- **YouTube-friendly** (resolutions, codecs, licensing considerations)

---

## High-Level Flow

1. **Generate audio** in Mubert  
   - Use Mubert Render (Creator plan) to generate several `.wav` tracks for a given “vibe” (e.g. Italian café, dark cello, fantasy LOTR-ish).
2. **Drop the audio files** into `Audio_Parts/`.
3. **Generate one or more background images** using DALL·E via ChatGPT and save them into `Images/`.
4. **Run the scripts**:
   - `build_audio.sh` → concatenates all audio parts into one long track.
   - `build_video.sh` → combines the long audio track with a background image, applies a subtle Ken Burns zoom, and exports a YouTube-ready MP4 into `Outputs/`.

---

## Project Structure

Suggested layout:

```text
study_video_generation/
  Audio_Parts/      # Raw Mubert audio parts (WAVs)
    part1.wav
    part2.wav
    ...
  Images/           # DALL·E images used as backgrounds
    bg.png
    ...
  Outputs/          # Generated audio + final videos
    audio_merged.m4a
    final_video.mp4
  Script/          # Helper scripts
    build_audio.sh
    build_video.sh
  README.md
