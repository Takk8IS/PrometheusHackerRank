chrome.action.onClicked.addListener((tab) => {
  if (tab.url.includes("hackerrank.com")) {
    chrome.tabs.sendMessage(tab.id, { action: "scrape" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error sending message to content script:",
          chrome.runtime.lastError,
        );
        alert("An error occurred. Please check the console for details.");
      } else if (response && response.success) {
        alert(response.message);
      } else if (response) {
        alert("Error: " + response.message);
      } else {
        alert("No response from the page. Please refresh and try again.");
      }
    });
  } else {
    alert("This extension works only on hackerrank.com");
  }
});
