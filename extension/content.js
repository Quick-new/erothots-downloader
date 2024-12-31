(function () {
  function scanPageForVideos() {
    const videoLinks = [];
    const videoElements = document.querySelectorAll("a.video");
    videoElements.forEach((el) => {
      const href = el.href;
      const titleElement = el.querySelector("h3.title");
      const imgElement = el.querySelector("img");
      const title = titleElement ? titleElement.innerText.trim() : "Untitled";
      const thumbnail = imgElement ? imgElement.src : "";
      videoLinks.push({ title, href, thumbnail });
    });
    return videoLinks;
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === "get_videos") {
      const videos = scanPageForVideos();
      sendResponse({ videos });
    }
  });

  const observer = new MutationObserver(() => {
    // Potentially re-scan if new content is loaded
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
