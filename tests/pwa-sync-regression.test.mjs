import test from"node:test";
import assert from"node:assert/strict";
import{sanitizeCloudSettingValues}from"../web/js/firebase-sync.js";
import{createLiveTitleController,formatLivePrice}from"../web/js/title-price.js";

const deviceId="device-fixture-123",entry=value=>({value,revision:4,updatedAt:1788557000000,deviceId});
test("legacy local-only settings are removed before a Firestore transaction retries",()=>{
  const clean=sanitizeCloudSettingValues({lastSymbol:entry("BTCUSDT"),timeframe:entry("H4"),panBars:entry(29),replay:entry({active:true}),historyPast:entry([])});
  assert.deepEqual(Object.keys(clean),["lastSymbol","timeframe"]);
});

test("malformed legacy cloud entries are removed without discarding valid siblings",()=>{
  const clean=sanitizeCloudSettingValues({visibleBars:entry(240),pricePercent:entry(64),priceScale:entry(100),drawingDefaults:entry({trend:{color:"#f23645",lineWidth:8,dash:"dot"},text:{color:"#111111",fontSize:64}})});
  assert.deepEqual(Object.keys(clean),["visibleBars","pricePercent","drawingDefaults"]);
});

test("live title precision is adaptive for BTC, ETH and DOGE",()=>{
  assert.equal(formatLivePrice("BTCUSDT",79757.7),"79,757.70");
  assert.equal(formatLivePrice("ETHUSDT",4321.2),"4,321.20");
  assert.equal(formatLivePrice("DOGEUSDT",.21456),"0.21456");
});

test("live title resets per symbol and skips unchanged websocket prices",()=>{
  let writes=0,current="";const document={get title(){return current},set title(value){current=value;writes++}},controller=createLiveTitleController(document,"BTCUSDT");
  assert.equal(document.title,"BTCUSDT | ChartForge RSI");
  controller.update("79757.70",100,"4h");controller.update(79757.7,100,"4h");controller.update("79758.01",100,"4h");controller.update("1",99,"4h");
  assert.equal(document.title,"79,758.01 | BTCUSDT | ChartForge RSI");assert.equal(writes,3);
  controller.update("79760",90,"1d");assert.equal(document.title,"79,760.00 | BTCUSDT | ChartForge RSI");
  createLiveTitleController(document,"DOGEUSDT");assert.equal(document.title,"DOGEUSDT | ChartForge RSI");
});
