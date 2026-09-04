import{chromium}from"playwright-core";

const base=process.argv[2]||"http://127.0.0.1:4173/",executablePath=process.env.CHARTFORGE_CHROME||"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",browser=await chromium.launch({executablePath,headless:true});
try{
  for(const symbol of["BTCUSDT","ETHUSDT","DOGEUSDT"]){
    const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    await page.goto(`${base}?symbol=${symbol}`,{waitUntil:"domcontentloaded"});
    await page.waitForFunction(expected=>document.title.includes(`| ${expected} | ChartForge RSI`),symbol,{timeout:30000});
    await page.waitForFunction(()=>document.querySelector("#binance-rsi-mtf-host")?.shadowRoot?.querySelector(".status")?.dataset.state==="live",null,{timeout:30000});
    if(errors.length)throw new Error(`${symbol} runtime errors: ${errors.join("; ")}`);
    console.log(`${symbol}: ${await page.title()}`);await page.close();
  }
  for(const width of[1280,390,320]){
    const page=await browser.newPage({viewport:{width,height:800}});await page.goto(`${base}?symbol=BTCUSDT`,{waitUntil:"domcontentloaded"});
    const layout=await page.waitForFunction(()=>{const shadow=document.querySelector("#binance-rsi-mtf-host")?.shadowRoot,status=shadow?.querySelector(".status"),auth=shadow?.querySelector(".pwa-auth"),topbar=shadow?.querySelector(".topbar");if(!status||!auth)return null;const s=status.getBoundingClientRect(),a=auth.getBoundingClientRect(),t=topbar.getBoundingClientRect();return{order:[...topbar.children].indexOf(status)<[...topbar.children].indexOf(auth),separated:s.right<=a.left,right:a.right<=t.right+1,visible:s.width>0&&a.width>0}},null,{timeout:30000}).then(handle=>handle.jsonValue());
    if(!layout.order||!layout.separated||!layout.right||!layout.visible)throw new Error(`${width}px layout failed: ${JSON.stringify(layout)}`);
    console.log(`${width}px: status then account, right aligned`);await page.close();
  }
}finally{await browser.close()}
