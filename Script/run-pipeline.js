#!/usr/bin/env node
/**
 * N8N Study Video Pipeline — single entry point.
 * Reads JSON input (stdin or file path), validates, merges WAVs, builds video, prints JSON output.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const { getPreset } = require('./presets.js');

// --- Configuration defaults ---
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUTPUT_DIR = path.join(PROJECT_ROOT, 'Outputs');
const VIDEO_WIDTH = 1920;
const VIDEO_HEIGHT = 1080;
const FPS = 30;
const AAC_BITRATE = '192k';
const CRF = 19;

// --- Read input ---
function readInput() {
  const arg = process.argv[2];
  if (arg) {
    const filePath = path.isAbsolute(arg) ? path.normalize(arg) : path.resolve(process.cwd(), arg);
    if (!fs.existsSync(filePath)) {
      outputError(`Input file not found: ${filePath}`);
    }
    return Promise.resolve(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  }
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    process.stdin.on('error', reject);
  });
}

function outputError(msg) {
  const out = { error: msg };
  console.log(JSON.stringify(out));
  process.exit(1);
}

function outputSuccess(obj) {
  console.log(JSON.stringify(obj));
  process.exit(0);
}

// --- Validation ---
function validateInput(input) {
  const { theme, audioDir, imagePath, outputDir } = input;
  if (!theme || typeof theme !== 'string') {
    outputError('Missing or invalid "theme" (string).');
  }
  if (!audioDir || typeof audioDir !== 'string') {
    outputError('Missing or invalid "audioDir" (path to folder of WAVs).');
  }
  const resolvedAudioDir = path.isAbsolute(audioDir) ? audioDir : path.resolve(process.cwd(), audioDir);
  if (!fs.existsSync(resolvedAudioDir)) {
    outputError(`audioDir does not exist: ${resolvedAudioDir}`);
  }
  const wavs = fs.readdirSync(resolvedAudioDir)
    .filter((f) => f.toLowerCase().endsWith('.wav'))
    .sort();
  if (wavs.length === 0) {
    outputError('No .wav files in audioDir.');
  }
  if (!imagePath || typeof imagePath !== 'string') {
    outputError('Missing or invalid "imagePath" (path to background image).');
  }
  const resolvedImagePath = path.isAbsolute(imagePath) ? imagePath : path.resolve(process.cwd(), imagePath);
  if (!fs.existsSync(resolvedImagePath)) {
    outputError(`imagePath does not exist: ${resolvedImagePath}`);
  }
  const outDir = outputDir
    ? (path.isAbsolute(outputDir) ? outputDir : path.resolve(process.cwd(), outputDir))
    : DEFAULT_OUTPUT_DIR;
  try {
    fs.mkdirSync(outDir, { recursive: true });
  } catch (e) {
    outputError(`outputDir is not writable: ${outDir}`);
  }
  // Optional target duration: loop (and trim) merged audio to this length
  let targetDurationSeconds = null;
  if (input.targetDurationSeconds != null) {
    const n = Number(input.targetDurationSeconds);
    if (Number.isNaN(n) || n <= 0 || n > 86400) {
      outputError('"targetDurationSeconds" must be a number between 1 and 86400 (24 hours).');
    }
    targetDurationSeconds = n;
  } else if (input.targetDurationMinutes != null) {
    const n = Number(input.targetDurationMinutes);
    if (Number.isNaN(n) || n <= 0 || n > 1440) {
      outputError('"targetDurationMinutes" must be a number between 1 and 1440 (24 hours).');
    }
    targetDurationSeconds = n * 60;
  }
  return {
    theme: String(theme).trim(),
    preset: (input.preset || 'study').toLowerCase(),
    resolvedAudioDir,
    wavFiles: wavs,
    resolvedImagePath,
    outputDir: outDir,
    outputFileName: input.outputFileName || null,
    targetDurationSeconds,
  };
}

// --- Run a command and return a promise (stdout as string) ---
function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', options.stderrToStdout ? 'pipe' : 'inherit'],
      ...options,
    });
    let stdout = '';
    let stderr = '';
    if (proc.stdout) proc.stdout.on('data', (d) => { stdout += d.toString(); });
    if (proc.stderr) proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed (${code}): ${cmd} ${args.join(' ')}\n${stderr || stdout}`));
      } else {
        resolve(stdout);
      }
    });
    proc.on('error', (err) => reject(err));
  });
}

// --- Merge WAVs to one M4A ---
function mergeWavs(resolvedAudioDir, wavFiles, outputDir) {
  const listPath = path.join(outputDir, 'concat_list.txt');
  const lines = wavFiles.map((f) => {
    const fullPath = path.join(resolvedAudioDir, f).replace(/\\/g, '/');
    return `file '${fullPath}'`;
  });
  fs.writeFileSync(listPath, lines.join('\n'), 'utf8');
  const mergedPath = path.join(outputDir, 'audio_merged.m4a');
  return run('ffmpeg', [
    '-y', '-f', 'concat', '-safe', '0', '-i', listPath,
    '-c:a', 'aac', '-b:a', AAC_BITRATE,
    mergedPath,
  ]).then(() => {
    try { fs.unlinkSync(listPath); } catch (_) {}
    return mergedPath;
  });
}

// --- Get duration in seconds from audio file ---
function getDurationSeconds(audioPath) {
  return run('ffprobe', [
    '-v', 'quiet', '-print_format', 'json', '-show_format', '-i', audioPath,
  ]).then((stdout) => {
    const data = JSON.parse(stdout);
    const d = parseFloat(data.format && data.format.duration);
    if (Number.isNaN(d) || d <= 0) {
      throw new Error('Could not read duration from merged audio.');
    }
    return d;
  });
}

// --- Loop (and optionally trim) audio to exact target duration ---
function loopAudioToDuration(mergedPath, targetSeconds, outputDir) {
  const loopedPath = path.join(outputDir, 'audio_looped.m4a');
  return run('ffmpeg', [
    '-y',
    '-stream_loop', '-1',
    '-i', mergedPath,
    '-t', String(targetSeconds),
    '-c', 'copy',
    loopedPath,
  ]).then(() => loopedPath);
}

// --- Build FFmpeg filter_complex from preset and duration ---
function buildFilterComplex(preset, durationSeconds) {
  const p = preset;
  // zoompan: z='min(zoom+inc,max)', d=1 frame per output frame, fps and size
  const zExpr = `min(zoom+${p.zoomIncrement},${p.zoomMax})`;
  const brightnessExpr = `${p.brightnessAmplitude}*sin(2*PI*t/${p.brightnessPeriod})`;
  return [
    `[0:v]scale=1930:1090,crop=1920:1080:x='(iw-ow)/2':y='(ih-oh)/2',`,
    `zoompan=z='${zExpr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:fps=${FPS}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT},`,
    `eq=gamma=${p.gamma}:brightness='${brightnessExpr}',`,
    `vignette=${p.vignetteAngle},`,
    `noise=alls=${p.baseNoise}:allf=t+u[base];`,
    `[2:v]noise=alls=${p.dustNoise}:allf=t,gblur=sigma=${p.dustBlur},format=rgba,colorchannelmixer=aa=${p.dustOpacity}[dust];`,
    `[base][dust]overlay=0:0,noise=alls=${p.finalNoise}:allf=t[outv]`,
  ].join('');
}

// --- Build video with FFmpeg ---
function buildVideo(imagePath, mergedAudioPath, durationSeconds, outputPath, presetName) {
  const preset = getPreset(presetName);
  const filterComplex = buildFilterComplex(preset, durationSeconds);
  const args = [
    '-y',
    '-loop', '1', '-i', imagePath,
    '-i', mergedAudioPath,
    '-f', 'lavfi', '-i', `color=black:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:r=${FPS}`,
    '-t', String(durationSeconds),
    '-filter_complex', filterComplex,
    '-map', '[outv]', '-map', '1:a',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', String(CRF), '-preset', 'veryslow',
    '-c:a', 'aac', '-b:a', AAC_BITRATE,
    outputPath,
  ];
  return run('ffmpeg', args);
}

// --- Template title and description ---
function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
}

function templateTitle(theme, durationSeconds) {
  const dur = formatDuration(durationSeconds);
  return `${theme} | ${dur} Study / Focus Music`;
}

function templateDescription(theme, durationSeconds) {
  const dur = formatDuration(durationSeconds);
  return [
    `${theme} — ${dur} of ambient study music.`,
    'Ideal for studying, focus, reading, and relaxation.',
    'No dialogue, ambient background.',
  ].join(' ');
}

// --- Sanitize theme for filename ---
function sanitizeFileName(theme) {
  return theme.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 80) || 'study_video';
}

function uniqueOutputFileName(theme, customName) {
  if (customName) {
    return customName.endsWith('.mp4') ? customName : `${customName}.mp4`;
  }
  const base = sanitizeFileName(theme);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${base}_${stamp}.mp4`;
}

// --- Main ---
async function main() {
  let input;
  try {
    input = await readInput();
  } catch (e) {
    outputError(e.message || 'Invalid JSON input.');
  }
  const validated = validateInput(input);
  const {
    theme,
    preset,
    resolvedAudioDir,
    wavFiles,
    resolvedImagePath,
    outputDir,
    outputFileName,
    targetDurationSeconds,
  } = validated;

  try {
    const mergedPath = await mergeWavs(resolvedAudioDir, wavFiles, outputDir);
    let audioPath = mergedPath;
    let durationSeconds;
    if (targetDurationSeconds != null) {
      audioPath = await loopAudioToDuration(mergedPath, targetDurationSeconds, outputDir);
      durationSeconds = targetDurationSeconds;
    } else {
      durationSeconds = await getDurationSeconds(mergedPath);
    }
    const videoFileName = uniqueOutputFileName(theme, outputFileName);
    const outputPath = path.join(outputDir, videoFileName);

    await buildVideo(resolvedImagePath, audioPath, durationSeconds, outputPath, preset);

    const title = templateTitle(theme, durationSeconds);
    const description = templateDescription(theme, durationSeconds);

    outputSuccess({
      outputPath,
      durationSeconds: Math.round(durationSeconds * 100) / 100,
      theme,
      title,
      description,
    });
  } catch (e) {
    outputError(e.message || 'Pipeline failed.');
  }
}

main();
