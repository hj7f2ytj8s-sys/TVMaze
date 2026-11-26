import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, formatYears, formatEpisodeCode, truncate } from '../public/lib.js';

test('parseRoute recognises search, show and watchlist routes', () => {
  assert.deepEqual(parseRoute(''), { name: 'search', query: '' });
  assert.deepEqual(parseRoute('#/?q=the%20office'), { name: 'search', query: 'the office' });
  assert.deepEqual(parseRoute('#/show/169'), { name: 'show', id: 169 });
  assert.deepEqual(parseRoute('#/watchlist'), { name: 'watchlist' });
  assert.deepEqual(parseRoute('#/show/abc'), { name: 'search', query: '' });
});

test('formatYears handles running, ended and single-year shows', () => {
  assert.equal(formatYears('2008-01-20', '2013-09-29'), '2008–2013');
  assert.equal(formatYears('2020-05-01', null), '2020–');
  assert.equal(formatYears('2019-01-01', '2019-12-01'), '2019');
  assert.equal(formatYears(null, null), '');
});

test('formatEpisodeCode pads numbers and labels specials', () => {
  assert.equal(formatEpisodeCode(1, 5), 'S01E05');
  assert.equal(formatEpisodeCode(12, 103), 'S12E103');
  assert.equal(formatEpisodeCode(1, null), 'Special');
});

test('truncate cuts on a word boundary', () => {
  assert.equal(truncate('short', 10), 'short');
  assert.equal(truncate('one two three four', 10), 'one two…');
  assert.equal(truncate(null), '');
});
