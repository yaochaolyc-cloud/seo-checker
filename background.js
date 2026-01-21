// background.js
chrome.webRequest.onCompleted.addListener(
  (details) => {
    chrome.storage.local.set({ statusCode: details.statusCode });
  },
  { urls: ["<all_urls>"] }
);