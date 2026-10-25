"use client";
/*
 * <PaymentState status="..."/>: the piece for a payment status, with a title,
 * description and action under it, like the ready-made states in
 * ascii-magic-art-react. The wrapper is a polite live region carrying the status
 * label, so the status is never shown by animation alone.
 *
 *   import { PaymentState } from "ascii-magic-art-payment-states/react";
 *   <PaymentState status={event.eventCode} success={event.success} description="We'll email the receipt." />
 *
 * Plain JS (no build step); types in react.d.ts.
 */
import { createElement as h } from "react";
import { AsciiArt } from "ascii-magic-art-react";
import { AsciiSpec } from "ascii-magic-art-react/extras";
import { resolveState } from "./index.js";

const stack = { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "0.75rem", maxWidth: "100%" };
const hidden = { position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 };

export function PaymentState(props) {
  const {
    status, success, fallback, title, description, action, children, size, captionSize,
    as = "h2", className, style, ...art
  } = props;
  const s = resolveState(status, { success, fallback });
  // what is left is for the art: speed, still, paused and the look props
  const play = { size, ...art };
  const heading = title === undefined ? s.label : title;
  return h(
    "div",
    { className, style: { ...stack, ...style }, role: "status", "aria-live": "polite", "data-status": s.status, "data-tone": s.tone },
    s.slug ? h(AsciiArt, { piece: s.slug, ...play }) : h(AsciiSpec, { spec: s.spec, ...play }),
    s.caption ? h(AsciiSpec, { spec: s.caption, ...play, size: captionSize ?? size }) : null,
    heading != null && heading !== false ? h(as, { style: { margin: 0 } }, heading) : h("span", { style: hidden }, s.label),
    description != null ? h("p", { style: { margin: 0, opacity: 0.75 } }, description) : null,
    action ?? null,
    children ?? null,
  );
}

export { resolveState, normalise, STATUSES } from "./index.js";
