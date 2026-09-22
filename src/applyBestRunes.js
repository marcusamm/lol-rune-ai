// Manual test harness for the apply step, independent of live champ
// select: looks up the best page for a given matchup and pushes it to
// the client right now. Needs League open (lobby is fine, doesn't have
// to be in champ select) since it only touches the perks endpoint.
//
// Usage: node src/applyBestRunes.js --champion=Kayn --opponent=Lillia --position=JUNGLE

const { getLcuCredentials } = require('./lcu');
const { recommendPage, load } = require('./matchupDb');
const { applyRunePage } = require('./runes');

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.replace(/^--/, '').split('=');
    args[key] = value;
  }
  return args;
}

async function main() {
  const { champion, opponent, position } = parseArgs();
  if (!champion || !opponent || !position) {
    console.error('Usage: node src/applyBestRunes.js --champion=X --opponent=Y --position=TOP|JUNGLE|MIDDLE|BOTTOM|UTILITY');
    process.exit(1);
  }

  const rec = recommendPage(load(), champion, opponent, position);
  if (!rec) {
    console.log(`No data for ${champion} vs ${opponent} (${position}) yet.`);
    return;
  }

  console.log(
    `Recommendation (${rec.source}): win rate ${(rec.winRate * 100).toFixed(1)}% ` +
      `over ${rec.games} games. Perks: [${rec.selectedPerkIds.join(', ')}]`
  );

  const creds = getLcuCredentials();
  if (!creds) {
    console.log('League client not detected - open it and try again.');
    return;
  }

  const page = await applyRunePage(creds, rec);
  console.log(`Applied rune page "${page.name}" (id ${page.id}).`);
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
