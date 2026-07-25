export function speechBandHint(freqIndex: number, totalBins: number): boolean {
  const ratio = freqIndex / totalBins;
  return ratio > 0.05 && ratio < 0.45;
}

export const ENHANCEMENT_LIMITS = {
  disclaimer:
    'Enhanced audio is probabilistic and should be compared with raw recordings. It does not diagnose or determine reality.',
  maxClipSeconds: 30,
} as const;
