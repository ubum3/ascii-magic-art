import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = { title: "ascii-magic-art-react demo" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>
          <Link href="/">Gallery</Link>
          <Link href="/hero">Hero</Link>
          <Link href="/states">States</Link>
          <Link href="/custom">Custom pieces</Link>
          <Link href="/lumino">Lumino</Link>
          <Link href="/space">Space</Link>
          <Link href="/orbit">Orbit</Link>
          <Link href="/shaders">Shaders</Link>
          <Link href="/gradients">Gradients</Link>
          <Link href="/reactbits">React Bits</Link>
          <Link href="/sign-in">Sign in</Link>
          <Link href="/extras">Extras</Link>
          <Link href="/nope">404</Link>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
