/**
 * FFmpeg visual presets for study/focus videos.
 * Used by run-pipeline.js to build the filter_complex.
 */

const PRESETS = {
  study: {
    // Calm, slow zoom (default LOTR study style)
    zoomIncrement: 0.00002,
    zoomMax: 1.05,
    gamma: 1.05,
    brightnessAmplitude: 0.02,
    brightnessPeriod: 8,
    vignetteAngle: Math.PI / 8,
    baseNoise: 6,
    dustNoise: 60,
    dustBlur: 20,
    dustOpacity: 0.12,
    finalNoise: 2,
  },
  epic: {
    // Slower zoom, stronger vignette for a "big" feel
    zoomIncrement: 0.00001,
    zoomMax: 1.03,
    gamma: 1.05,
    brightnessAmplitude: 0.015,
    brightnessPeriod: 10,
    vignetteAngle: Math.PI / 6,
    baseNoise: 6,
    dustNoise: 60,
    dustBlur: 20,
    dustOpacity: 0.15,
    finalNoise: 2,
  },
};

function getPreset(name) {
  const key = (name || 'study').toLowerCase();
  if (!PRESETS[key]) {
    return PRESETS.study;
  }
  return PRESETS[key];
}

module.exports = { PRESETS, getPreset };
