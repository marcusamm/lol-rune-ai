// CLI entry point: watches champ select and auto-applies runes, printing
// progress to the console. See electron/main.js for the packaged-app
// version of the same watcher.
//
// Usage: node src/app.js
// Leave it running, then queue into Draft Pick or Ranked Solo/Duo.

const path = require('path');
const { MatchupWatcher } = require('./watcher');

const watcher = new MatchupWatcher({
  userDataDir: path.join(__dirname, '..', 'data'),
  autoApply: true,
});

watcher.on('status', (msg) => console.log(msg));
watcher.on('dataset-loaded', ({ source, matches }) =>
  console.log(`Dataset loaded (${source}): ${matches} matches.`)
);
watcher.on('client-status', (connected) => {
  if (!connected) console.log('League client not detected...');
});
watcher.on('champ-select-status', (s) => {
  if (!s) return;
  console.log(
    `You: ${s.myChamp} (${s.position}). Enemy picks visible: ${s.enemyChamps.join(', ') || 'none yet'}`
  );
});
watcher.on('recommendation', ({ myChamp, enemyChamp, position, rec }) => {
  if (!rec) {
    console.log(`No matchup data yet for ${myChamp} vs ${enemyChamp} (${position}).`);
    return;
  }
  console.log(
    `Guessed lane opponent: ${enemyChamp}. Best page for ${myChamp} vs ${enemyChamp} (${position}): ` +
      `${rec.source}, win rate ${(rec.winRate * 100).toFixed(1)}% over ${rec.games} games.`
  );
});
watcher.on('applied', () => console.log('Runes applied.'));
watcher.on('error', (err) => console.error('poll error:', err.message));

watcher.start().catch((err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
