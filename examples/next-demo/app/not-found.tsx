import Link from "next/link";
import { AsciiNotFound } from "ascii-magic-art-react";

export default function NotFound() {
  return (
    <AsciiNotFound
      size={10}
      as="h1"
      title="Lost in space"
      description="There is nothing at this address."
      action={<Link className="button" href="/">Back to the gallery</Link>}
      style={{ marginTop: "3rem" }}
    />
  );
}
