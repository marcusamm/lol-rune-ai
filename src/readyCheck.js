// Auto-accepts the match-found ready check, the way Blitz/u.gg do.
// Only acts while a ready check is actually in progress and the local
// player hasn't already responded.

const { request } = require('./lcu');

async function acceptIfPending(creds) {
  const { status, body } = await request(creds, 'GET', '/lol-matchmaking/v1/ready-check');
  if (status !== 200 || !body) return false;

  if (body.state !== 'InProgress') return false;
  if (body.playerResponse && body.playerResponse !== 'None') return false;

  const accept = await request(creds, 'POST', '/lol-matchmaking/v1/ready-check/accept');
  return accept.status >= 200 && accept.status < 300;
}

module.exports = { acceptIfPending };
