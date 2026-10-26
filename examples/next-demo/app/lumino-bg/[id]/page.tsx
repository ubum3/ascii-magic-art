import { notFound } from "next/navigation";
import { LUMINO_BACKGROUNDS, findBackground } from "lumino-ui/backgrounds";
import { Live } from "../Live";
import { Card } from "../../sign-in/Card";

export function generateStaticParams() {
  return LUMINO_BACKGROUNDS.map((b) => ({ id: b.id }));
}

/** One background, full screen over the nav. ?card=1 puts the sign-in card on it, ?dim=0.4 dims the middle. */
export default async function OneBackground({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ card?: string; dim?: string }> }) {
  const { id } = await params, q = await searchParams;
  if (!findBackground(id)) notFound();
  return (
    <Live id={id} dim={q.dim ? Number(q.dim) : undefined} style={{ position: "fixed", inset: 0, zIndex: 100 }}>
      {q.card ? <Card /> : null}
    </Live>
  );
}
