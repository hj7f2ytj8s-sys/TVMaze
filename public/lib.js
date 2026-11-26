// Pure helpers shared by the frontend and the unit tests (no DOM access here).

export const STATUS_LABELS = {
  'plan-to-watch': 'Plan to watch',
  watching: 'Watching',
  completed: 'Completed',
  dropped: 'Dropped',
};

/** Parse location.hash into a route object. */
export function parseRoute(hash) {
  const raw = (hash || '').replace(/^#/, '') || '/';
  const [pathPart, queryPart = ''] = raw.split('?');
  const params = new URLSearchParams(queryPart);
  const showMatch = pathPart.match(/^\/show\/(\d+)\/?$/);
  if (showMatch) return { name: 'show', id: Number(showMatch[1]) };
  if (pathPart.replace(/\/$/, '') === '/watchlist') return { name: 'watchlist' };
  return { name: 'search', query: params.get('q') ?? '' };
}

/** "2011–2019", "2015–" or "" */
export function formatYears(premiered, ended) {
  const start = premiered ? premiered.slice(0, 4) : '';
  if (!start) return '';
  const end = ended ? ended.slice(0, 4) : '';
  return start === end ? start : `${start}–${end}`;
}

/** "S01E05", or "Special" for episodes without a number. */
export function formatEpisodeCode(season, number) {
  if (number == null) return 'Special';
  const pad = (n) => String(n).padStart(2, '0');
  return `S${pad(season)}E${pad(number)}`;
}

export function truncate(text, max = 160) {
  if (!text || text.length <= max) return text || '';
  return `${text.slice(0, max).replace(/\s+\S*$/, '')}…`;
}
