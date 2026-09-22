// Talks to the Live Client Data API, exposed locally by the game process
// itself (League of Legends.exe) only while a match is actually in
// progress. Self-signed cert, no auth required. This is the same
// read-only source Blitz/Porofessor/OP.GG Live use for their overlays -
// it does not let us purchase items, only observe game state.

const https = require('https');

const HOST = '127.0.0.1';
const PORT = 2999;

function get(pathName) {
  const options = {
    hostname: HOST,
    port: PORT,
    path: pathName,
    method: 'GET',
    rejectUnauthorized: false,
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          resolve({ status: res.statusCode, body: null });
          return;
        }
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function getAllGameData() {
  return get('/liveclientdata/allgamedata');
}

module.exports = { getAllGameData };
