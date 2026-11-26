// Thin client for the public TVmaze API (https://www.tvmaze.com/api).
// No API key is required. TVmaze allows ~20 calls per 10 seconds per IP,
// so responses are cached in memory for a short time.

export const TVMAZE_BASE_URL = 'https://api.tvmaze.com';

export class TvmazeError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'TvmazeError';
    this.status = status;
  }
}

/** Remove HTML tags/entities from TVmaze summaries so the frontend can render plain text. */
export function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Reduce a raw TVmaze show object to the fields the UI needs. */
export function normalizeShow(show) {
  return {
    id: show.id,
    name: show.name,
    genres: show.genres ?? [],
    status: show.status ?? null,
    language: show.language ?? null,
    premiered: show.premiered ?? null,
    ended: show.ended ?? null,
    rating: show.rating?.average ?? null,
    network: show.network?.name ?? show.webChannel?.name ?? null,
    image: show.image?.medium ?? null,
    imageLarge: show.image?.original ?? null,
    summary: stripHtml(show.summary),
    officialSite: show.officialSite ?? null,
    url: show.url ?? null,
  };
}

export function normalizeSearchResults(results) {
  if (!Array.isArray(results)) return [];
  return results
    .filter((r) => r && r.show)
    .map((r) => ({ score: r.score ?? null, ...normalizeShow(r.show) }));
}

export function normalizeEpisode(ep) {
  return {
    id: ep.id,
    name: ep.name,
    season: ep.season,
    number: ep.number ?? null, // specials have no number
    airdate: ep.airdate || null,
    runtime: ep.runtime ?? null,
    rating: ep.rating?.average ?? null,
    summary: stripHtml(ep.summary),
  };
}

/** Group a flat episode list into [{ season, episodes: [...] }] sorted by season. */
export function groupEpisodesBySeason(episodes) {
  const bySeason = new Map();
  for (const ep of episodes) {
    if (!bySeason.has(ep.season)) bySeason.set(ep.season, []);
    bySeason.get(ep.season).push(ep);
  }
  return [...bySeason.entries()]
    .sort(([a], [b]) => a - b)
    .map(([season, eps]) => ({
      season,
      episodes: eps.sort((a, b) => (a.number ?? Infinity) - (b.number ?? Infinity)),
    }));
}

export function normalizeCast(cast) {
  if (!Array.isArray(cast)) return [];
  return cast.map((c) => ({
    personId: c.person?.id ?? null,
    person: c.person?.name ?? 'Unknown',
    character: c.character?.name ?? null,
    image: c.character?.image?.medium ?? c.person?.image?.medium ?? null,
    voice: Boolean(c.voice),
  }));
}

export function normalizeShowDetail(raw) {
  const episodes = (raw._embedded?.episodes ?? []).map(normalizeEpisode);
  return {
    show: normalizeShow(raw),
    seasons: groupEpisodesBySeason(episodes),
    episodeCount: episodes.length,
    cast: normalizeCast(raw._embedded?.cast),
  };
}

/**
 * Create a TVmaze client. `fetchImpl` is injectable so unit tests never hit the network.
 */
export function createTvmazeClient({
  fetchImpl = globalThis.fetch,
  baseUrl = TVMAZE_BASE_URL,
  cacheTtlMs = 5 * 60 * 1000,
  now = () => Date.now(),
} = {}) {
  const cache = new Map();

  async function getJson(path) {
    const hit = cache.get(path);
    if (hit && hit.expires > now()) return hit.data;

    let res;
    try {
      res = await fetchImpl(`${baseUrl}${path}`, { headers: { Accept: 'application/json' } });
    } catch (err) {
      throw new TvmazeError(`Could not reach TVmaze: ${err.message}`, 502);
    }
    if (res.status === 404) throw new TvmazeError('Not found', 404);
    if (res.status === 429) throw new TvmazeError('TVmaze rate limit reached, try again in a few seconds', 429);
    if (!res.ok) throw new TvmazeError(`TVmaze responded with ${res.status}`, 502);

    const data = await res.json();
    cache.set(path, { data, expires: now() + cacheTtlMs });
    return data;
  }

  return {
    async searchShows(query) {
      const q = String(query ?? '').trim();
      if (!q) return [];
      const raw = await getJson(`/search/shows?q=${encodeURIComponent(q)}`);
      return normalizeSearchResults(raw);
    },

    async getShowDetail(id) {
      const showId = Number(id);
      if (!Number.isInteger(showId) || showId <= 0) {
        throw new TvmazeError('Invalid show id', 400);
      }
      const raw = await getJson(`/shows/${showId}?embed[]=episodes&embed[]=cast`);
      return normalizeShowDetail(raw);
    },
  };
}
