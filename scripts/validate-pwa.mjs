import{readFile,readdir}from"node:fs/promises";import{join}from"node:path";import{fileURLToPath}from"node:url";
const root=new URL("../web/",import.meta.url),required=["index.html","styles.css","manifest.webmanifest","sw.js","assets/icon.svg","firebase-config.js","js/app.js","js/config.js","js/math.js","js/storage.js","js/binance.js","js/chart.js","js/firebase-sync.js","js/sync-core.js"];
for(const path of required)await readFile(new URL(path,root));
const manifest=JSON.parse(await readFile(new URL("manifest.webmanifest",root),"utf8"));if(manifest.start_url!=="./"||manifest.scope!=="./"||manifest.display!=="standalone")throw new Error("Invalid Pages-relative PWA manifest");
const sw=await readFile(new URL("sw.js",root),"utf8");for(const path of required.filter(x=>!["sw.js"].includes(x)))if(!sw.includes(`\"./${path}\"`)&&!sw.includes(`\"./\"`))throw new Error(`Service worker misses ${path}`);
const css=await readFile(new URL("styles.css",root),"utf8");if(!css.includes(".replay-controls[hidden]"))throw new Error("hidden replay controls must not override the hidden attribute");
const html=await readFile(new URL("index.html",root),"utf8");for(const tool of["fib","long","trend","dateRange","priceRange","text"])if(!html.includes(`data-tool="${tool}"`))throw new Error(`Missing drawing tool ${tool}`);
async function walk(dir){let files=[];for(const item of await readdir(dir,{withFileTypes:true})){const p=join(dir,item.name);files=item.isDirectory()?files.concat(await walk(p)):files.concat(p)}return files}
for(const file of await walk(fileURLToPath(root))){if(!/\.(js|html|css)$/.test(file))continue;const source=await readFile(file,"utf8");if(/\bchrome\s*\./.test(source))throw new Error(`Chrome API found in PWA: ${file}`)}
console.log(`PWA manifest ${manifest.name}; ${required.length} app-shell files validated; no Chrome API usage.`);
