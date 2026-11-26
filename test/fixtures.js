// Trimmed-down copies of real TVmaze response shapes, used so tests never hit the network.

export const searchResponse = [
  {
    score: 0.9,
    show: {
      id: 169,
      url: 'https://www.tvmaze.com/shows/169/breaking-bad',
      name: 'Breaking Bad',
      genres: ['Drama', 'Crime', 'Thriller'],
      status: 'Ended',
      language: 'English',
      premiered: '2008-01-20',
      ended: '2013-09-29',
      rating: { average: 9.2 },
      network: { name: 'AMC' },
      webChannel: null,
      image: { medium: 'https://img/medium.jpg', original: 'https://img/original.jpg' },
      summary: '<p><b>Breaking Bad</b> follows protagonist Walter White &amp; his family.</p>',
      officialSite: 'http://www.amc.com/shows/breaking-bad',
    },
  },
  {
    score: 0.5,
    show: {
      id: 999,
      name: 'Web Only Show',
      genres: [],
      rating: { average: null },
      network: null,
      webChannel: { name: 'Netflix' },
      image: null,
      summary: null,
    },
  },
];

export const showDetailResponse = {
  ...searchResponse[0].show,
  _embedded: {
    episodes: [
      { id: 3, name: 'Seven Thirty-Seven', season: 2, number: 1, airdate: '2009-03-08', runtime: 60, rating: { average: 8.6 }, summary: '<p>S2 opener</p>' },
      { id: 2, name: "Cat's in the Bag...", season: 1, number: 2, airdate: '2008-01-27', runtime: 60, rating: { average: 8.4 }, summary: null },
      { id: 1, name: 'Pilot', season: 1, number: 1, airdate: '2008-01-20', runtime: 60, rating: { average: 8.9 }, summary: '<p>Walter gets diagnosed.</p>' },
      { id: 4, name: 'Special', season: 1, number: null, airdate: '', runtime: 10, rating: { average: null }, summary: null },
    ],
    cast: [
      {
        person: { id: 1, name: 'Bryan Cranston', image: { medium: 'https://img/bryan.jpg' } },
        character: { id: 10, name: 'Walter White', image: null },
        voice: false,
      },
      {
        person: { id: 2, name: 'Aaron Paul', image: null },
        character: { id: 11, name: 'Jesse Pinkman', image: { medium: 'https://img/jesse.jpg' } },
      },
    ],
  },
};

/** Minimal stand-in for fetch(): returns queued responses and records requested URLs. */
export function fakeFetch(handler) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    const { status = 200, body = null } = await handler(url);
    return { status, ok: status >= 200 && status < 300, json: async () => body };
  };
  fn.calls = calls;
  return fn;
}
