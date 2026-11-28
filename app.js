let allVideos = [];
let filteredVideos = [];
let currentIndex = 0;
const batchSize = 10;
const container = document.getElementById('playlist');
const titleFilterBar = document.getElementById('title-filter-bar');
const channelFilterBar = document.getElementById('channel-filter-bar');
const stateEl = document.getElementById('state');
const countEl = document.getElementById('track-count');
// The full search hint doesn't fit on phones
const narrowScreen = window.matchMedia('(max-width: 640px)');
function updateSearchPlaceholder() {
  if (titleFilterBar) {
    titleFilterBar.placeholder = narrowScreen.matches ? 'Search' : 'Search songs, artists, albums';
  }
}
updateSearchPlaceholder();
narrowScreen.addEventListener('change', updateSearchPlaceholder);

const collator = new Intl.Collator(undefined, {
  sensitivity: 'base' // ignore case and accents
});

const ICONS = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.6v12.8a1 1 0 0 0 1.52.85l10.4-6.4a1 1 0 0 0 0-1.7L9.52 4.75A1 1 0 0 0 8 5.6z"/></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6"/><path d="M10 14L20 4"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>'
};

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
const noCache = getQueryParam('noCache') === 'true'; // default is false

// Keep ?noCache=true when going back to the library
const libraryUrl = noCache ? 'list.html?noCache=true' : 'list.html';
document.querySelectorAll('a.back').forEach(a => { a.href = libraryUrl; });

// Small DOM helper; text is always set with textContent (never parsed as HTML)
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// 320x180 16:9 thumbnail, sharp enough for retina at the sizes we render
function thumbUrl(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

function fallbackThumb(video) {
  const thumbs = video.thumbnails || [];
  return thumbs.length ? thumbs[thumbs.length - 1].url : '';
}

function externalLink(href, label) {
  const a = el('a', 'ext');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  a.title = 'Open on YouTube';
  a.setAttribute('aria-label', label);
  a.innerHTML = ICONS.external;
  a.addEventListener('click', e => e.stopPropagation());
  return a;
}

function renderCover(coverEl, urls) {
  coverEl.textContent = '';
  const list = urls.filter(Boolean);
  if (!list.length) return;
  const shown = list.length >= 4 ? list.slice(0, 4) : list.slice(0, 1);
  coverEl.classList.toggle('single', shown.length === 1);
  shown.forEach(url => {
    const img = el('img');
    img.src = url;
    img.alt = '';
    coverEl.appendChild(img);
  });
}

function buildRow(video, position) {
  const row = el('div', 'row');

  const idx = el('div', 'idx');
  idx.appendChild(el('span', 'num', String(position)));
  idx.insertAdjacentHTML('beforeend',
    `<span class="play-ico">${ICONS.play}</span><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>`);

  const thumb = el('div', 'thumb');

  const meta = el('div', 'meta');
  meta.appendChild(el('span', 'video-title', video.title || 'Untitled'));
  const artists = artistText(video);
  if (artists) {
    const line = el('span', 'video-artists', artists);
    line.title = artists;
    meta.appendChild(line);
  } else if (video.channel) {
    // No music metadata: fall back to the uploading channel
    const channel = el('a', 'video-channel', video.channel);
    channel.href = `https://www.youtube.com/channel/${video.channel_id}`;
    channel.target = '_blank';
    channel.rel = 'noopener';
    channel.addEventListener('click', e => e.stopPropagation());
    meta.appendChild(channel);
  }

  const albumName = cleanAlbum(video.album);
  const album = el('span', 'album', albumName);
  if (albumName) album.title = video.album;

  const duration = el('span', 'dur', formatDuration(video.duration));

  row.append(idx, thumb, meta, album, duration,
    externalLink(`https://www.youtube.com/watch?v=${video.id}`, `Open “${video.title}” on YouTube`));
  return { row, thumb };
}

function artistText(video) {
  return (video.artists || []).join(', ');
}

// "Jab We Met (Original Motion Picture Soundtrack)" → "Jab We Met"
function cleanAlbum(album) {
  return (album || '')
    .replace(/\s*[\(\[](original\s+)?(motion\s+picture\s+)?(sound\s*track|ost)[\)\]]\s*$/i, '')
    .trim();
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

function formatTotalDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} hr ${m} min` : `${m} min`;
}

function renderNextBatch() {
  const nextVideos = filteredVideos.slice(currentIndex, currentIndex + batchSize);
  nextVideos.forEach((video, i) => {
    const div = el('div', 'video');
    const { row, thumb } = buildRow(video, currentIndex + i + 1);
    div.appendChild(row);

    if (showEmbed) {
      thumb.classList.add('thumb-embed');
      const iframe = el('iframe');
      iframe.src = `https://www.youtube.com/embed/${video.id}?autoplay=1`;
      iframe.allow = 'autoplay';
      iframe.allowFullscreen = true;
      iframe.title = video.title || '';
      thumb.appendChild(iframe);
      container.appendChild(div);
      return;
    }

    const img = el('img');
    img.src = thumbUrl(video.id);
    img.alt = '';
    img.loading = 'lazy';
    img.addEventListener('error', () => {
      const fb = fallbackThumb(video);
      if (fb && img.src !== fb) img.src = fb;
    }, { once: true });
    thumb.appendChild(img);

    // The whole row toggles the player (keyboard accessible too)
    row.tabIndex = 0;
    row.setAttribute('role', 'button');
    row.setAttribute('aria-label', `Play ${video.title || 'video'}`);
    row.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        row.click();
      }
    });

    row.addEventListener('click', function() {
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
        // Wrapper holds the iframe the YouTube API creates in place of `mount`
        const playerDiv = el('div', 'yt-player');
        const mount = el('div');
        mount.id = `yt-player-${video.id}-${Math.random().toString(36).slice(2,8)}`;
        playerDiv.appendChild(mount);
        div.appendChild(playerDiv);
        // Use YouTube Iframe API to create player
        createYouTubePlayer(mount.id, video.id, div);
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
        height: '100%',
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

    container.appendChild(div);
  });
  currentIndex += batchSize;
}

