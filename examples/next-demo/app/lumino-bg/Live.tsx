"use client";
import { useEffect, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { findBackground, type LuminoBackgroundProps } from "lumino-ui/backgrounds";

/** Loads one background by id and renders it; with `lazy`, only once it scrolls into view. */
export function Live({ id, style, lazy = false, children, ...props }: LuminoBackgroundProps & { id: string; lazy?: boolean; style?: CSSProperties; children?: ReactNode }) {
  const [C, setC] = useState<ComponentType<LuminoBackgroundProps> | null>(null);
  const [show, setShow] = useState(!lazy);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!lazy || !box.current) return;
    const io = new IntersectionObserver(([e]) => setShow(!!e?.isIntersecting), { rootMargin: "100px" });
    io.observe(box.current);
    return () => io.disconnect();
  }, [lazy]);
  useEffect(() => {
    if (!show) return;
    let live = true;
    findBackground(id)?.load().then((c) => live && setC(() => c));
    return () => {
      live = false;
    };
  }, [id, show]);
  return (
    <div ref={box} style={style}>
      {C && show ? <C {...props}>{children}</C> : <div style={{ width: "100%", height: "100%", background: "#111013" }}>{children}</div>}
    </div>
  );
}
