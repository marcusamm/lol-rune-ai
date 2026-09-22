// Spike script: answers one question before we build anything else -
// does the LCU champ-select session actually expose the enemy team's
// champion picks (theirTeam[].championId), or does Riot's champ-select
// "fog of war" keep it hidden until the game loads?
//
// Run this, then start a Draft Pick or Ranked queue. It polls every 2s
// and prints whether enemy champion IDs are visible, and dumps each
// snapshot to ./diagnostics/ so we can inspect the full session shape.

const fs = require('fs');
const path = require('path');
const { getLcuCredentials, request } = require('./lcu');

const OUT_DIR = path.join(__dirname, '..', 'diagnostics');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function poll() {
  const creds = getLcuCredentials();
  if (!creds) {
    console.log('League client not detected (is it running?). Retrying...');
    return;
  }

  const { status, body } = await request(creds, 'GET', '/lol-champ-select/v1/session');
  if (status !== 200) {
    console.log(`Not currently in champ select (status ${status}). Waiting...`);
    return;
  }

  const theirTeam = body.theirTeam || [];
  const myTeam = body.myTeam || [];
  const enemyChampsVisible = theirTeam.filter((p) => p.championId && p.championId !== 0);

  console.log(
    `[${new Date().toLocaleTimeString()}] phase=${body.timer && body.timer.phase} ` +
      `myTeam champs=[${myTeam.map((p) => p.championId).join(',')}] ` +
      `theirTeam champs=[${theirTeam.map((p) => p.championId).join(',')}] ` +
      `enemyVisible=${enemyChampsVisible.length}/${theirTeam.length}`
  );

  const file = path.join(OUT_DIR, `champselect-${timestamp()}.json`);
  fs.writeFileSync(file, JSON.stringify(body, null, 2));
}

console.log('Watching for a League champ select session...');
console.log('Start a Draft Pick or Ranked queue now and let it run through pick/ban.');
console.log(`Snapshots will be saved to ${OUT_DIR}\n`);

setInterval(() => {
  poll().catch((err) => console.error('poll error:', err.message));
}, 2000);
