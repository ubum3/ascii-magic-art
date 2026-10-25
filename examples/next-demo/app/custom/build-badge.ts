import { Grid, palette, definePiece, ramp, RAMPS } from "ascii-magic-art-react/kit";

const W = 44, H = 7;

// A piece of your own: a build badge with a progress bar that fills and passes.
export default definePiece(
  { slug: "build-badge", name: "Build Badge", cols: W, rows: H, fps: 12, palette: palette(["#7ee787", "#8b949e", "#f2cc60"]) },
  () => {
    const g = new Grid(W, H);
    return (t) => {
      g.clear();
      const run = Math.floor(t / 6) + 1, p = Math.min(1, (t % 6) / 4.5), done = p >= 1;
      g.box(0, 0, W, H, "round", "1");
      g.text(3, 1, `build #${String(run).padStart(4, "0")}`, "1");
      g.text(W - 14, 1, done ? "passing ✓" : "running" + ".".repeat(1 + (Math.floor(t * 3) % 3)), done ? "0" : "2");
      const bar = W - 6, filled = Math.round(bar * p);
      for (let i = 0; i < bar; i++) g.set(3 + i, 3, i < filled ? "█" : ramp(0.15, RAMPS.blocks), i < filled ? (done ? "0" : "2") : "1");
      g.text(3, 5, `${Math.round(p * 100)}%`.padStart(4), "1");
      return g.frame();
    };
  },
);
