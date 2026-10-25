"use client";
/*
 * Ready-made states: not found, server error, maintenance, loading and empty
 * states, each a piece with an optional title, description and action under it.
 * The page and loader pieces are imported directly, so their first frame is in
 * the server HTML; the 22 empty-state pieces each load as their own chunk.
 */
import { type CSSProperties, type ReactNode } from "react";
import type { PieceModule } from "ascii-magic-art/lib/types.js";
import * as notFound from "ascii-magic-art/pieces/page-404.js";
import * as serverError from "ascii-magic-art/pieces/page-500.js";
import * as maintenance from "ascii-magic-art/pieces/maintenance-mode.js";
import * as progress from "ascii-magic-art/pieces/progress-loader.js";
import * as spinners from "ascii-magic-art/pieces/spinner-set.js";
import * as skeleton from "ascii-magic-art/pieces/skeleton-loader.js";
import * as torus from "ascii-magic-art/pieces/spinning-torus.js";
import * as cassette from "ascii-magic-art/pieces/cassette-tape-loader.js";
import { pickLook, toLook, type LookProps } from "../core/look.js";
import { EMPTY_PIECES, type EmptyVariant, type LoaderVariant } from "../core/variants.js";
import type { PlaybackOptions } from "../hooks/useAsciiPlayer.js";
import { AsciiPlayer } from "./AsciiPlayer.js";
import { PieceView } from "./PieceView.js";

export interface StateProps extends LookProps, Pick<PlaybackOptions, "speed" | "still" | "paused"> {
  /** A heading under the art. */
  title?: ReactNode;
  /** A line of text under the heading. */
  description?: ReactNode;
  /** A button or link under the text. */
  action?: ReactNode;
  /** Anything else, after the action. */
  children?: ReactNode;
  /** Font size of the art in px or any CSS length. */
  size?: number | string;
  /** Heading level for the title. Default 2. */
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
  style?: CSSProperties;
}

const stack: CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "0.75rem", maxWidth: "100%",
};

function Layout({ art, title, description, action, children, as: H = "h2", className, style }: StateProps & { art: ReactNode }) {
  return (
    <div className={className} style={{ ...stack, ...style }}>
      {art}
      {title != null && <H style={{ margin: 0 }}>{title}</H>}
      {description != null && <p style={{ margin: 0, opacity: 0.75 }}>{description}</p>}
      {action}
      {children}
    </div>
  );
}

function ModuleState({ piece, ...p }: StateProps & { piece: PieceModule }) {
  return <Layout {...p} art={<AsciiPlayer piece={piece} size={p.size} speed={p.speed} still={p.still} paused={p.paused} {...pickLook(p)} />} />;
}

/** For app/not-found.tsx: an astronaut lost in space. */
export function AsciiNotFound(p: StateProps) {
  return <ModuleState piece={notFound} {...p} />;
}

/** For app/error.tsx (a client component in Next.js anyway). */
export function AsciiServerError(p: StateProps) {
  return <ModuleState piece={serverError} {...p} />;
}

export function AsciiMaintenance(p: StateProps) {
  return <ModuleState piece={maintenance} {...p} />;
}

const LOADERS: Record<LoaderVariant, PieceModule> = { progress, spinners, skeleton, torus, cassette };

/** For app/loading.tsx or a Suspense fallback. The art carries role="img"; the wrapper says "loading" to screen readers. */
export function AsciiLoader({ variant = "progress", ...p }: StateProps & { variant?: LoaderVariant }) {
  return (
    <div role="status" aria-live="polite" style={{ display: "contents" }}>
      <ModuleState piece={LOADERS[variant]} {...p} />
    </div>
  );
}

// One lazy chunk per variant; the sizes come from EMPTY_PIECES.
const EMPTY_LOADERS: Record<EmptyVariant, () => Promise<PieceModule>> = {
  "access-denied": () => import("ascii-magic-art/pieces/empty-access-denied.js"),
  "all-caught-up": () => import("ascii-magic-art/pieces/empty-all-caught-up.js"),
  "broken-link": () => import("ascii-magic-art/pieces/empty-broken-link-cloud.js"),
  "coming-soon": () => import("ascii-magic-art/pieces/empty-rocket-countdown.js"),
  confetti: () => import("ascii-magic-art/pieces/empty-task-confetti.js"),
  copied: () => import("ascii-magic-art/pieces/empty-clipboard-copied.js"),
  cobweb: () => import("ascii-magic-art/pieces/empty-cobweb-folder.js"),
  inbox: () => import("ascii-magic-art/pieces/empty-inbox-plane.js"),
  "no-results": () => import("ascii-magic-art/pieces/empty-no-results.js"),
  offline: () => import("ascii-magic-art/pieces/empty-offline-plug.js"),
  onboarding: () => import("ascii-magic-art/pieces/empty-onboarding-flag.js"),
  "payment-failed": () => import("ascii-magic-art/pieces/empty-payment-failed.js"),
  "payment-success": () => import("ascii-magic-art/pieces/empty-payment-success.js"),
  "rate-limited": () => import("ascii-magic-art/pieces/empty-rate-limited.js"),
  reconnecting: () => import("ascii-magic-art/pieces/empty-reconnecting.js"),
  saved: () => import("ascii-magic-art/pieces/empty-cloud-saved.js"),
  "server-error": () => import("ascii-magic-art/pieces/empty-smoking-server.js"),
  "session-expired": () => import("ascii-magic-art/pieces/empty-session-expired.js"),
  trash: () => import("ascii-magic-art/pieces/empty-trash-lid.js"),
  "under-construction": () => import("ascii-magic-art/pieces/empty-construction-crane.js"),
  upload: () => import("ascii-magic-art/pieces/empty-upload-tray.js"),
  welcome: () => import("ascii-magic-art/pieces/empty-welcome-door.js"),
};

/** An empty, success or failure state. Each variant's piece loads on demand; its space is held until then. */
export function AsciiEmptyState({ variant, ...p }: StateProps & { variant: EmptyVariant }) {
  const e = EMPTY_PIECES[variant];
  return (
    <Layout
      {...p}
      art={
        <PieceView
          source={EMPTY_LOADERS[variant]}
          sourceKey={e.slug}
          pieceSize={{ cols: e.cols, rows: e.rows, square: false }}
          html={null}
          look={toLook(pickLook(p))}
          size={p.size}
          speed={p.speed}
          still={p.still}
          paused={p.paused}
        />
      }
    />
  );
}
