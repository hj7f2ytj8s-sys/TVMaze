// Watchlist persisted to a local JSON file (no database, no cost).
// Each entry stores a small snapshot of the show plus the user's own status.

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';

export const STATUSES = ['plan-to-watch', 'watching', 'completed', 'dropped'];

export class WatchlistError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'WatchlistError';
    this.status = status;
  }
}

export function validateEntry(input) {
  const id = Number(input?.id);
  if (!Number.isInteger(id) || id <= 0) throw new WatchlistError('"id" must be a positive integer');
  if (typeof input.name !== 'string' || !input.name.trim()) throw new WatchlistError('"name" is required');
  const status = input.status ?? 'plan-to-watch';
  if (!STATUSES.includes(status)) throw new WatchlistError(`"status" must be one of: ${STATUSES.join(', ')}`);
  return {
    id,
    name: input.name.trim().slice(0, 200),
    image: typeof input.image === 'string' ? input.image : null,
    rating: typeof input.rating === 'number' ? input.rating : null,
    status,
  };
}

export function createWatchlistStore(filePath, { now = () => new Date().toISOString() } = {}) {
  // Serialize writes so two quick requests can't clobber each other.
  let queue = Promise.resolve();
  const enqueue = (fn) => (queue = queue.then(fn, fn));

  async function load() {
    try {
      const data = JSON.parse(await readFile(filePath, 'utf8'));
      return Array.isArray(data) ? data : [];
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  async function save(entries) {
    await mkdir(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    await writeFile(tmp, JSON.stringify(entries, null, 2));
    await rename(tmp, filePath); // atomic replace
  }

  return {
    list: () => load(),

    upsert: (input) =>
      enqueue(async () => {
        const entry = validateEntry(input);
        const entries = await load();
        const idx = entries.findIndex((e) => e.id === entry.id);
        const stamp = now();
        if (idx === -1) {
          entries.push({ ...entry, addedAt: stamp, updatedAt: stamp });
        } else {
          entries[idx] = { ...entries[idx], ...entry, updatedAt: stamp };
        }
        await save(entries);
        return entries.find((e) => e.id === entry.id);
      }),

    remove: (id) =>
      enqueue(async () => {
        const entries = await load();
        const next = entries.filter((e) => e.id !== Number(id));
        if (next.length === entries.length) throw new WatchlistError('Show is not on the watchlist', 404);
        await save(next);
      }),
  };
}
