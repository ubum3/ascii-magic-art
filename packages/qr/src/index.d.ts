export type QrEffect = "assemble" | "reveal" | "matrix" | "glitch" | "none";
export type QrEcc = "L" | "M" | "Q" | "H";

export interface QrOptions {
  /** Entrance effect. Default "assemble"; "none" is a still code. */
  effect?: QrEffect;
  /** Error correction. Default "M"; raised for free when the data still fits. A logo forces "H". */
  ecc?: QrEcc;
  /** Smallest QR version to use (1-40). */
  version?: number;
  /** Quiet zone in modules, at least 4 (the default). */
  quiet?: number;
  /** Colour of the light modules and the quiet zone. Default #f4f4f5. */
  light?: string;
  /** The background it will be shown on: at most a quarter of light's luminance, or it throws. Default #09090b. */
  dark?: string;
  /** Entrance colours. */
  accent?: string;
  ghost?: string;
  /** Seconds until the code is exact and still. Default 1.5. */
  settle?: number;
  /** A short label in a box in the centre. Needs ECC H and at most 15% of the modules. */
  logo?: string;
  /** No entrance at all: the settled code from the first frame. */
  still?: boolean;
  fps?: number;
  slug?: string;
  name?: string;
  note?: string;
}

export interface QrSpec extends QrOptions { kind: "qr"; text?: string; url?: string }

export interface QrInfo { version: number; ecc: QrEcc; size: number; quiet: number; settle: number; dark: string; light: string }

export interface QrMeta {
  slug: string; name: string; category: string; note: string; tags: string[];
  cols: number; rows: number; fps: number; palette: Record<string, string>; still?: boolean; qr: QrInfo;
}

export interface Frame { text: string; color: string }

export declare const QR_EFFECTS: QrEffect[];
export declare const QR_ECC: Record<QrEcc, string>;
export declare function luminance(hex: string): number;
export declare function qrMatrix(text: string, opts?: { ecc?: QrEcc; version?: number; boost?: boolean }): { size: number; version: number; ecc: QrEcc; dark: (x: number, y: number) => boolean };
export declare function qr(spec: QrSpec): { meta: QrMeta; create: () => (t: number) => Frame };
export declare function qrSpec(text: string, opts?: QrOptions & { brand?: string }): QrSpec;
export declare function qrPiece(text: string, opts?: QrOptions & { brand?: string; reducedMotion?: boolean; warn?: boolean }): Readonly<{ meta: QrMeta; default: () => (t: number) => Frame }>;
export declare function qrFrame(text: string, opts?: QrOptions & { brand?: string }): Frame & { palette: Record<string, string>; cols: number; rows: number; qr: QrInfo };
