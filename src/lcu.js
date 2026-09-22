// Talks to the League Client Update (LCU) API, which runs locally whenever
// the League client is open. Credentials aren't in a fixed place across
// installs, so we read them off the running LeagueClientUx.exe process
// command line instead of assuming an install path.

const { execFileSync } = require('child_process');
const https = require('https');

function getLcuCredentials() {
  let cmdLine;
  try {
    cmdLine = execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "(Get-CimInstance Win32_Process -Filter \"name='LeagueClientUx.exe'\").CommandLine",
      ],
      { encoding: 'utf8' }
    ).trim();
  } catch (err) {
    return null;
  }
  if (!cmdLine) return null;

  const portMatch = cmdLine.match(/--app-port=(\d+)/);
  const tokenMatch = cmdLine.match(/--remoting-auth-token=([\w-]+)/);
  if (!portMatch || !tokenMatch) return null;

  return { port: portMatch[1], token: tokenMatch[1] };
}

function request(creds, method, path, body) {
  const auth = Buffer.from(`riot:${creds.token}`).toString('base64');
  const payload = body ? JSON.stringify(body) : undefined;

  const options = {
    hostname: '127.0.0.1',
    port: creds.port,
    path,
    method,
    // LCU uses a self-signed cert local to the machine.
    rejectUnauthorized: false,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
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
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

module.exports = { getLcuCredentials, request };
