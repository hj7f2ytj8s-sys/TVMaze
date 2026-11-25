import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stripHtml, normalizeSearchResults, normalizeShowDetail, groupEpisodesBySeason,
  createTvmazeClient, TvmazeError,
} from '../src/tvmaze.js';
import { searchResponse, showDetailResponse, fakeFetch } from './fixtures.js';

test('stripHtml removes tags and decodes common entities', () => {
  assert.equal(stripHtml('<p><b>Hi</b> Tom &amp; Jerry&#39;s</p>'), "Hi Tom & Jerry's");
  assert.equal(stripHtml(null), '');
});

test('normalizeSearchResults maps fields and falls back to webChannel', () => {
  const [first, second] = normalizeSearchResults(searchResponse);
  assert.equal(first.id, 169);
  assert.equal(first.rating, 9.2);
  assert.equal(first.network, 'AMC');
  assert.equal(first.summary, 'Breaking Bad follows protagonist Walter White & his family.');
  assert.equal(second.network, 'Netflix');
  assert.equal(second.image, null);
  assert.equal(second.rating, null);
});

test('normalizeSearchResults tolerates bad input', () => {
  assert.deepEqual(normalizeSearchResults(null), []);
  assert.deepEqual(normalizeSearchResults([{ score: 1 }]), []);
});

test('groupEpisodesBySeason sorts seasons and episodes, specials last', () => {
  const grouped = groupEpisodesBySeason([
    { season: 2, number: 1 }, { season: 1, number: null }, { season: 1, number: 2 }, { season: 1, number: 1 },
  ]);
  assert.deepEqual(grouped.map((s) => s.season), [1, 2]);
  assert.deepEqual(grouped[0].episodes.map((e) => e.number), [1, 2, null]);
});

test('normalizeShowDetail returns show, seasons and cast', () => {
  const detail = normalizeShowDetail(showDetailResponse);
  assert.equal(detail.show.name, 'Breaking Bad');
  assert.equal(detail.episodeCount, 4);
  assert.equal(detail.seasons.length, 2);
  assert.equal(detail.seasons[0].episodes[0].name, 'Pilot');
  assert.equal(detail.seasons[0].episodes[2].airdate, null); // empty string -> null
  assert.deepEqual(detail.cast.map((c) => c.character), ['Walter White', 'Jesse Pinkman']);
  assert.equal(detail.cast[0].image, 'https://img/bryan.jpg'); // falls back to person image
  assert.equal(detail.cast[1].image, 'https://img/jesse.jpg'); // prefers character image
});

test('client builds correct URLs and encodes the query', async () => {
  const fetchImpl = fakeFetch(() => ({ body: searchResponse }));
  const client = createTvmazeClient({ fetchImpl, baseUrl: 'https://x' });
  const results = await client.searchShows('  breaking bad & co ');
  assert.equal(results.length, 2);
  assert.equal(fetchImpl.calls[0], 'https://x/search/shows?q=breaking%20bad%20%26%20co');
});

test('client requests episodes and cast in one embedded call', async () => {
  const fetchImpl = fakeFetch(() => ({ body: showDetailResponse }));
  const client = createTvmazeClient({ fetchImpl, baseUrl: 'https://x' });
  await client.getShowDetail('169');
  assert.equal(fetchImpl.calls[0], 'https://x/shows/169?embed[]=episodes&embed[]=cast');
});

test('client returns [] for empty query without calling the API', async () => {
  const fetchImpl = fakeFetch(() => ({ body: [] }));
  const client = createTvmazeClient({ fetchImpl });
  assert.deepEqual(await client.searchShows('   '), []);
  assert.equal(fetchImpl.calls.length, 0);
});

test('client caches responses within the TTL', async () => {
  let clock = 0;
  const fetchImpl = fakeFetch(() => ({ body: searchResponse }));
  const client = createTvmazeClient({ fetchImpl, cacheTtlMs: 1000, now: () => clock });
  await client.searchShows('bad');
  await client.searchShows('bad');
  assert.equal(fetchImpl.calls.length, 1);
  clock = 2000;
  await client.searchShows('bad');
  assert.equal(fetchImpl.calls.length, 2);
});

test('client maps HTTP errors to TvmazeError with a status', async () => {
  const statuses = { '/shows/1?': 404, '/shows/2?': 429, '/shows/3?': 500 };
  const fetchImpl = fakeFetch((url) => {
    const key = Object.keys(statuses).find((k) => url.includes(k));
    return { status: statuses[key] };
  });
  const client = createTvmazeClient({ fetchImpl, baseUrl: '' });
  await assert.rejects(client.getShowDetail(1), (e) => e instanceof TvmazeError && e.status === 404);
  await assert.rejects(client.getShowDetail(2), (e) => e.status === 429);
  await assert.rejects(client.getShowDetail(3), (e) => e.status === 502);
});

test('client rejects invalid ids without calling the API', async () => {
  const fetchImpl = fakeFetch(() => ({ body: {} }));
  const client = createTvmazeClient({ fetchImpl });
  await assert.rejects(client.getShowDetail('abc'), (e) => e.status === 400);
  await assert.rejects(client.getShowDetail(-5), (e) => e.status === 400);
  assert.equal(fetchImpl.calls.length, 0);
});

test('client reports network failures as 502', async () => {
  const client = createTvmazeClient({ fetchImpl: async () => { throw new Error('ECONNREFUSED'); } });
  await assert.rejects(client.searchShows('x'), (e) => e.status === 502 && /ECONNREFUSED/.test(e.message));
});
