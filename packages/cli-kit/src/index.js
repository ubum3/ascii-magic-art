/*
 * ascii-magic-art-cli-kit: an intro for a CLI as it starts, and a progress bar
 * and a spinner while it works, drawn by pieces and extras specs. Each one
 * degrades by itself: words with no escape codes when piped, under CI or with
 * TERM=dumb, one still frame with AMA_NO_MOTION, no colour with NO_COLOR.
 */
export { intro } from "./intro.js";
export { progress, spinner } from "./live.js";
export { mode, isCI, colorOn } from "./mode.js";
