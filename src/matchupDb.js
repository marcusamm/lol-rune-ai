// Queries data/matchups.json for the best rune page given a matchup.
// Falls back to the champion's overall best page (ignoring opponent) when
// the specific matchup doesn't have enough games to trust.

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'matchups.json');
const MIN_MATCHUP_GAMES = 8; // below this, matchup-specific data is too noisy

function load() {
  if (!fs.existsSync(DATA_FILE)) {
    throw new Error(`${DATA_FILE} not found - run src/collectMatchups.js first.`);
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

// Wilson lower bound: ranks pages by "win rate we're confident in", not
// raw win rate, so a page that's 2-0 doesn't outrank one that's 340-210.
function score(games, wins) {
  if (games === 0) return 0;
  const z = 1.96;
  const p = wins / games;
  const denom = 1 + (z * z) / games;
  const centre = p + (z * z) / (2 * games);
  const margin = z * Math.sqrt((p * (1 - p)) / games + (z * z) / (4 * games * games));
  return (centre - margin) / denom;
}

function bestPage(pagesObj) {
  const pages = Object.values(pagesObj || {});
  if (pages.length === 0) return null;
  let best = null;
  let bestScore = -1;
  for (const page of pages) {
    const s = score(page.games, page.wins);
    if (s > bestScore) {
      bestScore = s;
      best = page;
    }
  }
  return { ...best, winRate: best.wins / best.games, confidence: bestScore };
}

function totalGames(pagesObj) {
  return Object.values(pagesObj || {}).reduce((sum, p) => sum + p.games, 0);
}

// theirTeam never carries assignedPosition (LCU doesn't reveal enemy
// roles), so guess the lane opponent as whichever visible enemy champion
// has the most recorded games at *our* position, using our own dataset.
function roleGames(data, champion, position) {
  const pages = data.overall[`${champion}|${position}`];
  if (!pages) return 0;
  return Object.values(pages).reduce((sum, p) => sum + p.games, 0);
}

function guessLaneOpponent(data, position, enemyChampions) {
  let best = null;
  let bestGames = -1;
  for (const champion of enemyChampions) {
    const games = roleGames(data, champion, position);
    if (games > bestGames) {
      bestGames = games;
      best = champion;
    }
  }
  return bestGames > 0 ? best : null;
}

function recommendPage(data, champion, opponent, position) {
  const matchupKey = `${champion}|${opponent}|${position}`;
  const overallKey = `${champion}|${position}`;

  const matchupPages = data.byMatchup[matchupKey];
  if (matchupPages && totalGames(matchupPages) >= MIN_MATCHUP_GAMES) {
    return { source: 'matchup', matchupKey, ...bestPage(matchupPages) };
  }

  const overallPages = data.overall[overallKey];
  if (overallPages && totalGames(overallPages) > 0) {
    return { source: 'champion-overall', matchupKey: overallKey, ...bestPage(overallPages) };
  }

  return null;
}

// Top items for a champion+role by confidence-weighted win rate. Filters
// out consumables/wards/trinkets so the set is an actual build path, not
// "every item that was in someone's inventory at the end".
const NON_BUILD_ITEMS = new Set([
  2003, 2031, 2033, 2055, 2138, 2139, 2140, 2150, 2151, 2152, 3340, 3363, 3364, 3330,
  2010, 2019, 2052, 1515, 1516,
]);

function recommendItems(data, champion, position, limit = 6) {
  const items = (data.items || {})[`${champion}|${position}`];
  if (!items) return [];

  return Object.entries(items)
    .filter(([id, s]) => !NON_BUILD_ITEMS.has(Number(id)) && s.games >= 3)
    .map(([id, s]) => ({
      itemId: Number(id),
      games: s.games,
      wins: s.wins,
      winRate: s.wins / s.games,
      confidence: score(s.games, s.wins),
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}

function recommendSpells(data, champion, position) {
  const spells = (data.spells || {})[`${champion}|${position}`];
  if (!spells) return null;

  const best = Object.entries(spells)
    .map(([combo, s]) => ({
      spellIds: combo.split('-').map(Number),
      games: s.games,
      winRate: s.wins / s.games,
      confidence: score(s.games, s.wins),
    }))
    .sort((a, b) => b.confidence - a.confidence)[0];

  return best || null;
}

module.exports = { recommendPage, recommendItems, recommendSpells, guessLaneOpponent, load };
