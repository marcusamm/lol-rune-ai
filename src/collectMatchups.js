// Builds data/matchups.json: for every (champion, opponent, role) seen in
// high-elo ranked solo matches, tracks which exact rune pages were played
// and their win rate. This is the dataset the live app will query.
//
// Usage: node src/collectMatchups.js [--platform=euw1] [--summoners=60] [--matchesPerSummoner=15]
//
// Safe to re-run: already-processed matches are skipped, so you can stop
// it (Ctrl+C) and resume later, or run it again later to add fresh games.

const fs = require('fs');
const path = require('path');
const { platformGet, regionalGet } = require('./riotApi');

const PLATFORM_TO_REGION = {
  euw1: 'europe',
  eun1: 'europe',
  tr1: 'europe',
  ru: 'europe',
  na1: 'americas',
  br1: 'americas',
  la1: 'americas',
  la2: 'americas',
  oc1: 'sea',
  kr: 'asia',
  jp1: 'asia',
};

function parseArgs() {
  const args = { platform: 'euw1', summoners: 60, matchesPerSummoner: 15 };
  for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.replace(/^--/, '').split('=');
    if (key === 'platform') args.platform = value;
    if (key === 'summoners') args.summoners = Number(value);
    if (key === 'matchesPerSummoner') args.matchesPerSummoner = Number(value);
  }
  return args;
}

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'matchups.json');
const SEEN_MATCHES_FILE = path.join(DATA_DIR, 'seenMatches.json');

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveJson(file, data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
}

// Fingerprint of an exact rune page (not just the keystone) so we can
// track win rate per specific page and hand back the exact perk IDs
// needed to recreate it via the LCU API later.
function runePage(participant) {
  const styles = participant.perks.styles;
  const primary = styles.find((s) => s.description === 'primaryStyle');
  const sub = styles.find((s) => s.description === 'subStyle');
  if (!primary || !sub) return null;

  const primaryPerks = primary.selections.map((s) => s.perk);
  const subPerks = sub.selections.map((s) => s.perk);
  const statPerks = participant.perks.statPerks;
  const selectedPerkIds = [
    ...primaryPerks,
    ...subPerks,
    statPerks.offense,
    statPerks.flex,
    statPerks.defense,
  ];

  return {
    primaryStyleId: primary.style,
    subStyleId: sub.style,
    selectedPerkIds,
    key: selectedPerkIds.join('-'),
  };
}

function recordResult(bucket, matchupKey, page, won) {
  if (!bucket[matchupKey]) bucket[matchupKey] = {};
  const pages = bucket[matchupKey];
  if (!pages[page.key]) {
    pages[page.key] = {
      games: 0,
      wins: 0,
      primaryStyleId: page.primaryStyleId,
      subStyleId: page.subStyleId,
      selectedPerkIds: page.selectedPerkIds,
    };
  }
  pages[page.key].games += 1;
  if (won) pages[page.key].wins += 1;
}

async function main() {
  const { platform, summoners, matchesPerSummoner } = parseArgs();
  const region = PLATFORM_TO_REGION[platform];
  if (!region) throw new Error(`Unknown platform ${platform}`);

  const data = loadJson(DATA_FILE, { byMatchup: {}, overall: {}, matchesProcessed: 0 });
  const seenMatches = new Set(loadJson(SEEN_MATCHES_FILE, []));

  console.log(`Fetching Challenger + Grandmaster puuids on ${platform}...`);
  const [challenger, grandmaster] = await Promise.all([
    platformGet(platform, '/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5'),
    platformGet(platform, '/lol/league/v4/grandmasterleagues/by-queue/RANKED_SOLO_5x5'),
  ]);

  const entries = [
    ...(challenger.body?.entries || []),
    ...(grandmaster.body?.entries || []),
  ];
  // Highest LP first - most games, most reliably current-patch.
  entries.sort((a, b) => b.leaguePoints - a.leaguePoints);
  const puuids = entries.slice(0, summoners).map((e) => e.puuid);
  console.log(`Using ${puuids.length} summoners.`);

  const matchIdSet = new Set();
  for (const [i, puuid] of puuids.entries()) {
    let body;
    try {
      ({ body } = await regionalGet(
        region,
        `/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&count=${matchesPerSummoner}`
      ));
    } catch (err) {
      console.log(`[${i + 1}/${puuids.length}] skip (request failed after retries: ${err.message})`);
      continue;
    }
    if (Array.isArray(body)) {
      for (const id of body) matchIdSet.add(id);
    }
    console.log(`[${i + 1}/${puuids.length}] collected match ids, total unique so far: ${matchIdSet.size}`);
  }

  const matchIds = [...matchIdSet].filter((id) => !seenMatches.has(id));
  console.log(`${matchIds.length} new matches to process (${matchIdSet.size - matchIds.length} already seen).`);

  for (const [i, matchId] of matchIds.entries()) {
    let status, body;
    try {
      ({ status, body } = await regionalGet(region, `/lol/match/v5/matches/${matchId}`));
    } catch (err) {
      console.log(`  skip ${matchId} (request failed after retries: ${err.message})`);
      continue;
    }
    if (status !== 200 || !body?.info) {
      console.log(`  skip ${matchId} (status ${status})`);
      continue;
    }

    const participants = body.info.participants;
    for (const p of participants) {
      if (!p.teamPosition) continue; // ARAM / arena / no role data
      const page = runePage(p);
      if (!page) continue;

      const opponent = participants.find(
        (o) => o.teamId !== p.teamId && o.teamPosition === p.teamPosition
      );
      if (!opponent) continue;

      const matchupKey = `${p.championName}|${opponent.championName}|${p.teamPosition}`;
      const overallKey = `${p.championName}|${p.teamPosition}`;
      recordResult(data.byMatchup, matchupKey, page, p.win);
      recordResult(data.overall, overallKey, page, p.win);
    }

    seenMatches.add(matchId);
    data.matchesProcessed += 1;

    if ((i + 1) % 10 === 0 || i === matchIds.length - 1) {
      saveJson(DATA_FILE, data);
      saveJson(SEEN_MATCHES_FILE, [...seenMatches]);
      console.log(`  [${i + 1}/${matchIds.length}] processed, ${data.matchesProcessed} total matches saved.`);
    }
  }

  saveJson(DATA_FILE, data);
  saveJson(SEEN_MATCHES_FILE, [...seenMatches]);
  console.log(`Done. ${data.matchesProcessed} matches in dataset -> ${DATA_FILE}`);
}

main().catch((err) => {
  console.error('Collector failed:', err);
  process.exit(1);
});
