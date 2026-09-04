import { readFile, writeFile } from "node:fs/promises";

const sourceUrl = new URL("../content.js", import.meta.url);
const outputUrl = new URL("../web/js/canonical-content.js", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const banner = "// GENERATED from ../../content.js by scripts/build-pwa-canonical.mjs. Do not edit.\n";

await writeFile(outputUrl, banner + source, "utf8");
console.log(`Generated ${outputUrl.pathname} from content.js (${source.length} chars).`);
