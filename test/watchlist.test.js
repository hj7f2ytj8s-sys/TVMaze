import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createWatchlistStore, validateEntry } from '../src/watchlist.js';

async function tempStore() {
  const dir = await mkdtemp(path.join(tmpdir(), 'watchlist-'));
  const file = path.join(dir, 'nested', 'watchlist.json');
  let tick = 0;
  const store = createWatchlistStore(file, { now: () => `2026-01-01T00:00:0${tick++}Z` });
  return { store, file, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('validateEntry applies defaults and rejects bad input', () => {
  assert.equal(validateEntry({ id: '5', name: ' X ' }).status, 'plan-to-watch');
  assert.equal(validateEntry({ id: '5', name: ' X ' }).name, 'X');
  assert.throws(() => validateEntry({ id: 0, name: 'X' }), /id/);
  assert.throws(() => validateEntry({ id: 1, name: '' }), /name/);
  assert.throws(() => validateEntry({ id: 1, name: 'X', status: 'binging' }), /status/);
});

test('list is empty when the file does not exist yet', async () => {
  const { store, cleanup } = await tempStore();
  assert.deepEqual(await store.list(), []);
  await cleanup();
});

test('upsert adds, persists to disk and updates status', async () => {
  const { store, file, cleanup } = await tempStore();
  await store.upsert({ id: 169, name: 'Breaking Bad', rating: 9.2 });
  const updated = await store.upsert({ id: 169, name: 'Breaking Bad', status: 'watching' });

  assert.equal(updated.status, 'watching');
  assert.equal(updated.addedAt, '2026-01-01T00:00:00Z'); // kept from first insert
  assert.equal(updated.updatedAt, '2026-01-01T00:00:01Z');

  const onDisk = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(onDisk.length, 1);
  assert.equal(onDisk[0].status, 'watching');
  await cleanup();
});

test('concurrent upserts are not lost', async () => {
  const { store, cleanup } = await tempStore();
  await Promise.all([1, 2, 3, 4, 5].map((id) => store.upsert({ id, name: `Show ${id}` })));
  assert.equal((await store.list()).length, 5);
  await cleanup();
});

test('remove deletes an entry and 404s for unknown ids', async () => {
  const { store, cleanup } = await tempStore();
  await store.upsert({ id: 1, name: 'A' });
  await store.remove(1);
  assert.deepEqual(await store.list(), []);
  await assert.rejects(store.remove(1), (e) => e.status === 404);
  await cleanup();
});
