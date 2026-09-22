// Local-only: loads RIOT_API_KEY from the repo root .env before starting
// the server, so we don't have to export it manually. Render sets env
// vars via its own dashboard in production - this file isn't used there.
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

require('./server.js');
