// Single source for the matchup dataset, shared by the stats routes.
// Prefers the local file the collector writes (so freshly collected data
// shows up without a publish round-trip) and falls back to the published
// copy when running somewhere without the repo checked out.

const fs = require('fs');
const path = require('path');
const https = require('https');

const LOCAL_FILE = path.join(__dirname, '..', 'data', 'matchups.json');
const PUBLISHED_URL =
  'https://raw.githubusercontent.com/marcusamm/lol-rune-ai/main/data/matchups.json';
const REFRESH_MS = 5 * 60 * 1000;

let cache = null;
let cachedAt = 0;
let cachedMtime = 0;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', reject);
  });
}

async function getDataset() {
  if (fs.existsSync(LOCAL_FILE)) {
    const mtime = fs.statSync(LOCAL_FILE).mtimeMs;
    if (!cache || mtime !== cachedMtime) {
      cache = JSON.parse(fs.readFileSync(LOCAL_FILE, 'utf8'));
      cachedMtime = mtime;
      cachedAt = Date.now();
    }
    return cache;
  }

  if (cache && Date.now() - cachedAt < REFRESH_MS) return cache;
  cache = await fetchJson(PUBLISHED_URL);
  cachedAt = Date.now();
  return cache;
}

module.exports = { getDataset };
