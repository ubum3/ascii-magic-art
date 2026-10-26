// lumino-ui/backgrounds: the shared parts of the backgrounds, and the list of them. No background loads until picked.
export { BackgroundFrame, BRAND_FALLBACK, FILL_CANVAS, type BackgroundFrameProps, type LuminoBackground, type LuminoBackgroundProps } from "./frame.js";
export { useCanvasLoop, useGLScene, use2DScene, type LoopOptions, type Scene, type SceneFrame } from "./loop.js";
export * from "./gl.js";
export { LUMINO_BACKGROUNDS, findBackground, type BackgroundEntry } from "./registry.js";
export { LuminoRandomBackground, chooseBackground, type LuminoRandomBackgroundProps } from "./LuminoRandomBackground.js";
