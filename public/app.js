import { parseRoute, formatYears, formatEpisodeCode, truncate, STATUS_LABELS } from './lib.js';

const app = document.getElementById('app');
const countBadge = document.getElementById('watchlist-count');

// ---------- tiny DOM helper (uses textContent, so API data is never injected as HTML) ----------
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key === 'class') el.className = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

function poster(src, alt, cls = 'poster') {
  return src
    ? h('img', { class: cls, src, alt, loading: 'lazy' })
    : h('div', { class: `${cls} placeholder` }, 'No image');
}

function status(message, isError = false) {
  return h('p', { class: `status${isError ? ' error' : ''}` }, message);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

// ---------- watchlist state ----------
let watchlist = [];
async function refreshWatchlist() {
  try {
    watchlist = await api('/api/watchlist');
  } catch {
    watchlist = [];
  }
  countBadge.textContent = watchlist.length;
}
const inWatchlist = (id) => watchlist.find((e) => e.id === id);

// ---------- views ----------
let searchToken = 0;
let lastQuery = '';
const backLink = () => h('a', { class: 'back', href: lastQuery ? `#/?q=${encodeURIComponent(lastQuery)}` : '#/' }, '← Back to search');
async function renderSearch(query) {
  lastQuery = query;
  const input = h('input', {
    type: 'search', name: 'q', value: query, placeholder: 'Search a TV series, e.g. "Breaking Bad"',
    'aria-label': 'Series name', autofocus: true, required: true,
  });
  const form = h('form', {
    class: 'search-form',
    onsubmit: (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (q) location.hash = `#/?q=${encodeURIComponent(q)}`;
    },
  }, input, h('button', { type: 'submit' }, 'Search'));

  const results = h('div');
  app.replaceChildren(form, results);
  input.focus();

  if (!query) {
    results.append(status('Type the name of a series to get started.'));
    return;
  }

  const token = ++searchToken;
  results.append(status('Searching…'));
  try {
    const data = await api(`/api/search?q=${encodeURIComponent(query)}`);
    if (token !== searchToken) return; // a newer search started meanwhile
    if (!data.results.length) {
      results.replaceChildren(status(`No series found for "${query}".`));
      return;
    }
    results.replaceChildren(
      h('p', { class: 'meta' }, `${data.results.length} result(s) for "${query}"`),
      h('div', { class: 'grid' }, data.results.map(showCard)),
    );
  } catch (err) {
    if (token === searchToken) results.replaceChildren(status(err.message, true));
  }
}

function showCard(show) {
  const bits = [formatYears(show.premiered, show.ended), show.network].filter(Boolean).join(' · ');
  return h('a', { class: 'card', href: `#/show/${show.id}` },
    poster(show.image, show.name),
    h('div', { class: 'card-body' },
      h('p', { class: 'card-title' }, show.name),
      h('p', { class: 'meta' }, bits || '—'),
      show.rating ? h('p', { class: 'meta' }, `★ ${show.rating}`) : null,
      inWatchlist(show.id) ? h('p', { class: 'meta' }, '✓ On watchlist') : null,
    ),
  );
}

async function renderShow(id) {
  app.replaceChildren(status('Loading series…'));
  let data;
  try {
    data = await api(`/api/shows/${id}`);
  } catch (err) {
    app.replaceChildren(backLink(), status(err.message, true));
    return;
  }
  const { show, seasons, cast, episodeCount } = data;

  const head = h('section', { class: 'detail-head' },
    poster(show.imageLarge || show.image, show.name),
    h('div', {},
      h('h1', {}, show.name),
      h('div', { class: 'chips' }, show.genres.map((g) => h('span', { class: 'chip' }, g))),
      h('div', { class: 'facts' },
        fact('Years', formatYears(show.premiered, show.ended)),
        fact('Status', show.status),
        fact('Network', show.network),
        fact('Language', show.language),
        fact('Rating', show.rating ? `★ ${show.rating}` : null),
        fact('Episodes', episodeCount),
      ),
      h('p', {}, show.summary || 'No summary available.'),
      watchlistControls(show),
    ),
  );

  app.replaceChildren(
    backLink(),
    head,
    h('h2', { class: 'section-title' }, 'Episodes'),
    episodesSection(seasons),
    h('h2', { class: 'section-title' }, 'Cast'),
    castSection(cast),
  );
  document.title = `${show.name} · TVmaze Explorer`;
}

function fact(label, value) {
  if (value == null || value === '') return null;
  return h('span', {}, `${label}: `, h('strong', {}, value));
}

function watchlistControls(show) {
  const wrap = h('div', { class: 'actions' });
  const draw = () => {
    const entry = inWatchlist(show.id);
    if (!entry) {
      wrap.replaceChildren(h('button', { onclick: () => save('plan-to-watch') }, '+ Add to watchlist'));
      return;
    }
    const select = h('select', { 'aria-label': 'Watch status', onchange: (e) => save(e.target.value) },
      Object.entries(STATUS_LABELS).map(([value, label]) =>
        h('option', { value, selected: value === entry.status }, label)),
    );
    wrap.replaceChildren(select, h('button', { class: 'danger', onclick: removeIt }, 'Remove'));
  };
  async function save(statusValue) {
    try {
      await api(`/api/watchlist/${show.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: show.name, image: show.image, rating: show.rating, status: statusValue }),
      });
      await refreshWatchlist();
      draw();
    } catch (err) { alertInline(wrap, err.message); }
  }
  async function removeIt() {
    try {
      await api(`/api/watchlist/${show.id}`, { method: 'DELETE' });
      await refreshWatchlist();
      draw();
    } catch (err) { alertInline(wrap, err.message); }
  }
  draw();
  return wrap;
}

function alertInline(container, message) {
  container.append(h('span', { class: 'meta', style: 'color: var(--danger)' }, message));
}

function episodesSection(seasons) {
  if (!seasons.length) return status('No episodes listed.');
  const list = h('div', { class: 'episodes' });
  const tabs = h('div', { class: 'season-tabs', role: 'tablist' });
  const select = (season) => {
    for (const btn of tabs.children) btn.classList.toggle('active', Number(btn.dataset.season) === season.season);
    list.replaceChildren(...season.episodes.map((ep) =>
      h('div', { class: 'episode' },
        h('span', { class: 'ep-num' }, formatEpisodeCode(ep.season, ep.number)),
        h('div', {},
          h('div', { class: 'ep-name' }, ep.name),
          ep.summary ? h('div', { class: 'ep-summary' }, truncate(ep.summary, 220)) : null,
        ),
        h('div', { class: 'ep-side' },
          h('div', {}, ep.airdate || 'TBA'),
          ep.rating ? h('div', {}, `★ ${ep.rating}`) : null,
          ep.runtime ? h('div', {}, `${ep.runtime} min`) : null,
        ),
      )));
  };
  for (const season of seasons) {
    tabs.append(h('button', {
      type: 'button', role: 'tab', 'data-season': season.season, onclick: () => select(season),
    }, `Season ${season.season} (${season.episodes.length})`));
  }
  select(seasons[0]);
  return h('div', {}, tabs, list);
}

function castSection(cast) {
  if (!cast.length) return status('No cast information available.');
  return h('div', { class: 'cast-grid' }, cast.map((c) =>
    h('div', { class: 'cast-card' },
      poster(c.image, c.person),
      h('div', { class: 'card-body' },
        h('p', { class: 'card-title' }, c.person),
        h('p', { class: 'meta' }, c.character ? `as ${c.character}${c.voice ? ' (voice)' : ''}` : ''),
      ),
    )));
}

let watchlistFilter = 'all';
function renderWatchlist() {
  const filters = h('div', { class: 'filters' },
    [['all', 'All'], ...Object.entries(STATUS_LABELS)].map(([value, label]) => {
      const count = value === 'all' ? watchlist.length : watchlist.filter((e) => e.status === value).length;
      return h('button', {
        type: 'button', class: value === watchlistFilter ? 'active' : null,
        onclick: () => { watchlistFilter = value; renderWatchlist(); },
      }, `${label} (${count})`);
    }));

  const entries = watchlist
    .filter((e) => watchlistFilter === 'all' || e.status === watchlistFilter)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const rows = entries.length
    ? entries.map((e) => h('div', { class: 'wl-row' },
        h('a', { href: `#/show/${e.id}` }, poster(e.image, e.name)),
        h('div', {},
          h('a', { href: `#/show/${e.id}`, class: 'card-title' }, e.name),
          h('p', { class: 'meta' }, e.rating ? `★ ${e.rating}` : 'No rating'),
        ),
        h('select', {
          'aria-label': `Status for ${e.name}`,
          onchange: async (ev) => {
            await api(`/api/watchlist/${e.id}`, { method: 'PUT', body: JSON.stringify({ ...e, status: ev.target.value }) });
            await refreshWatchlist();
            renderWatchlist();
          },
        }, Object.entries(STATUS_LABELS).map(([value, label]) => h('option', { value, selected: value === e.status }, label))),
        h('button', {
          class: 'danger',
          onclick: async () => {
            await api(`/api/watchlist/${e.id}`, { method: 'DELETE' });
            await refreshWatchlist();
            renderWatchlist();
          },
        }, 'Remove'),
      ))
    : [status(watchlist.length ? 'Nothing in this category.' : 'Your watchlist is empty. Search for a series and add it.')];

  app.replaceChildren(h('h1', {}, 'My watchlist'), filters, ...rows);
}

// ---------- router ----------
async function route() {
  const r = parseRoute(location.hash);
  document.title = 'TVmaze Explorer';
  for (const link of document.querySelectorAll('[data-nav]')) {
    link.classList.toggle('active', link.dataset.nav === (r.name === 'watchlist' ? 'watchlist' : 'search'));
  }
  if (r.name === 'show') return renderShow(r.id);
  if (r.name === 'watchlist') { await refreshWatchlist(); return renderWatchlist(); }
  return renderSearch(r.query);
}

window.addEventListener('hashchange', route);
refreshWatchlist().then(route);
