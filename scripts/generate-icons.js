// Generates icon-192.png and icon-512.png from "DENIZ PWA LOGO.png".
// 512x512 is copied as-is (source is already 512x512).
// 192x192 is resized with sharp.
import sharp from "sharp";
import { copyFileSync, mkdirSync } from "fs";

mkdirSync("public/icons", { recursive: true });

const src = "public/NEW Deniz PWA logo.png";

// 512 — copy the original (already 512x512, zero quality loss)
copyFileSync(src, "public/icons/icon-512.png");
console.log("  copied  public/icons/icon-512.png  (512x512)");

// 192 — resize
await sharp(src)
  .resize(192, 192, { fit: "contain", background: { r: 10, g: 10, b: 15, alpha: 1 } })
  .png()
  .toFile("public/icons/icon-192.png");
console.log("  created public/icons/icon-192.png  (192x192)");

// mono-icon — 96x96 white DH monogram on transparent (for notification badge + icon)
const monoSvg = Buffer.from(`<svg width="96" height="96" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="16" width="11" height="64" rx="2" fill="white"/>
  <path d="M 19 16 C 58 16 58 80 19 80 Z" fill="white"/>
  <rect x="56" y="16" width="10" height="64" rx="2" fill="white"/>
  <rect x="56" y="44" width="21" height="9" fill="white"/>
  <rect x="77" y="16" width="10" height="64" rx="2" fill="white"/>
</svg>`);
await sharp(monoSvg).png().toFile("public/mono-icon.png");
console.log("  created public/mono-icon.png  (96x96 monochrome badge)");
