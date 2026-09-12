let allVideos = [];
let filteredVideos = [];
let currentIndex = 0;
const batchSize = 10;
const container = document.getElementById('playlist');
const titleFilterBar = document.getElementById('title-filter-bar');
const channelFilterBar = document.getElementById('channel-filter-bar');
const collator = new Intl.Collator(undefined, {
  sensitivity: 'base' // ignore case and accents
});

function normalizeText(str) {
  return str
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

// Get query parameter from URL
function getQueryParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}
const showEmbed = getQueryParam('embed') === 'true'; // default is false
const playlistFile = getQueryParam('file');
const singlePlayer = getQueryParam('singlePlayer') === 'true'; // default is false

function renderNextBatch() {
  const nextVideos = filteredVideos.slice(currentIndex, currentIndex + batchSize);
  nextVideos.forEach(video => {
    const div = document.createElement('div');
    div.className = 'video';
    if (showEmbed) {
      div.innerHTML = `
        <div class="video-info">
          <span class="video-title">${video.title}</span>
          <span class="video-channel">${video.channel || ''}</span>
          <a class="video-url" href="https://www.youtube.com/watch?v=${video.id}" target="_blank">Watch on YouTube</a>
        </div>
        <iframe width="160" height="90" src="https://www.youtube.com/embed/${video.id}?autoplay=1" frameborder="0" allowfullscreen allow="autoplay"></iframe>
      `;
    } else {
      div.innerHTML = '';
      const row = document.createElement('div');
      // Image
      const img = document.createElement('img');
      img.className = 'thumb-square';
      img.src = video.thumbnails[0].url;
      img.alt = video.title;
      // Info
      const info = document.createElement('div');
      info.className = 'video-info';
      info.innerHTML = `
        <span class="video-title">${video.title}</span>
        <a class="channel-url" href="https://www.youtube.com/channel/${video.channel_id}" target="_blank"><span class="video-channel">${video.channel || ''}</span></a>
        <a class="video-url" href="https://www.youtube.com/watch?v=${video.id}" target="_blank">Watch on YouTube</a>
      `;
      row.appendChild(img);
      row.appendChild(info);
      div.appendChild(row);
      img.addEventListener('click', function() {
        const existing = div.querySelector('.yt-player');
        if (existing) {
          existing.remove();
        } else {
          if (singlePlayer) {
            // Remove any other playing player
            const allVideoDivs = Array.from(document.querySelectorAll('.video'));
            allVideoDivs.forEach((vDiv) => {
              if (vDiv !== div) {
                const p = vDiv.querySelector('.yt-player');
                if (p) p.remove();
              }
            });
          }
          // Create a div for YouTube player
          const playerDiv = document.createElement('div');
          playerDiv.className = 'yt-player';
          playerDiv.id = `yt-player-${video.id}-${Math.random().toString(36).slice(2,8)}`;
          playerDiv.style.marginTop = '1em';
          div.appendChild(playerDiv);
          // Use YouTube Iframe API to create player
          createYouTubePlayer(playerDiv.id, video.id, div);
        }
      });
      // Helper to find next video index in filteredVideos
      function getNextVideoIndex(currentId) {
        const idx = filteredVideos.findIndex(v => v.id === currentId);
        return idx >= 0 && idx < filteredVideos.length - 1 ? idx + 1 : null;
      }

      // Create YouTube player and handle end event
      function createYouTubePlayer(playerId, videoId, containerDiv) {
        // Wait for YT API to be ready
        if (typeof YT === 'undefined' || typeof YT.Player === 'undefined') {
          setTimeout(() => createYouTubePlayer(playerId, videoId, containerDiv), 200);
          return;
        }
        const player = new YT.Player(playerId, {
          height: '300',
          width: '100%',
          videoId: videoId,
          playerVars: { autoplay: 1 },
          events: {
            'onStateChange': function(event) {
              if (event.data === YT.PlayerState.ENDED) {
                // Auto-play next video
                const nextIdx = getNextVideoIndex(videoId);
                if (nextIdx !== null) {
                  // Remove current player
                  const currentPlayerDiv = containerDiv.querySelector('.yt-player');
                  if (currentPlayerDiv) currentPlayerDiv.remove();
                  const nextVideoId = filteredVideos[nextIdx].id;
                  let nextDiv = Array.from(document.querySelectorAll('.video')).find(d => {
                    const img = d.querySelector('img');
                    return img && img.src.includes(nextVideoId);
                  });
                  // If nextDiv is not found, load more videos until it is
                  while (!nextDiv && currentIndex < filteredVideos.length) {
                    renderNextBatch();
                    nextDiv = Array.from(document.querySelectorAll('.video')).find(d => {
                      const img = d.querySelector('img');
                      return img && img.src.includes(nextVideoId);
                    });
                  }
                  if (nextDiv) {
                    const nextImg = nextDiv.querySelector('img');
                    if (nextImg) {
                      // Scroll to next video
                      nextDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      setTimeout(() => nextImg.click(), 300);
                    }
                  }
                }
              }
            }
          }
        });
      }
    }
    container.appendChild(div);
  });
  currentIndex += batchSize;
}

function resetAndRender() {
  container.innerHTML = '';
  currentIndex = 0;
  renderNextBatch();
  fillViewportIfNeeded();
}

function fillViewportIfNeeded() {
  // Load more batches if not enough content to fill viewport
  setTimeout(() => {
    while (currentIndex < filteredVideos.length && document.body.offsetHeight < window.innerHeight) {
      renderNextBatch();
    }
  }, 0);
}

function handleScroll() {
  if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 100) {
    if (currentIndex < filteredVideos.length) {
      renderNextBatch();
    }
  }
}

function isGzippedFile(filename) {
  return filename && filename.toLowerCase().endsWith('.gz');
}

async function decompressGzip(response) {
  const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream);
}

async function loadPlaylistFile(filename) {
  return fetch(filename).then(response => {
    if (isGzippedFile(filename)) {
      return decompressGzip(response);
    }
    return response;
  }).then(response => {
    return response.json();
  });
}

function applyFilter(filterBar) {
  const titleQuery = titleFilterBar.value.trim().toLowerCase();
  const channelQuery = channelFilterBar.value.trim().toLowerCase();
  filteredVideos = allVideos
      .filter(v => v.title && normalizeText(v.title.toLowerCase()).includes(normalizeText(titleQuery)))
      .filter(v => v.channel && normalizeText(v.channel.toLowerCase()).includes(normalizeText(channelQuery)));
  resetAndRender();
}

loadPlaylistFile(playlistFile)
  .then(data => {
    allVideos = data.entries;
    filteredVideos = allVideos;
    renderNextBatch();
    fillViewportIfNeeded();
    window.addEventListener('scroll', handleScroll);
    if (titleFilterBar) {
      titleFilterBar.addEventListener('input', function() {
        applyFilter();
      });
    }
    if (channelFilterBar) {
      channelFilterBar.addEventListener('input', function() {
        applyFilter();
      });
    }
  })
  .catch(error => {
    console.error('Failed to load playlist:', error);
    // You could add user-friendly error handling here
  });
