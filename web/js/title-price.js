const FORMATTERS=new Map();
export function pricePrecision(symbol,price){
  if(symbol==="DOGEUSDT"||price<1)return price>=.1?5:price>=.01?6:8;
  return 2;
}
export function formatLivePrice(symbol,value){
  const price=Number(value);if(!Number.isFinite(price)||price<0)return null;
  const digits=pricePrecision(symbol,price),key=`${digits}`,formatter=FORMATTERS.get(key)||new Intl.NumberFormat("en-US",{minimumFractionDigits:digits,maximumFractionDigits:digits});
  FORMATTERS.set(key,formatter);return formatter.format(price);
}
export function createLiveTitleController(document,symbol){
  let lastTitle="",lastCandleTime=-Infinity,lastSeriesKey=null;
  const set=title=>{if(title!==lastTitle){document.title=title;lastTitle=title}};
  set(`${symbol} | ChartForge RSI`);
  return{update(value,candleTime,seriesKey="default"){if(seriesKey!==lastSeriesKey){lastSeriesKey=seriesKey;lastCandleTime=-Infinity}const time=Number(candleTime);if(Number.isFinite(time)&&time<lastCandleTime)return;if(Number.isFinite(time))lastCandleTime=time;const price=formatLivePrice(symbol,value);if(price)set(`${price} | ${symbol} | ChartForge RSI`)},get title(){return lastTitle}};
}
