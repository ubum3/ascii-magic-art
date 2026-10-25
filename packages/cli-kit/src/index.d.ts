import type { Writable } from "node:stream";

export type Mode = "anim" | "static" | "plain";
export type Out = Pick<Writable, "write"> & { isTTY?: boolean; columns?: number; rows?: number; on?: Function; off?: Function };
/** An extras spec (see ascii-magic-art-extras), a piece module, { slug }, { text, ...textSpec }, or a string (a slug if one exists, else words). */
export type IntroSource = string | { kind: string; [k: string]: unknown } | { slug: string } | { text: string; [k: string]: unknown } | { meta: object; default(): Function };

export interface IntroOptions {
  /** Seconds it moves before it rests; 0 prints it still. The text kind's entrance by default, else 1.5. */
  seconds?: number;
  /** A line under it, dimmed. */
  tagline?: string;
  /** process.stdout by default. */
  out?: Out;
  /** State for a data kind (progress, sparkline, ticker, celebrate). */
  state?: Record<string, unknown>;
  env?: NodeJS.ProcessEnv;
}
export interface Introduced { cols: number; rows: number; mode: Mode; interrupted: boolean }
export function intro(src: IntroSource, options?: IntroOptions): Promise<Introduced>;

export interface Progress { update(value: number, label?: string): void; done(message?: string): void }
export function progress(options?: { label?: string; cols?: number; out?: Out; env?: NodeJS.ProcessEnv }): Progress;
export interface Spinner { text(label: string): void; succeed(message?: string): void; fail(message?: string): void }
export function spinner(label?: string, options?: { out?: Out; env?: NodeJS.ProcessEnv }): Spinner;

export function mode(stream?: Out, env?: NodeJS.ProcessEnv): Mode;
export function isCI(env?: NodeJS.ProcessEnv): boolean;
export function colorOn(env?: NodeJS.ProcessEnv): boolean;
