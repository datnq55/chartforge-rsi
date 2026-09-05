export const APP_VERSION = "0.4.15";
export const ENABLED_SYMBOLS = Object.freeze(["BTCUSDT", "ETHUSDT", "DOGEUSDT"]);
export const TIMEFRAMES = Object.freeze([
  {label:"30m",interval:"30m",ms:1_800_000},{label:"H1",interval:"1h",ms:3_600_000},
  {label:"H2",interval:"2h",ms:7_200_000},{label:"H4",interval:"4h",ms:14_400_000},
  {label:"H8",interval:"8h",ms:28_800_000},{label:"H12",interval:"12h",ms:43_200_000},
  {label:"D",interval:"1d",ms:86_400_000},{label:"3D",interval:"3d",ms:259_200_000},
  {label:"1W",interval:"1w",ms:604_800_000},{label:"2W",interval:"1w",ms:1_209_600_000,biweekly:true},
  {label:"M",interval:"1M",calendar:true}
]);
export const DEFAULT_SYMBOL = ENABLED_SYMBOLS[0];
export const DEFAULT_TIMEFRAME = "H4";
export const PAGES_BASE = "/chartforge-rsi/";

export function validSymbol(value){return ENABLED_SYMBOLS.includes(String(value||"").toUpperCase())}
export function resolveSymbol(search,remembered){
  const requested=new URLSearchParams(search).get("symbol")?.toUpperCase();
  return validSymbol(requested)?requested:validSymbol(remembered)?remembered:DEFAULT_SYMBOL;
}
export function timeframe(label){return TIMEFRAMES.find(x=>x.label===label)||TIMEFRAMES.find(x=>x.label===DEFAULT_TIMEFRAME)}
