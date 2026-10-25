import type { Spec } from "ascii-magic-art-extras";

export type PaymentStatus =
  | "pending" | "authorised" | "declined" | "voided" | "refund" | "chargeback"
  | "payout-scheduled" | "payout-sent" | "settled"
  | "onboarding" | "kyc-review" | "kyc-rejected" | "merchant-live"
  | "terminal-offline" | "terminal-reconnecting" | "rate-limited" | "session-expired" | "demo";
export type Tone = "ok" | "wait" | "warn" | "fail";

export interface ResolvedState {
  status: PaymentStatus;
  tone: Tone;
  /** A short sentence for screen readers and the default title. */
  label: string;
  /** A library piece. */
  slug?: string;
  /** An extras spec, when there is no piece. */
  spec?: Spec;
  /** A small text spec to show under the art. */
  caption?: Spec;
}

export interface NormaliseOptions {
  /** The event's success flag, for event codes with two outcomes (Adyen AUTHORISATION, REFUND, ...). */
  success?: boolean | "true" | "false";
}

export declare const TABLE: {
  version: number;
  tones: Tone[];
  states: Record<PaymentStatus, { tone: Tone; label: string; slug?: string; spec?: Spec; caption?: Spec }>;
  aliases: Partial<Record<PaymentStatus, string[]>>;
  outcomes: Record<string, [PaymentStatus, PaymentStatus]>;
};
export declare const STATUSES: PaymentStatus[];
export declare const TONES: Tone[];
export declare function normalise(code: string | number | null | undefined, opts?: NormaliseOptions): PaymentStatus | null;
export declare const normalize: typeof normalise;
export declare function resolveState(status: string, opts?: NormaliseOptions & { fallback?: string }): ResolvedState;
