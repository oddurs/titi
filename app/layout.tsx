import type { Metadata, Viewport } from "next";
import { Barlow, IBM_Plex_Mono, Silkscreen } from "next/font/google";
import "./globals.css";

/**
 * Two typographic worlds, the way a real instrument has them: the hardware is
 * lettered in one face, the display in another.
 *
 * Barlow is the hardware — a low-contrast grotesque from the signage and
 * licence-plate lineage. It is slightly narrow, which is what lets "stat plot"
 * sit on a keycap without shrinking.
 *
 * The display is a dot-matrix panel, so it is lettered in Silkscreen — a face
 * drawn on a pixel grid rather than smoothed onto one. Glyphs Silkscreen does
 * not carry (π, √, θ, subscripts) fall back to IBM Plex Mono and are quantised
 * by the panel's threshold, so every source of ink ends up on the same grid.
 */
const ui = Barlow({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const display = Silkscreen({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "titi — graphing calculator",
  description:
    "A scientific and graphing calculator with the TI-84's keys and none of its pixels.",
};

export const viewport: Viewport = {
  themeColor: "#08090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${ui.variable} ${display.variable} ${mono.variable}`}>
        {children}
      </body>
    </html>
  );
}
