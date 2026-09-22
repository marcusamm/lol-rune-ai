const express = require('express');
const { getDataset } = require('../dataset');

const router = express.Router();



// Wilson lower bound - same ranking used by the desktop app so the
// numbers people see here match what auto-apply actually picks.
function score(games, wins) {
  if (games === 0) return 0;
  const z = 1.96;
  const p = wins / games;
  const denom = 1 + (z * z) / games;
  const centre = p + (z * z) / (2 * games);
  const margin = z * Math.sqrt((p * (1 - p)) / games + (z * z) / (4 * games * games));
  return (centre - margin) / denom;
}

const NON_BUILD_ITEMS = new Set([
  2003, 2031, 2033, 2055, 2138, 2139, 2140, 2150, 2151, 2152, 3340, 3363, 3364, 3330,
  2010, 2019, 2052, 1515, 1516,
]);

function totals(bucket) {
  return Object.values(bucket || {}).reduce(
    (acc, s) => ({ games: acc.games + s.games, wins: acc.wins + s.wins }),
    { games: 0, wins: 0 }
  );
}

// GET /api/champion/:champion?position=JUNGLE
// Everything the app knows about one champion in one payload: per-role
// win rates, best rune page, most successful items and spells, plus the
// best and worst matchups against it.
router.get('/:champion', async (req, res) => {
  try {
    const data = await getDataset();
    const champion = req.params.champion;
    const roles = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];

    const byRole = roles
      .map((role) => {
        const t = totals(data.overall[`${champion}|${role}`]);
        if (!t.games) return null;
        return { role, games: t.games, winRate: Math.round((t.wins / t.games) * 1000) / 10 };
      })
      .filter(Boolean)
      .sort((a, b) => b.games - a.games);

    if (byRole.length === 0) {
      return res.status(404).json({ error: `No data for ${champion} yet` });
    }

    const position = (req.query.position || byRole[0].role).toUpperCase();
    const key = `${champion}|${position}`;

    const pages = Object.values(data.overall[key] || {})
      .map((p) => ({ ...p, winRate: p.wins / p.games, confidence: score(p.games, p.wins) }))
      .sort((a, b) => b.confidence - a.confidence);

    const items = Object.entries(data.items?.[key] || {})
      .filter(([id, s]) => !NON_BUILD_ITEMS.has(Number(id)) && s.games >= 2)
      .map(([id, s]) => ({
        itemId: Number(id),
        games: s.games,
        winRate: Math.round((s.wins / s.games) * 1000) / 10,
        confidence: score(s.games, s.wins),
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 8);

    const spells = Object.entries(data.spells?.[key] || {})
      .map(([combo, s]) => ({
        spellIds: combo.split('-').map(Number),
        games: s.games,
        winRate: Math.round((s.wins / s.games) * 1000) / 10,
        confidence: score(s.games, s.wins),
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);

    // Matchups: how this champion fares against each opponent in this role.
    const matchups = [];
    for (const [mKey, bucket] of Object.entries(data.byMatchup)) {
      const [champ, opponent, pos] = mKey.split('|');
      if (champ !== champion || pos !== position) continue;
      const t = totals(bucket);
      if (t.games < 2) continue;
      matchups.push({
        opponent,
        games: t.games,
        winRate: Math.round((t.wins / t.games) * 1000) / 10,
      });
    }
    matchups.sort((a, b) => b.winRate - a.winRate);

    const totalDatasetGames = Object.values(data.overall).reduce(
      (sum, b) => sum + totals(b).games,
      0
    );
    const championGames = byRole.reduce((sum, r) => sum + r.games, 0);

    res.json({
      champion,
      position,
      byRole,
      pickRate: totalDatasetGames
        ? Math.round((championGames / totalDatasetGames) * 1000) / 10
        : null,
      bestPage: pages[0] || null,
      alternatePages: pages.slice(1, 3),
      items,
      spells,
      strongAgainst: matchups.slice(0, 5),
      weakAgainst: matchups.slice(-5).reverse(),
      matchesInDataset: data.matchesProcessed,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
