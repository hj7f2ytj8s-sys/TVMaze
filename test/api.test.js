// Integration tests for the Express routes: the app runs on a random local port
// with a fake TVmaze client and a temporary watchlist file.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { createTvmazeClient } from '../src/tvmaze.js';
import { createWatchlistStore } from '../src/watchlist.js';
import { searchResponse, showDetailResponse, fakeFetch } from './fixtures.js';

let server, base, dir;

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'api-'));
  const fetchImpl = fakeFetch((url) => {
    if (url.includes('/search/shows')) return { body: searchResponse };
    if (url.includes('/shows/169')) return { body: showDetailResponse };
    return { status: 404 };
  });
  const app = createApp({
    tvmaze: createTvmazeClient({ fetchImpl }),
    watchlist: createWatchlistStore(path.join(dir, 'watchlist.json')),
  });
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await rm(dir, { recursive: true, force: true });
});

test('GET /api/search returns normalized results', async () => {
  const res = await fetch(`${base}/api/search?q=breaking`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.query, 'breaking');
  assert.equal(body.results[0].name, 'Breaking Bad');
});

test('GET /api/search without q returns 400', async () => {
  const res = await fetch(`${base}/api/search`);
  assert.equal(res.status, 400);
});

test('GET /api/shows/:id returns seasons and cast', async () => {
  const body = await (await fetch(`${base}/api/shows/169`)).json();
  assert.equal(body.show.id, 169);
  assert.equal(body.seasons.length, 2);
  assert.equal(body.cast.length, 2);
});

test('GET /api/shows/:id passes through 404 and 400', async () => {
  assert.equal((await fetch(`${base}/api/shows/12345`)).status, 404);
  assert.equal((await fetch(`${base}/api/shows/abc`)).status, 400);
});

test('watchlist CRUD round trip', async () => {
  const put = await fetch(`${base}/api/watchlist/169`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Breaking Bad', status: 'watching' }),
  });
  assert.equal(put.status, 200);
  assert.equal((await put.json()).status, 'watching');

  const list = await (await fetch(`${base}/api/watchlist`)).json();
  assert.equal(list.length, 1);

  const bad = await fetch(`${base}/api/watchlist/169`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Breaking Bad', status: 'nope' }),
  });
  assert.equal(bad.status, 400);

  assert.equal((await fetch(`${base}/api/watchlist/169`, { method: 'DELETE' })).status, 204);
  assert.equal((await fetch(`${base}/api/watchlist/169`, { method: 'DELETE' })).status, 404);
});

test('frontend is served from /', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /TVmaze Explorer/);
});
