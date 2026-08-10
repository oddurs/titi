import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { GLYPHS } from "../lib/display/glyphs";

/**
 * The app icons, drawn rather than designed.
 *
 * The panel has no typeface — it has a 5×7 ROM — so the icon uses the same
 * table the device uses. That makes it reproducible from source, keeps it in
 * step if a glyph is ever redrawn, and means there is no binary in the repo
 * that nobody can regenerate.
 *
 *   npx tsx scripts/icons.ts
 */

const SHELL = [0x1a, 0x1d, 0x22];
const GLASS = [0x07, 0x0e, 0x16];
const OFF_DOT = [0x10, 0x1f, 0x2c];
const INK = [0xd8, 0xe8, 0xff];

/** A tiny PNG writer — RGBA, no filtering, one IDAT. */
function png(width: number, height: number, rgba: Uint8Array): Buffer {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }

  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  const crc = (buf: Buffer) => {
    let c = -1;
    for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, "ascii");
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc(Buffer.concat([head.subarray(4), data])), 0);
    return Buffer.concat([head, data, tail]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour with alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * A slab of shell with a lit panel in it, reading "ti".
 *
 * Everything is measured in dots and then blown up by an integer, so the icon
 * quantises exactly the way the display does — no resampling anywhere.
 */
function draw(size: number, maskable: boolean): Uint8Array {
  const px = new Uint8Array(size * size * 4);
  const set = (x: number, y: number, c: number[], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = a;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) set(x, y, SHELL);
  }

  // A maskable icon must survive being cropped to a circle, so it keeps more
  // margin; the plain one fills the square the way an app icon should.
  const margin = Math.round(size * (maskable ? 0.28 : 0.16));
  const glassX = margin;
  const glassY = margin;
  const glassW = size - margin * 2;
  const glassH = size - margin * 2;
  for (let y = glassY; y < glassY + glassH; y++) {
    for (let x = glassX; x < glassX + glassW; x++) set(x, y, GLASS);
  }

  // "ti" at 5×7 per character in a 6×9 cell, scaled to fill the glass.
  const text = "ti";
  const cellW = 6;
  const cellH = 9;
  const scale = Math.max(1, Math.floor(Math.min(glassW / (cellW * text.length), glassH / cellH)));
  const artW = cellW * text.length * scale;
  const artH = cellH * scale;
  const originX = glassX + Math.round((glassW - artW) / 2);
  const originY = glassY + Math.round((glassH - artH) / 2);

  // the unlit grid, so the panel reads as a panel even at 48 px
  for (let dy = 0; dy < glassH / scale; dy++) {
    for (let dx = 0; dx < glassW / scale; dx++) {
      const x = glassX + dx * scale;
      const y = glassY + dy * scale;
      for (let j = 0; j < scale - 1; j++) {
        for (let i = 0; i < scale - 1; i++) set(x + i, y + j, OFF_DOT);
      }
    }
  }

  text.split("").forEach((ch, n) => {
    const rows = GLYPHS[ch];
    if (!rows) throw new Error(`no glyph for ${ch}`);
    rows.forEach((row, ry) => {
      [...row].forEach((cell, rx) => {
        if (cell !== "#") return;
        const x = originX + (n * cellW + rx) * scale;
        const y = originY + (ry + 1) * scale;
        for (let j = 0; j < scale - 1; j++) {
          for (let i = 0; i < scale - 1; i++) set(x + i, y + j, INK);
        }
      });
    });
  });

  return px;
}

const targets: [string, number, boolean][] = [
  ["public/icon-192.png", 192, false],
  ["public/icon-512.png", 512, false],
  ["public/icon-maskable-512.png", 512, true],
  ["public/apple-touch-icon.png", 180, false],
];

for (const [path, size, maskable] of targets) {
  writeFileSync(path, png(size, size, draw(size, maskable)));
  console.log(`wrote ${path} (${size}×${size})`);
}
