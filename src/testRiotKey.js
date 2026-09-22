// Quick sanity check that RIOT_API_KEY in .env is valid.

const { platformGet } = require('./riotApi');

async function main() {
  const { status, body } = await platformGet(
    'euw1',
    '/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5'
  );

  if (status === 200) {
    console.log(`Key works. Challenger EUW1 has ${body.entries.length} players.`);
  } else {
    console.log(`Request failed (status ${status}):`, body);
  }
}

main();
