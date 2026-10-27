import Link from "next/link";
import { LuminoDonut } from "lumino-ui";
import { LUMINO_BACKGROUNDS } from "lumino-ui/backgrounds";
import { LuminoGlassMark } from "lumino-ui/lumino-glass-mark";
import { Live } from "../lumino-bg/Live";

export const metadata = { title: "Lumino" };

export default function LuminoPage() {
  return (
    <>
      <h1>Lumino</h1>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 32 }}>
        <LuminoDonut size={12} bg="#0b0b10" />
        <LuminoGlassMark size={320} />
      </div>
      <h2>Backgrounds</h2>
      <p style={{ opacity: 0.7 }}>
        {LUMINO_BACKGROUNDS.length} backgrounds. Click one for full screen; <Link href="/sign-in">/sign-in</Link> picks one at random, and{" "}
        <Link href="/lumino-bg/perf">/lumino-bg/perf</Link> times each one.
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
    </>
  );
}
