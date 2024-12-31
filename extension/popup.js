document.addEventListener('DOMContentLoaded', () => {
  const videoList = document.getElementById('videoList');
  const downloadButton = document.getElementById('downloadSelectedButton');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  const searchBar = document.getElementById('searchBar');
  const bookmarksSection = document.getElementById('bookmarksSection');
  const bookmarksList = document.getElementById('bookmarksList');
  let allVideos = [];

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { message: 'get_videos' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        videoList.innerText = 'An error occurred while fetching videos.';
        return;
      }
      if (response && response.videos && response.videos.length > 0) {
        allVideos = response.videos;
        populateVideoList(allVideos);
      } else {
        videoList.innerText = 'No videos found.';
      }
    });
  });

  // Load bookmarks
  chrome.storage.local.get(['bookmarkedVideos'], (data) => {
    if (data.bookmarkedVideos && data.bookmarkedVideos.length > 0) {
      bookmarksSection.style.display = 'block';
      data.bookmarkedVideos.forEach((bm) => {
        addBookmarkToDOM(bm);
      });
    }
  });

  function populateVideoList(videos) {
    videoList.innerHTML = '';
    videos.forEach((video, index) => {
      const item = document.createElement('div');
      item.classList.add('video-item');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.classList.add('video-checkbox');
      checkbox.dataset.index = index;

      const thumbnail = document.createElement('img');
      thumbnail.src = video.thumbnail || 'icon.png';
      thumbnail.alt = video.title;
      // Optional inline preview (click toggles <video>)
      thumbnail.addEventListener('click', () => toggleInlinePreview(video, item));

      const details = document.createElement('div');
      details.classList.add('video-details');

      const titleEl = document.createElement('h3');
      titleEl.textContent = video.title;

      const actions = document.createElement('div');
      actions.classList.add('actions');

      const viewBtn = document.createElement('button');
      viewBtn.textContent = 'View Page';
      viewBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: video.href });
      });

      const playerBtn = document.createElement('button');
      playerBtn.textContent = 'Open Player';
      playerBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage(
          { message: 'get_mp4_link', href: video.href },
          (resp) => {
            if (resp && resp.mp4Url) {
              // Open direct MP4 in a new tab for a minimalistic player
              chrome.tabs.create({ url: resp.mp4Url });
            } else {
              alert('Could not find MP4 link on that page.');
            }
          }
        );
      });

      const bookmarkBtn = document.createElement('button');
      bookmarkBtn.textContent = 'Bookmark';
      bookmarkBtn.addEventListener('click', () => {
        bookmarkVideo(video);
      });

      actions.appendChild(viewBtn);
      actions.appendChild(playerBtn);
      actions.appendChild(bookmarkBtn);

      details.appendChild(titleEl);
      details.appendChild(actions);

      item.appendChild(checkbox);
      item.appendChild(thumbnail);
      item.appendChild(details);
      videoList.appendChild(item);
    });
  }

  // Quick inline preview by injecting a <video> tag
  function toggleInlinePreview(video, container) {
    const existingVideo = container.querySelector('video');
    if (existingVideo) {
      existingVideo.remove();
      return;
    }
    const videoEl = document.createElement('video');
    videoEl.style.width = '100%';
    videoEl.controls = true;
    chrome.runtime.sendMessage({ message: 'get_mp4_link', href: video.href }, (resp) => {
      if (resp && resp.mp4Url) {
        const source = document.createElement('source');
        source.src = resp.mp4Url;
        source.type = 'video/mp4';
        videoEl.appendChild(source);
      } else {
        videoEl.innerHTML = 'No direct MP4 found.';
      }
    });
    container.appendChild(videoEl);
  }

  // Bookmark logic with date added, remove option
  function bookmarkVideo(video) {
    const dateAdded = new Date().toLocaleString();
    chrome.storage.local.get(['bookmarkedVideos'], (data) => {
      const current = data.bookmarkedVideos || [];
      if (!current.some(v => v.href === video.href)) {
        const newBookmark = { ...video, dateAdded };
        current.push(newBookmark);
        chrome.storage.local.set({ bookmarkedVideos: current }, () => {
          bookmarksSection.style.display = 'block';
          addBookmarkToDOM(newBookmark);
        });
      } else {
        alert('Already bookmarked.');
      }
    });
  }

  function addBookmarkToDOM(bookmark) {
    const item = document.createElement('div');
    item.classList.add('bookmark-item');

    const titleSpan = document.createElement('span');
    titleSpan.classList.add('bookmark-title');
    titleSpan.textContent = bookmark.title;

    const dateSpan = document.createElement('span');
    dateSpan.classList.add('bookmark-date');
    dateSpan.textContent = ` (${bookmark.dateAdded})`;

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      removeBookmark(bookmark);
    });

    item.appendChild(titleSpan);
    item.appendChild(dateSpan);
    item.appendChild(removeBtn);
    bookmarksList.appendChild(item);
  }

  function removeBookmark(bookmark) {
    chrome.storage.local.get(['bookmarkedVideos'], (data) => {
      let current = data.bookmarkedVideos || [];
      current = current.filter(b => b.href !== bookmark.href);
      chrome.storage.local.set({ bookmarkedVideos: current }, () => {
        refreshBookmarksUI(current);
      });
    });
  }

  function refreshBookmarksUI(bookmarks) {
    bookmarksList.innerHTML = '';
    if (!bookmarks || bookmarks.length === 0) {
      bookmarksSection.style.display = 'none';
      return;
    }
    bookmarksSection.style.display = 'block';
    bookmarks.forEach(b => addBookmarkToDOM(b));
  }

  // Real-time search
  searchBar.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = allVideos.filter(v => v.title.toLowerCase().includes(query));
    populateVideoList(filtered);
  });

  // Select all
  selectAllCheckbox.addEventListener('change', (e) => {
    document.querySelectorAll('.video-checkbox').forEach((cb) => {
      cb.checked = e.target.checked;
    });
  });

  // Download selected
  downloadButton.addEventListener('click', () => {
    const selectedVideos = [];
    document.querySelectorAll('.video-checkbox').forEach((checkbox) => {
      if (checkbox.checked) {
        const idx = checkbox.dataset.index;
        const vid = allVideos[idx];
        if (vid) selectedVideos.push(vid);
      }
    });
    if (selectedVideos.length > 0) {
      chrome.runtime.sendMessage({ message: 'download_videos', videos: selectedVideos }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          alert('An error occurred while starting the downloads.');
          return;
        }
        if (response && response.status === 'started') {
          alert('Download started for selected videos.');
        } else {
          alert('Failed to start downloads.');
        }
      });
    } else {
      alert('No videos selected.');
    }
  });
});
