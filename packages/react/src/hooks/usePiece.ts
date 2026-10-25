"use client";
import { useEffect, useState } from "react";
import type { PieceModule } from "ascii-magic-art/lib/types.js";
import { resolvePiece, sizeOf, type PieceRef, type PieceSize } from "../core/resolve.js";

export interface UsePiece {
  module: PieceModule | undefined;
  /** Known at once for any slug, before the piece has loaded. */
  size: PieceSize | undefined;
  status: "loading" | "ready" | "error";
  error: unknown;
}

/** Load a piece by name (or pass a module through), e.g. to feed useAsciiFrame. */
export function usePiece(piece: PieceRef): UsePiece {
  const [state, setState] = useState<Omit<UsePiece, "size">>(() =>
    typeof piece === "string" ? { module: undefined, status: "loading", error: undefined } : { module: piece, status: "ready", error: undefined });
  useEffect(() => {
    let cancelled = false;
    if (typeof piece !== "string") { setState({ module: piece, status: "ready", error: undefined }); return; }
    setState((s) => (s.module?.meta.slug === piece ? s : { module: undefined, status: "loading", error: undefined }));
    resolvePiece(piece).then(
      (module) => { if (!cancelled) setState({ module, status: "ready", error: undefined }); },
      (error: unknown) => { if (!cancelled) setState({ module: undefined, status: "error", error }); },
    );
    return () => { cancelled = true; };
  }, [piece]);
  return { ...state, size: sizeOf(piece) };
}
