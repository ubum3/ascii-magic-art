import type { DrawFn, PieceMeta } from "./types.js";

export interface ImageData { color: string[]; level: string[] }
export interface ImageMotion {
  glint?: boolean | { every?: number; width?: number };
  twinkle?: number;
  water?: number;
  waterLeft?: number;
  breathe?: number;
  drift?: number;
  palms?: boolean;
  birds?: number;
  shooting?: boolean;
}
/** Build create() for a picture made of palette keys and ink levels 0-7. */
export declare function imagePiece(meta: PieceMeta, data: ImageData, motion?: ImageMotion): () => DrawFn;
