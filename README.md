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
   - **Option A (N8N / one call):** `node Script/run-pipeline.js` with JSON input (theme, audioDir, imagePath) → merged audio + video + template title/description in one step.
   - **Option B (manual):** `build_audio.sh` → concatenates all audio parts; then `build_video.sh` → combines with a background image and Ken Burns zoom into `Outputs/`.

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
  Script/           # Helper scripts
    build_audio.sh
    build_video.sh
    run-pipeline.js # N8N / single-call pipeline (Node)
    presets.js      # FFmpeg presets (study, epic)
  package.json      # Node entry for run-pipeline.js
  README.md
```

---

## N8N usage (single script)

For automation (e.g. N8N), use the **Node pipeline** so one call does everything with minimal inputs.

### Minimal input (JSON)

Pass a single JSON object (via **stdin** or a **file path**):

| Field | Required | Description |
|-------|----------|-------------|
| `theme` | Yes | Vibe name, e.g. `"LOTR study"`, `"Italian café"` |
| `audioDir` | Yes | Path to folder containing `.wav` files (sorted by filename) |
| `imagePath` | Yes | Path to one background image (e.g. PNG) |
| `outputDir` | No | Where to write the MP4 (default: project `Outputs/`) |
| `preset` | No | `"study"` (default) or `"epic"` (slower zoom, stronger vignette) |
| `outputFileName` | No | Custom output filename; otherwise `{theme}_{timestamp}.mp4` |
| `targetDurationMinutes` | No | Target length in minutes (e.g. `60`). Merged audio is looped and trimmed to this duration. |
| `targetDurationSeconds` | No | Target length in seconds (e.g. `3600`). Overrides minutes if both are set. |

When `targetDurationMinutes` or `targetDurationSeconds` is set, the merged audio is **looped** (repeated) and then **trimmed** to exactly that length, so you can hit a 45–90 minute (or any) target from shorter source WAVs.

**Example (stdin):**

```bash
echo '{"theme":"LOTR study","audioDir":"Audio_Parts","imagePath":"Images/tt.png","targetDurationMinutes":60}' | node Script/run-pipeline.js
```

**Example (file):**

```bash
node Script/run-pipeline.js /path/to/input.json
```

### Output (JSON to stdout)

On success, the script prints a single JSON object:

- `outputPath` — path to the generated MP4  
- `durationSeconds` — length of the video  
- `theme` — echoed back  
- `title` — template-based, e.g. `"LOTR study | 1h 30m Study / Focus Music"`  
- `description` — short blurb (theme, duration, "for studying/focus")

On error, it prints `{ "error": "message" }` and exits with a non-zero code.

### Running from N8N

1. **Trigger** (schedule or webhook) → set variables: `theme`, `audioDir`, `imagePath` (e.g. from a "save files" step).
2. **Execute Command** (or Code node): run `node Script/run-pipeline.js` with the input JSON (e.g. write to a temp file and pass its path, or pipe JSON into stdin).
3. **Parse** the JSON output.
4. **(Optional)** Use an AI node (OpenAI / N8N AI) with `theme`, `durationSeconds`, and `outputPath` to generate a richer title and description; use AI output when present, otherwise keep the script's `title` and `description`.
5. Use `outputPath`, `title`, and `description` in a **YouTube upload** (or file move / notification) node.

**Requirements:** Node.js 14+ and **FFmpeg** (and ffprobe) on the PATH. No npm dependencies; the script uses only Node built-ins.

### Presets

- **study** (default): Calm, slow Ken Burns zoom, light vignette, subtle film grain.  
- **epic**: Slower zoom, stronger vignette for a "big" feel (e.g. LOTR-style).

You can extend presets in `Script/presets.js`.
