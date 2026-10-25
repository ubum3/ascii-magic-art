/*
 * The ready-made states' variants as plain data. Kept out of the "use client"
 * files so Server Components can import the lists (a value exported from a client
 * module is only a reference on the server).
 */
import type { PieceSlug } from "../registry/sizes.generated.js";

export type LoaderVariant = "progress" | "spinners" | "skeleton" | "torus" | "cassette";
export const LOADER_VARIANTS: readonly LoaderVariant[] = ["progress", "spinners", "skeleton", "torus", "cassette"];

export type EmptyVariant =
  | "access-denied"
  | "all-caught-up"
  | "broken-link"
  | "coming-soon"
  | "confetti"
  | "copied"
  | "cobweb"
  | "inbox"
  | "no-results"
  | "offline"
  | "onboarding"
  | "payment-failed"
  | "payment-success"
  | "rate-limited"
  | "reconnecting"
  | "saved"
  | "server-error"
  | "session-expired"
  | "trash"
  | "under-construction"
  | "upload"
  | "welcome";

/** The piece behind each empty-state variant. Sizes are written out (the smoke test checks them) so the states never pull in the whole registry. */
export const EMPTY_PIECES: Record<EmptyVariant, { slug: PieceSlug; cols: number; rows: number }> = {
  "access-denied": { slug: "empty-access-denied", cols: 56, rows: 22 },
  "all-caught-up": { slug: "empty-all-caught-up", cols: 56, rows: 20 },
  "broken-link": { slug: "empty-broken-link-cloud", cols: 56, rows: 20 },
  "coming-soon": { slug: "empty-rocket-countdown", cols: 60, rows: 18 },
  confetti: { slug: "empty-task-confetti", cols: 56, rows: 20 },
  copied: { slug: "empty-clipboard-copied", cols: 56, rows: 20 },
  cobweb: { slug: "empty-cobweb-folder", cols: 56, rows: 20 },
  inbox: { slug: "empty-inbox-plane", cols: 56, rows: 20 },
  "no-results": { slug: "empty-no-results", cols: 56, rows: 20 },
  offline: { slug: "empty-offline-plug", cols: 60, rows: 20 },
  onboarding: { slug: "empty-onboarding-flag", cols: 56, rows: 20 },
  "payment-failed": { slug: "empty-payment-failed", cols: 60, rows: 20 },
  "payment-success": { slug: "empty-payment-success", cols: 60, rows: 20 },
  "rate-limited": { slug: "empty-rate-limited", cols: 62, rows: 18 },
  reconnecting: { slug: "empty-reconnecting", cols: 56, rows: 20 },
  saved: { slug: "empty-cloud-saved", cols: 56, rows: 20 },
  "server-error": { slug: "empty-smoking-server", cols: 56, rows: 21 },
  "session-expired": { slug: "empty-session-expired", cols: 56, rows: 20 },
  trash: { slug: "empty-trash-lid", cols: 56, rows: 20 },
  "under-construction": { slug: "empty-construction-crane", cols: 60, rows: 20 },
  upload: { slug: "empty-upload-tray", cols: 56, rows: 20 },
  welcome: { slug: "empty-welcome-door", cols: 56, rows: 23 },
};

export const EMPTY_VARIANTS = Object.keys(EMPTY_PIECES) as EmptyVariant[];
