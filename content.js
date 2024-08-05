chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scrape") {
    scrapeContent()
      .then(sendResponse)
      .catch((error) => {
        console.error("Error during scraping:", error);
        sendResponse({ success: false, message: error.message });
      });
    // Keeps the message channel open for async response
    return true;
  }
});

async function scrapeContent() {
  try {
    console.log("Scraping process has started.");

    const element =
      document.querySelector(
        "div.problem-statement-container div.challenge-body-html",
      ) ||
      document.querySelector(
        "div.layout-pane.coding-question__question-pane.layout-pane--primary.layout-pane--smooth div.coding-question__left-pane",
      );

    if (!element) {
      throw new Error("Content not found on the page.");
    }

    const content = element.innerText.trim();
    console.log("Raw content scraped:", content);

    const languageElement = document.querySelector(
      "div.custom-select.select-language div.css-1hwfws3",
    );
    const language = languageElement ? languageElement.textContent.trim() : "";

    const codeElements = document.querySelectorAll(
      "div.monaco-scrollable-element.editor-scrollable.vs.mac div.view-line",
    );
    const code = Array.from(codeElements)
      .map((el) => el.textContent)
      .join("\n")
      .trim();

    const formattedContent = await formatContent(content, language, code);
    console.log("Formatted content:", formattedContent);

    return {
      success: true,
      message: "Content has been formatted.",
      formattedContent: formattedContent,
    };
  } catch (error) {
    console.error("Error during scraping:", error);
    throw error;
  }
}

async function formatContent(content, language, code) {
  try {
    const response = await fetch("http://localhost:8005/prometheusHackerRank", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content, language, code }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.formattedContent;
  } catch (error) {
    console.error("Error in formatContent:", error);
    throw new Error(
      "Error formatting content. Please check the console for details.",
    );
  }
}
