import 'dotenv/config';
import path from 'node:path';
import { createApp } from './src/app.js';
import { createTvmazeClient } from './src/tvmaze.js';
import { createWatchlistStore } from './src/watchlist.js';

const PORT = Number(process.env.PORT) || 3000;
const WATCHLIST_FILE = process.env.WATCHLIST_FILE || path.join('data', 'watchlist.json');

const app = createApp({
  tvmaze: createTvmazeClient(),
  watchlist: createWatchlistStore(WATCHLIST_FILE),
});

// Bind to localhost only — the app is meant to run locally.
app.listen(PORT, '127.0.0.1', () => {
  console.log(`TVmaze Explorer running at http://localhost:${PORT}`);
});
