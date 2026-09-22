// Thin wrapper around Riot's official REST API. Two routing schemes:
// - "platform" hosts (e.g. euw1.api.riotgames.com) for league-v4, summoner-v4
// - "regional" hosts (e.g. europe.api.riotgames.com) for account-v1, match-v5
//
// Personal dev keys are rate-limited (roughly 20 req/1s, 100 req/2min) -
// requestQueue() below serializes calls with a fixed delay so we don't
// get 429'd, rather than trying to be clever about bursting.

const https = require('https');
const { loadEnv } = require('./env');

loadEnv();

const API_KEY = process.env.RIOT_API_KEY;
if (!API_KEY) {
  console.error('RIOT_API_KEY is not set. Put it in .env as RIOT_API_KEY=RGAPI-...');
}

// Conservative spacing between requests, safe under the personal-key limits.
const MIN_GAP_MS = 1300;
let lastRequestAt = 0;
let queue = Promise.resolve();

function rawGet(host, pathName) {
  const options = {
    hostname: host,
    port: 443,
    path: pathName,
    method: 'GET',
    headers: {
      'X-Riot-Token': API_KEY,
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : null;
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode, body: parsed, headers: res.headers });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Serializes every call through this module onto one queue, spaced out,
// so concurrent callers never blow through the rate limit together.
function throttledGet(host, pathName) {
  const run = async () => {
    const wait = Math.max(0, MIN_GAP_MS - (Date.now() - lastRequestAt));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();

    const maxAttempts = 4;
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await rawGet(host, pathName);
        if (result.status === 429) {
          const retryAfter = Number(result.headers['retry-after'] || 2);
          console.warn(`Rate limited, waiting ${retryAfter}s...`);
          await new Promise((r) => setTimeout(r, retryAfter * 1000));
          continue;
        }
        if (result.status >= 500 && attempt < maxAttempts) {
          console.warn(`Server error ${result.status}, retrying (${attempt}/${maxAttempts})...`);
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }
        return result;
      } catch (err) {
        lastErr = err;
        console.warn(`Network error (${err.code || err.message}), retrying (${attempt}/${maxAttempts})...`);
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
    throw lastErr || new Error('Request failed after retries');
  };

  const result = queue.then(run);
  // Keep the queue alive even if this call rejects.
  queue = result.catch(() => {});
  return result;
}

function platformGet(platform, pathName) {
  return throttledGet(`${platform}.api.riotgames.com`, pathName);
}

function regionalGet(region, pathName) {
  return throttledGet(`${region}.api.riotgames.com`, pathName);
}

module.exports = { platformGet, regionalGet };
