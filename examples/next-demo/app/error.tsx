"use client";
import { AsciiServerError } from "ascii-magic-art-react";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <AsciiServerError
      size={10}
      title="Something went wrong"
      action={<button className="button" onClick={reset}>Try again</button>}
      style={{ marginTop: "3rem" }}
    />
  );
}
