import { readFileSync, existsSync } from "node:fs";
import { describe, eq, ok, reportIfMain } from "./harness";

/**
 * The install and offline story, checked from the files themselves.
 *
 * A manifest is easy to get subtly wrong — a renamed icon, an absolute
 * start_url that breaks under the GitHub Pages subpath — and nothing else in
 * the app would notice until someone tried to install it.
 */

const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));

describe("the manifest");
eq("names the app", manifest.name, "titi — graphing calculator");
ok("with a short name for the home screen", manifest.short_name.length <= 12);
eq("opens standalone", manifest.display, "standalone");
ok("and paints its own background while it loads", /^#[0-9a-f]{6}$/i.test(manifest.background_color));
// GitHub Pages serves this from /titi/, so every URL has to be relative.
ok("start_url is relative", manifest.start_url.startsWith("./"));
ok("and so is the scope", manifest.scope.startsWith("./"));
ok("every icon URL is relative", manifest.icons.every((i: { src: string }) => i.src.startsWith("./")));
ok("one of them is maskable", manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable"));

describe("the icons exist and are what they claim");
/** Read width and height out of a PNG's IHDR. */
function pngSize(path: string): [number, number] {
  const buf = readFileSync(path);
  const signature = buf.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") throw new Error(`${path} is not a PNG`);
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}
for (const icon of manifest.icons as { src: string; sizes: string }[]) {
  const path = `public/${icon.src.replace("./", "")}`;
  ok(`${icon.src} is there`, existsSync(path));
  const [w, h] = pngSize(path);
  eq(`${icon.src} is ${icon.sizes}`, `${w}x${h}`, icon.sizes);
}
ok("and there is an apple touch icon", existsSync("public/apple-touch-icon.png"));
eq("at the size iOS asks for", pngSize("public/apple-touch-icon.png").join("x"), "180x180");

describe("the service worker");
const sw = readFileSync("public/sw.js", "utf8");
ok("keeps its cache under one versioned name", /const CACHE = "titi-v\d+"/.test(sw));
ok("only handles GET", sw.includes('request.method !== "GET"'));
ok("leaves other origins alone", sw.includes("url.origin !== self.location.origin"));
ok("prefers the network for pages, so an update lands", sw.includes('request.mode === "navigate"'));
ok("and falls back to the cache when there is none", sw.includes("caches.match(request)"));
ok("it discovers the build's hashed assets rather than listing them", sw.includes("shellUrls"));

reportIfMain(import.meta.url);
