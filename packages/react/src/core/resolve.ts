import type { PieceModule } from "ascii-magic-art/lib/types.js";
import { LOADERS } from "../registry/loaders.generated.js";
import { SIZES, type PieceSlug } from "../registry/sizes.generated.js";

/** A piece by name, or a piece module you imported or made with definePiece. */
export type PieceRef = PieceSlug | PieceModule;

export interface PieceSize { cols: number; rows: number; square: boolean }

const cache = new Map<string, Promise<PieceModule>>();

export const isSlug = (s: string): s is PieceSlug => Object.prototype.hasOwnProperty.call(SIZES, s);

/** Load a piece by name (each is its own lazy chunk), once per slug. */
export function loadPiece(slug: PieceSlug): Promise<PieceModule> {
  let p = cache.get(slug);
  if (!p) {
    if (!isSlug(slug)) return Promise.reject(new Error(`ascii-magic-art: no piece "${slug}"`));
    p = LOADERS[slug]();
    p.catch(() => cache.delete(slug)); // let a failed chunk load be tried again
    cache.set(slug, p);
  }
  return p;
}

export const resolvePiece = (piece: PieceRef): Promise<PieceModule> =>
  typeof piece === "string" ? loadPiece(piece) : Promise.resolve(piece);

/** Columns, rows and cell shape, known before the piece itself has loaded. */
export function sizeOf(piece: PieceRef): PieceSize | undefined {
  if (typeof piece !== "string") return { cols: piece.meta.cols, rows: piece.meta.rows, square: piece.meta.cell === "square" };
  const s = isSlug(piece) ? SIZES[piece] : undefined;
  return s && { cols: s[0], rows: s[1], square: s[2] === 1 };
}
