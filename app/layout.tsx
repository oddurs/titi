import type { Metadata, Viewport } from "next";
import { Archivo, Epilogue, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const ui = Archivo({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Math is set in a grotesque with a genuinely drawn italic, so variables read
// as variables without falling back to a serif.
const math = Epilogue({
  variable: "--font-math",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
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
  themeColor: "#070a10",
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
      <body className={`${ui.variable} ${math.variable} ${mono.variable}`}>
        {children}
      </body>
    </html>
  );
}
