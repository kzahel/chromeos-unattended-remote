chrome.browserAction.onClicked.addListener(()=>{
  chrome.runtime.openOptionsPage()
});
window.reload = chrome.runtime.reload

// main()
