// Spike script for the item-build overlay: confirms what the Live Client
// Data API actually gives us once a match is in progress - your gold,
// your items, and (per the API's own scope) every player's purchased
// items and champion. Run this, load into a live game (a practice tool
// game is fine and faster to test with), and watch the output.

const fs = require('fs');
const path = require('path');
const { getAllGameData } = require('./liveClient');

const OUT_DIR = path.join(__dirname, '..', 'diagnostics');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

let savedOnce = false;

async function poll() {
  const { status, body } = await getAllGameData();
  if (status !== 200 || !body) {
    console.log('No live game detected. Waiting...');
    return;
  }

  const active = body.activePlayer;
  const all = body.allPlayers || [];
  const me = all.find((p) => p.summonerName === active?.summonerName);
  const myTeam = me ? me.team : null;
  const enemyLaner = all.find(
    (p) => p.team !== myTeam && p.position && me && p.position === me.position
  );

  console.log(
    `[${new Date().toLocaleTimeString()}] you=${me ? me.championName : '?'} ` +
      `gold=${active ? Math.floor(active.currentGold) : '?'} ` +
      `level=${me ? me.level : '?'} ` +
      `items=[${me ? me.items.map((i) => i.displayName).join(', ') : ''}] ` +
      (enemyLaner
        ? `| lane opp=${enemyLaner.championName} items=[${enemyLaner.items
            .map((i) => i.displayName)
            .join(', ')}]`
        : '| lane opp=unknown (no position data)')
  );

  // Save one full snapshot early on so we can inspect the real schema
  // (player.position field, item timing, etc.) without spamming files.
  if (!savedOnce) {
    savedOnce = true;
    const file = path.join(OUT_DIR, `livegame-${timestamp()}.json`);
    fs.writeFileSync(file, JSON.stringify(body, null, 2));
    console.log(`(full snapshot saved to ${file})`);
  }
}

console.log('Watching for a live League game...');
console.log('Load into a match (Practice Tool works and is fastest to test with).\n');

setInterval(() => {
  poll().catch((err) => console.error('poll error:', err.message));
}, 3000);
