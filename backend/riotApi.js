// Server-side Riot API client. The key lives only here (set as an env var
// on the hosting platform), never shipped to the desktop app.

const https = require('https');

const API_KEY = process.env.RIOT_API_KEY;
if (!API_KEY) {
  console.error('RIOT_API_KEY is not set.');
}

// Riot's real personal-key limits: 20 req/1s and 100 req/2min. A flat
// 1.3s-per-request delay (safe for the slow batch collector) makes live
// lookups that fan out to 10-18 players painfully slow, so this tracks
// actual request timestamps in sliding windows and only waits when a
// window would genuinely be exceeded - letting bursts run near-parallel.
const recentTimestamps = [];
const PER_SECOND_LIMIT = 18; // small buffer under Riot's 20
const PER_TWO_MIN_LIMIT = 95; // small buffer under Riot's 100

async function waitForSlot() {
  for (;;) {
    const now = Date.now();
    while (recentTimestamps.length && now - recentTimestamps[0] > 120000) {
      recentTimestamps.shift();
    }
    const lastSecond = recentTimestamps.filter((t) => now - t < 1000).length;

    if (recentTimestamps.length < PER_TWO_MIN_LIMIT && lastSecond < PER_SECOND_LIMIT) {
      recentTimestamps.push(now);
      return;
    }

    const waitFor2Min = recentTimestamps.length >= PER_TWO_MIN_LIMIT ? 120000 - (now - recentTimestamps[0]) : 0;
    const oldestInLastSecond = recentTimestamps.find((t) => now - t < 1000);
    const waitFor1Sec = lastSecond >= PER_SECOND_LIMIT ? 1000 - (now - oldestInLastSecond) : 0;
    await new Promise((r) => setTimeout(r, Math.max(waitFor2Min, waitFor1Sec, 20)));
  }
}

function rawGet(host, pathName) {
  const options = {
    hostname: host,
    port: 443,
    path: pathName,
    method: 'GET',
    headers: { 'X-Riot-Token': API_KEY },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
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

async function throttledGet(host, pathName) {
  const maxAttempts = 3;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await waitForSlot();
    try {
      const result = await rawGet(host, pathName);
      if (result.status === 429) {
        const retryAfter = Number(result.headers['retry-after'] || 2);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }
      if (result.status >= 500 && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }
      return result;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw lastErr || new Error('Request failed after retries');
}

const PLATFORM_TO_REGION = {
  euw1: 'europe', eun1: 'europe', tr1: 'europe', ru: 'europe',
  na1: 'americas', br1: 'americas', la1: 'americas', la2: 'americas',
  oc1: 'sea', kr: 'asia', jp1: 'asia',
};

function platformGet(platform, pathName) {
  return throttledGet(`${platform}.api.riotgames.com`, pathName);
}

function regionalGet(platform, pathName) {
  const region = PLATFORM_TO_REGION[platform];
  if (!region) throw new Error(`Unknown platform ${platform}`);
  return throttledGet(`${region}.api.riotgames.com`, pathName);
}

module.exports = { platformGet, regionalGet, PLATFORM_TO_REGION };
