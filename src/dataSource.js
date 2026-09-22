// Loads the matchup dataset for the shipped app. End users never touch
// the Riot API directly - this fetches a pre-built matchups.json that the
// maintainer publishes periodically (from running collectMatchups.js with
// their own key), caches it locally, and falls back to the last-known-good
// copy if the fetch fails (offline, host down, etc).

const fs = require('fs');
const path = require('path');
const https = require('https');

// Published dataset, refreshed periodically by re-running
// collectMatchups.js and pushing the result to the repo.
const DATASET_URL =
  process.env.RUNEAI_DATASET_URL ||
  'https://raw.githubusercontent.com/marcusamm/lol-rune-ai/main/data/matchups.json';

function cachePath(userDataDir) {
  return path.join(userDataDir, 'matchups.json');
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchJson(res.headers.location).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Dataset fetch failed: HTTP ${res.statusCode}`));
          return;
        }
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

async function loadDataset(userDataDir) {
  const localCache = cachePath(userDataDir);

  if (DATASET_URL) {
    try {
      const fresh = await fetchJson(DATASET_URL);
      fs.mkdirSync(userDataDir, { recursive: true });
      fs.writeFileSync(localCache, JSON.stringify(fresh));
      return { data: fresh, source: 'remote' };
    } catch (err) {
      console.warn(`Couldn't fetch remote dataset (${err.message}), falling back to cache.`);
    }
  }

  if (fs.existsSync(localCache)) {
    return { data: JSON.parse(fs.readFileSync(localCache, 'utf8')), source: 'cache' };
  }

  // Dev fallback: the local dataset built by collectMatchups.js directly.
  const devDataFile = path.join(__dirname, '..', 'data', 'matchups.json');
  if (fs.existsSync(devDataFile)) {
    return { data: JSON.parse(fs.readFileSync(devDataFile, 'utf8')), source: 'dev-local' };
  }

  throw new Error('No matchup dataset available (no remote URL set, no cache, no local dev data).');
}

module.exports = { loadDataset, DATASET_URL };
