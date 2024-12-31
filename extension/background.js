chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === "download_videos") {
    const videoData = request.videos;
    if (videoData && videoData.length > 0) {
      processVideoPages(videoData);
      sendResponse({ status: "started" });
    } else {
      sendResponse({ status: "no_links" });
    }
    return true;
  } else if (request.message === "get_mp4_link") {
    if (request.href) {
      getMp4LinkFromPage(request.href).then((mp4Url) => {
        sendResponse({ mp4Url });
      }).catch((error) => {
        console.error("MP4 link error:", error);
        sendResponse({ mp4Url: null });
      });
      return true;
    }
  }
});

// Process each page to find an MP4 link and download
async function processVideoPages(videoData) {
  for (const video of videoData) {
    const { href, title } = video;
    try {
      const mp4Url = await getMp4LinkFromPage(href);
      if (mp4Url) {
        const filename = sanitizeFilename(title) + "_" + Date.now() + ".mp4";
        const alreadyDownloaded = await checkIfDownloaded(mp4Url);
        if (alreadyDownloaded) continue;
        chrome.downloads.download({
          url: mp4Url,
          filename,
          conflictAction: "uniquify",
          saveAs: false
        });
        await delay(2000); 
      } else {
        console.error("No MP4 link found for", href);
      }
    } catch (error) {
      console.error("Failed to process", href, error);
    }
  }
}

// Extract MP4 link from the page in a background tab
function getMp4LinkFromPage(videoPageUrl) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url: videoPageUrl, active: false }, (tab) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      const listener = (tabId, changeInfo, updatedTab) => {
        if (tabId === tab.id && changeInfo.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: extractMp4LinkFromPage
          }, (results) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              const [result] = results;
              if (result && result.result) {
                const absoluteMp4 = new URL(result.result, videoPageUrl).href;
                resolve(absoluteMp4);
              } else {
                resolve(null);
              }
            }
            chrome.tabs.remove(tab.id);
          });
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  });
}

// The script injected into the page to find a .mp4
function extractMp4LinkFromPage() {
  try {
    const sources = document.querySelectorAll('source[src$=".mp4"]');
    if (sources.length > 0) return sources[0].src;
    const videoTag = document.querySelector('video[src$=".mp4"]');
    if (videoTag) return videoTag.src;
    const links = document.querySelectorAll('a[href$=".mp4"]');
    if (links.length > 0) return links[0].href;
    return null;
  } catch (e) {
    return null;
  }
}

// Check if downloaded
function checkIfDownloaded(url) {
  return new Promise((resolve) => {
    chrome.downloads.search({ url }, (results) => {
      resolve(results && results.length > 0);
    });
  });
}

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*]+/g, "").trim();
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
