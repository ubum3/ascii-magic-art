import Link from "next/link";
import { LUMINO_BACKGROUNDS } from "lumino-ui/backgrounds";
import { Live } from "./Live";

export const metadata = { title: "Lumino backgrounds" };

export default function LuminoBackgrounds() {
  return (
    <div>
      <h1>Lumino backgrounds</h1>
      <p style={{ opacity: 0.7 }}>
        {LUMINO_BACKGROUNDS.length} backgrounds. Click one for full screen; <Link href="/sign-in">/sign-in</Link> picks one at random.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
        {LUMINO_BACKGROUNDS.map((b) => (
          <Link key={b.id} href={`/lumino-bg/${b.id}`} style={{ color: "inherit", textDecoration: "none" }}>
            <Live id={b.id} lazy style={{ height: 240, borderRadius: 12, overflow: "hidden" }} />
            <div style={{ padding: "8px 2px" }}>
              <strong>{b.name}</strong> <span style={{ opacity: 0.5 }}>· {b.author}</span>
              <div style={{ opacity: 0.7, fontSize: 14 }}>{b.description}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
