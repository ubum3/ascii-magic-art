/*
 * schemes.js: the card schemes the wall knows, with the colours their bursts use.
 * Colours are bright enough to read on a dark TV; they are not brand assets.
 */
export const SCHEMES = {
  visa: { label: "VISA", hues: ["#3d7bff", "#f7b600", "#9db8ff"] },
  mastercard: { label: "MASTERCARD", hues: ["#ff3b30", "#ff9f1c", "#ffd166"] },
  amex: { label: "AMEX", hues: ["#2ea8ff", "#7fd1ff", "#e6f6ff"] },
  discover: { label: "DISCOVER", hues: ["#ff7a1a", "#ffb27a", "#fff1e6"] },
};

export const SCHEME_IDS = Object.keys(SCHEMES);

/** The region id of a scheme's burst. */
export const burstId = (scheme) => `burst-${scheme}`;
