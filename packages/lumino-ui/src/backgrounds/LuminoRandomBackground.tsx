"use client";
/*
 * LuminoRandomBackground: a different Lumino background on every load. The server
 * HTML (and the first client render) is the static brand fallback, so hydration
 * matches; after mount it picks one, never the one shown last in this tab, and
 * loads only that one.
 */
import { useEffect, useState, type ComponentType } from "react";
import { BackgroundFrame, type LuminoBackgroundProps } from "./frame.js";
import { LUMINO_BACKGROUNDS, type BackgroundEntry } from "./registry.js";

const LAST = "lumino-ui:last-background";

export interface LuminoRandomBackgroundProps extends LuminoBackgroundProps {
  /** Only pick from these ids. Default all. */
  include?: readonly string[];
  /** Never pick these ids. */
  exclude?: readonly string[];
  /** Always show this id (for testing), if it exists. */
  pick?: string;
  /** Called with the entry picked, once it is chosen. */
  onPick?: (entry: BackgroundEntry) => void;
}

function readLast() {
  try {
    return sessionStorage.getItem(LAST);
  } catch {
    return null;
  }
}

function writeLast(id: string) {
  try {
    sessionStorage.setItem(LAST, id);
  } catch {
    /* private mode or blocked storage: repeats are allowed then */
  }
}

/** Choose a background: `pick` if it is in the pool, else a random one that isn't `last` (when there is a choice). */
export function chooseBackground(pool: readonly BackgroundEntry[], last: string | null, pick?: string, random = Math.random): BackgroundEntry | undefined {
  const pinned = pick ? pool.find((b) => b.id === pick) : undefined;
  if (pinned) return pinned;
  const fresh = pool.length > 1 ? pool.filter((b) => b.id !== last) : pool;
  return fresh[Math.floor(random() * fresh.length)];
}

/** Fills its container with a randomly chosen Lumino background, behind your content. */
export function LuminoRandomBackground({ include, exclude, pick, onPick, children, ...props }: LuminoRandomBackgroundProps) {
  const [C, setC] = useState<ComponentType<LuminoBackgroundProps> | null>(null);
  useEffect(() => {
    const pool = LUMINO_BACKGROUNDS.filter((b) => (!include || include.includes(b.id)) && !exclude?.includes(b.id));
    const entry = chooseBackground(pool, readLast(), pick);
    if (!entry) return undefined;
    writeLast(entry.id);
    onPick?.(entry);
    let live = true;
    entry.load().then(
      (c) => live && setC(() => c),
      (err) => console.warn(`lumino-ui: could not load background ${entry.id}`, err),
    );
    return () => {
      live = false;
    };
    // Chosen once per mount: a new pick on every render would flicker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (C) return <C {...props}>{children}</C>;
  const { paused: _p, speed: _s, quality: _q, dpr: _d, ...frame } = props;
  return <BackgroundFrame {...frame} ready={false} art={null}>{children}</BackgroundFrame>;
}
