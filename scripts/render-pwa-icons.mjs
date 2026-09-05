import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright-core";

const root = path.resolve(import.meta.dirname, "..");
const source = path.join(root, "web", "assets", "icon.svg");
const candidates = process.platform === "win32"
  ? [
      path.join(process.env.ProgramFiles || "", "Google", "Chrome", "Application", "chrome.exe"),
      path.join(process.env["ProgramFiles(x86)"] || "", "Google", "Chrome", "Application", "chrome.exe"),
      path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
    ]
  : ["/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];

let executablePath;
for (const candidate of candidates) {
  if (!candidate) continue;
  try {
    await access(candidate);
    executablePath = candidate;
    break;
  } catch {}
}
if (!executablePath) throw new Error("Chrome/Chromium is required to render PWA icons");

const browser = await chromium.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage();
  const sourceUrl = `data:image/svg+xml;base64,${(await readFile(source)).toString("base64")}`;
  for (const size of [180, 192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}img{display:block;width:100%;height:100%}</style><img src="${sourceUrl}">`);
    await page.locator("img").screenshot({ path: path.join(root, "web", "assets", `icon-${size}.png`) });
  }
} finally {
  await browser.close();
}
