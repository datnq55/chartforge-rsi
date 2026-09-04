chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_RSI_MTF" });
  } catch (_) {
    // The content script only exists on supported Binance pages.
  }
});
