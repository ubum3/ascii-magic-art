import { AsciiHero } from "ascii-magic-art-react/server";

export default function HeroPage() {
  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <AsciiHero piece="synthwave-grid" className="hero" dim={0.45}>
        <div className="hero-copy">
          <h1>Build something weird</h1>
          <p>fit=&quot;cover&quot;: the piece fills the box edge to edge. Resize the window.</p>
        </div>
      </AsciiHero>
      <AsciiHero piece="spinning-torus" fit="contain" className="hero" bg="#0c0a1d" look="dots">
        <div className="hero-copy">
          <h1>Contained</h1>
          <p>fit=&quot;contain&quot; with the dots look: the whole piece, as big as it fits.</p>
        </div>
      </AsciiHero>
    </div>
  );
}
