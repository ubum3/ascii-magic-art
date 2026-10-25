import type { CSSProperties, ReactNode, ReactElement } from "react";
import type { LookProps } from "ascii-magic-art-react";
import type { NormaliseOptions } from "./index.js";

export interface PaymentStateProps extends LookProps, NormaliseOptions {
  /** A status, an alias or a PSP event code (see normalise). */
  status: string;
  /** The status to show when `status` is unknown; without it an unknown status throws. */
  fallback?: string;
  /** A heading under the art. Defaults to the status label; null hides it (the label stays for screen readers). */
  title?: ReactNode | null;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  /** Font size of the art in px or any CSS length. */
  size?: number | string;
  /** Font size of the caption under the art, when the status has one. */
  captionSize?: number | string;
  as?: "h1" | "h2" | "h3" | "p";
  speed?: number;
  still?: boolean;
  paused?: boolean;
  className?: string;
  style?: CSSProperties;
}

export declare function PaymentState(props: PaymentStateProps): ReactElement;
export { resolveState, normalise, STATUSES } from "./index.js";
