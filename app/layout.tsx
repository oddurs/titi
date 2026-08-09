import type { Metadata, Viewport } from "next";
import { Barlow } from "next/font/google";
import "./globals.css";

/**
 * Two typographic worlds, the way a real instrument has them: the hardware is
 * lettered in one face, the display in another.
 *
 * Barlow is the hardware — a low-contrast grotesque from the signage and
 * licence-plate lineage. It is slightly narrow, which is what lets "stat plot"
 * sit on a keycap without shrinking.
 *
 * The display has no typeface at all: it draws from a 5×7 character ROM in
 * lib/display/glyphs.ts, the way the device it is modelled on does. It once
 * carried a webfont as the panel's fallback, which was a download for glyphs
 * the ROM already has — scripts/glyphs.test.ts proves the coverage — so the
 * small amount of monospace chrome now takes the system face instead.
 */
const ui = Barlow({
  variable: "--font-ui",
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
      <body className={ui.variable}>
        {children}
      </body>
    </html>
  );
}
