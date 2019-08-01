chrome.browserAction.onClicked.addListener(()=>{
  chrome.runtime.openOptionsPage()
});
window.reload = chrome.runtime.reload

chrome.runtime.onInstalled.addListener( (info) => {
  console.log('oninstalled',info)
  chrome.runtime.openOptionsPage()
})

// main()