function showState(title, message) {
  stateEl.textContent = '';
  if (!title) {
    stateEl.hidden = true;
    return;
  }
  stateEl.appendChild(el('strong', null, title));
  if (message) stateEl.append(message);
  stateEl.hidden = false;
}

function updateCount() {
  if (!countEl) return;
  const total = allVideos.length;
  const shown = filteredVideos.length;
  countEl.textContent = shown === total
    ? `${total} ${total === 1 ? 'video' : 'videos'}`
    : `${shown} of ${total}`;
}

function resetAndRender() {
  container.innerHTML = '';
  currentIndex = 0;
  updateCount();
  showState(filteredVideos.length ? null : 'No matches', 'Try a different title or channel.');
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
  if (!filename) throw new Error('No playlist file given');
  // ?noCache=true revalidates with the server, so a re-synced playlist shows up
  // right away instead of a stale cached copy (unchanged files return 304).
  return fetch(filename, noCache ? { cache: 'no-cache' } : {}).then(response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (isGzippedFile(filename)) {
      return decompressGzip(response);
    }
    return response;
  }).then(response => {
    return response.json();
  });
}

function renderHero(data) {
  const entries = data.entries || [];
  const title = data.title || 'Playlist';
  document.getElementById('playlist-title').textContent = title;
  document.title = `${title} · Playlists`;

  const meta = document.getElementById('playlist-meta');
  meta.textContent = '';
  if (data.channel) {
    meta.appendChild(el('strong', null, data.channel));
    meta.appendChild(el('span', 'sep', '•'));
  }
  meta.append(`${entries.length} ${entries.length === 1 ? 'video' : 'videos'}`);
  const totalSeconds = entries.reduce((sum, v) => sum + (v.duration || 0), 0);
  if (totalSeconds) {
    meta.appendChild(el('span', 'sep', '•'));
    meta.append(formatTotalDuration(totalSeconds));
  }

  const coverIds = entries.slice(0, 4).map(v => v.id);
  renderCover(document.getElementById('hero-cover'), coverIds.map(thumbUrl));
  if (coverIds.length) {
    document.getElementById('ambient').style.setProperty('--art', `url("${thumbUrl(coverIds[0])}")`);
  }
}

function applyFilter(filterBar) {
  const titleQuery = titleFilterBar.value.trim().toLowerCase();
  const channelQuery = channelFilterBar.value.trim().toLowerCase();
  // Main search matches the title, artists and album
  const searchText = v => [v.title, ...(v.artists || []), v.album].filter(Boolean).join(' ');
  filteredVideos = allVideos
      .filter(v => v.title && normalizeText(searchText(v)).includes(normalizeText(titleQuery)))
      .filter(v => v.channel && normalizeText(v.channel.toLowerCase()).includes(normalizeText(channelQuery)));
  resetAndRender();
}

loadPlaylistFile(playlistFile)
  .then(data => {
    allVideos = data.entries || [];
    filteredVideos = allVideos;
    renderHero(data);
    updateCount();
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
    document.getElementById('playlist-title').textContent = 'Playlist unavailable';
    document.body.classList.add('is-error');
    const back = el('a', null, 'Back to your library');
    back.href = libraryUrl;
    const msg = document.createDocumentFragment();
    msg.append(playlistFile ? 'This playlist couldn’t be loaded. ' : 'No playlist was selected. ', back);
    showState('Nothing to play', msg);
  });
