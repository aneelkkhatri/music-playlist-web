// Loads the playlist manifest (playlists.json) and renders the library grid.
// Each card opens index.html?file=playlists/<id>.json.gz

const listContainer = document.getElementById('playlist-list');
const libraryMeta = document.getElementById('library-meta');
const stateEl = document.getElementById('state');
const noCache = new URLSearchParams(window.location.search).get('noCache') === 'true'; // default is false

const ICONS = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.6v12.8a1 1 0 0 0 1.52.85l10.4-6.4a1 1 0 0 0 0-1.7L9.52 4.75A1 1 0 0 0 8 5.6z"/></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6"/><path d="M10 14L20 4"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>'
};

// Helper to fetch all playlist files
async function fetchPlaylistFiles() {
  // Try to get the list of files from a manifest, or fallback to a hardcoded list
  // If you want to automate, generate a playlists.json manifest in your sync script
  const manifestUrl = 'playlists.json';
  let resp;
  try {
    // ?noCache=true revalidates with the server to pick up a re-synced manifest
    resp = await fetch(manifestUrl, noCache ? { cache: 'no-cache' } : {});
    if (!resp.ok) throw new Error('No manifest');
  } catch {
    // Fallback: hardcoded list (update as needed)
    return [
      // Example:
      // { id: 'PLsb3AAnDkrPCSfigMKaIAVnb6wzl56l8c', title: 'masti-songs' }
    ];
  }
  // The manifest exists, so a parse failure is a real error: surface it instead of
  // silently showing an empty library.
  try {
    return await resp.json(); // [{id, title, ...}]
  } catch (err) {
    throw new Error(`${manifestUrl} is not valid JSON (${err.message})`);
  }
}

function showError(title, message) {
  listContainer.textContent = '';
  libraryMeta.textContent = '';
  stateEl.textContent = '';
  stateEl.appendChild(el('strong', null, title));
  stateEl.append(message);
  stateEl.hidden = false;
}

// Small DOM helper; text is always set with textContent (never parsed as HTML)
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// Swap the tiny stored thumbnail for YouTube's sharper 320x180 version
function sharpThumb(thumb) {
  const url = thumb && thumb.url;
  if (!url) return null;
  const match = /\/vi\/([^/]+)\//.exec(url);
  return match ? `https://i.ytimg.com/vi/${match[1]}/mqdefault.jpg` : url;
}

function buildCover(thumbnails) {
  const cover = el('div', 'cover');
  const urls = (thumbnails || []).map(sharpThumb).filter(Boolean);
  const shown = urls.length >= 4 ? urls.slice(0, 4) : urls.slice(0, 1);
  if (shown.length === 1) cover.classList.add('single');
  if (!shown.length) cover.classList.add('idle');
  shown.forEach(url => {
    const img = el('img');
    img.src = url;
    img.alt = '';
    img.loading = 'lazy';
    cover.appendChild(img);
  });
  return cover;
}

function renderPlaylists(playlists) {
  listContainer.textContent = '';
  libraryMeta.textContent = `${playlists.length} ${playlists.length === 1 ? 'playlist' : 'playlists'}`;
  if (!playlists.length) {
    stateEl.textContent = '';
    stateEl.appendChild(el('strong', null, 'No playlists yet'));
    stateEl.append('Synced playlists will show up here.');
    stateEl.hidden = false;
    return;
  }
  stateEl.hidden = true;

  playlists.forEach(pl => {
    const card = el('article', 'pl-card');

    const coverWrap = el('div', 'cover-wrap');
    const play = el('span', 'cover-play');
    play.innerHTML = ICONS.play;
    coverWrap.append(buildCover(pl.thumbnails), play);

    const body = el('div', 'pl-body');
    const text = el('div', 'pl-text');
    const title = el('a', 'pl-title', pl.title || pl.id);
    title.href = `index.html?file=playlists/${pl.id}.json.gz${noCache ? '&noCache=true' : ''}`;
    text.appendChild(title);

    const sub = [pl.channel, typeof pl.count === 'number' ? `${pl.count} videos` : null]
      .filter(Boolean)
      .join(' • ');
    if (sub) text.appendChild(el('p', 'pl-sub', sub));

    const yt = el('a', 'ext');
    yt.href = `https://www.youtube.com/playlist?list=${pl.id}`;
    yt.target = '_blank';
    yt.rel = 'noopener';
    yt.title = 'Open on YouTube';
    yt.setAttribute('aria-label', `Open “${pl.title || pl.id}” on YouTube`);
    yt.innerHTML = ICONS.external;

    body.append(text, yt);
    card.append(coverWrap, body);
    listContainer.appendChild(card);
  });
}

fetchPlaylistFiles()
  .then(async files => {
    // If manifest only has ids, fetch each playlist file for details
    if (files.length && !files[0].title) {
      const details = await Promise.all(files.map(async f => {
        try {
          const resp = await fetch(`playlists/${f.id}.json`);
          if (!resp.ok) return null;
          const data = await resp.json();
          return { id: f.id, title: data.title, thumbnails: data.thumbnails, channel: data.channel, channel_id: data.channel_id  };
        } catch {
          return null;
        }
      }));
      renderPlaylists(details.filter(Boolean));
    } else {
      renderPlaylists(files);
    }
  })
  .catch(err => {
    console.error('Failed to load playlists:', err);
    showError('Couldn’t load your library', err.message);
  });
