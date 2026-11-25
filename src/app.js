import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

/**
 * Build the Express app. Dependencies are passed in so tests can use a fake
 * TVmaze client and a temporary watchlist file.
 */
export function createApp({ tvmaze, watchlist }) {
  const app = express();
  app.use(express.json({ limit: '10kb' }));
  app.use(express.static(publicDir));

  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

  app.get('/api/search', wrap(async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (!q) return res.status(400).json({ error: 'Query parameter "q" is required' });
    if (q.length > 100) return res.status(400).json({ error: 'Query is too long' });
    res.json({ query: q, results: await tvmaze.searchShows(q) });
  }));

  app.get('/api/shows/:id', wrap(async (req, res) => {
    res.json(await tvmaze.getShowDetail(req.params.id));
  }));

  app.get('/api/watchlist', wrap(async (_req, res) => {
    res.json(await watchlist.list());
  }));

  app.put('/api/watchlist/:id', wrap(async (req, res) => {
    const entry = await watchlist.upsert({ ...req.body, id: req.params.id });
    res.json(entry);
  }));

  app.delete('/api/watchlist/:id', wrap(async (req, res) => {
    await watchlist.remove(req.params.id);
    res.status(204).end();
  }));

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown endpoint' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = Number.isInteger(err.status) ? err.status : 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message });
  });

  return app;
}
