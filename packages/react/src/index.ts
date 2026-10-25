/// <reference path="../types/pieces.d.ts" preserve="true" />
/*
 * ascii-magic-art-react: animated ASCII art for React and Next.js.
 * Every component here is a client component; for the first frame of a piece
 * picked by name in the server HTML, see "ascii-magic-art-react/server".
 */
export { AsciiArt, type AsciiArtProps } from "./client/AsciiArt.js";
export { AsciiPlayer, type AsciiPlayerProps } from "./client/AsciiPlayer.js";
export { AsciiHero, type AsciiHeroProps } from "./client/AsciiHero.js";
export {
  AsciiNotFound, AsciiServerError, AsciiMaintenance, AsciiLoader, AsciiEmptyState, type StateProps,
} from "./client/states.js";
export { EMPTY_VARIANTS, LOADER_VARIANTS, EMPTY_PIECES, type EmptyVariant, type LoaderVariant } from "./core/variants.js";
export type { ViewProps } from "./client/PieceView.js";

export { useAsciiPlayer, type AsciiPlayerControls, type PieceSource, type PlaybackOptions, type PlayerStatus } from "./hooks/useAsciiPlayer.js";
export { useAsciiFrame, type AsciiFrame, type AsciiFrameOptions } from "./hooks/useAsciiFrame.js";
export { usePiece, type UsePiece } from "./hooks/usePiece.js";
export { useReducedMotion } from "./hooks/useReducedMotion.js";

export { toLook, type LookProps } from "./core/look.js";
export { firstFrameHTML, boxSize } from "./core/prerender.js";
export { loadPiece, resolvePiece, sizeOf, isSlug, type PieceRef, type PieceSize } from "./core/resolve.js";
export type { PieceSlug } from "./registry/sizes.generated.js";
export type { Frame, LookName, LookOptions, PieceMeta, PieceModule, Palette, DrawFn } from "ascii-magic-art/lib/types.js";
