document.addEventListener("DOMContentLoaded", function () {
  const statusDiv = document.getElementById("status");
  const syncSection = document.getElementById("sync-section");
  const formattedContentTextarea = document.getElementById("formattedContent");
  const copyButton = document.getElementById("copyButton");
  const solutionInput = document.getElementById("solutionInput");
  const solveButton = document.getElementById("solveButton");
  const aiSolution = document.getElementById("aiSolution");
  const copySolutionButton = document.getElementById("copySolutionButton");

  // Load saved content
  chrome.storage.local.get(
    ["formattedContent", "userSolution", "aiSolution"],
    function (result) {
      if (result.formattedContent)
        formattedContentTextarea.value = result.formattedContent;
      if (result.userSolution) solutionInput.value = result.userSolution;
      if (result.aiSolution) aiSolution.value = result.aiSolution;
    },
  );

  // Save content when it changes
  formattedContentTextarea.addEventListener("input", saveContent);
  solutionInput.addEventListener("input", saveContent);
  aiSolution.addEventListener("input", saveContent);

  function saveContent() {
    chrome.storage.local.set({
      formattedContent: formattedContentTextarea.value,
      userSolution: solutionInput.value,
      aiSolution: aiSolution.value,
    });
  }

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    let currentTab = tabs[0];
    if (currentTab.url.includes("hackerrank.com")) {
      chrome.tabs.sendMessage(
        currentTab.id,
        { action: "scrape" },
        function (response) {
          if (chrome.runtime.lastError) {
            showError("An error occurred. Please try again.");
          } else if (response && response.success) {
            showSuccess(response.message, response.formattedContent);
          } else if (response) {
            showError(response.message);
          } else {
            showError(
              "No response from the page. Please refresh and try again.",
            );
          }
        },
      );
    } else {
      showError("This extension only works on HackerRank pages.");
    }
  });

  copyButton.addEventListener("click", function () {
    formattedContentTextarea.select();
    document.execCommand("copy");
    copyButton.textContent = "Copied!";
    setTimeout(() => {
      copyButton.textContent = "Copy to clipboard";
    }, 2000);
  });

  solveButton.addEventListener("click", async function () {
    const problemStatement = formattedContentTextarea.value;
    const userSolution = solutionInput.value;

    if (!problemStatement || !userSolution) {
      showError(
        "Please ensure both the problem statement and your solution are present.",
      );
      return;
    }

    showStatus("Generating solution...");
    try {
      const response = await fetch("http://localhost:8005/solveProblem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ problemStatement, userSolution }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      aiSolution.value = data.solution;
      // Save the new AI solution
      saveContent();
      showSuccess("Solution generated successfully!");
    } catch (error) {
      showError("Error generating solution: " + error.message);
    }
  });

  copySolutionButton.addEventListener("click", function () {
    const cleanedSolution = aiSolution.value.replace(
      /```[\s\S]*?```/g,
      function (match) {
        return match.replace(/```/g, "").trim();
      },
    );
    const tempTextArea = document.createElement("textarea");
    tempTextArea.value = cleanedSolution;
    document.body.appendChild(tempTextArea);
    tempTextArea.select();
    document.execCommand("copy");
    document.body.removeChild(tempTextArea);
    copySolutionButton.textContent = "Copied!";
    setTimeout(() => {
      copySolutionButton.textContent = "Copy solution";
    }, 2000);
  });

  function showSuccess(message, formattedContent = null) {
    statusDiv.textContent = message;
    statusDiv.className = "status success";
    statusDiv.style.display = "block";
    syncSection.style.display = "block";
    if (formattedContent) {
      formattedContentTextarea.value = formattedContent;
      // Save the new formatted content
      saveContent();
    }
  }

  function showError(message) {
    statusDiv.textContent = message;
    statusDiv.className = "status error";
    statusDiv.style.display = "block";
  }

  function showStatus(message) {
    statusDiv.textContent = message;
    statusDiv.className = "status";
    statusDiv.style.display = "block";
  }
});
