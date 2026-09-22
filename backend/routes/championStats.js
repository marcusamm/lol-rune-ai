const express = require('express');
const { getDataset } = require('../dataset');

const router = express.Router();



function totalGames(pagesObj) {
  return Object.values(pagesObj || {}).reduce((sum, p) => sum + p.games, 0);
}

function totalWins(pagesObj) {
  return Object.values(pagesObj || {}).reduce((sum, p) => sum + p.wins, 0);
}

// GET /api/champion-stats/:champion - overall win rate per role, from
// recorded games (pick rate/ban rate require tracking bans, not yet
// collected - this reports win rate and sample size for now).
router.get('/:champion', async (req, res) => {
  try {
    const data = await getDataset();
    const champion = req.params.champion;
    const roles = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];

    const byRole = roles
      .map((role) => {
        const pages = data.overall[`${champion}|${role}`];
        if (!pages) return null;
        const games = totalGames(pages);
        const wins = totalWins(pages);
        return { role, games, winRate: games ? Math.round((wins / games) * 1000) / 10 : 0 };
      })
      .filter(Boolean);

    if (byRole.length === 0) {
      return res.status(404).json({ error: `No data for ${champion} yet` });
    }

    res.json({ champion, byRole, matchesInDataset: data.matchesProcessed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/champion-stats - list every champion we have data for, sorted
// by total games (a rough popularity/sample-size proxy for a tier list).
router.get('/', async (req, res) => {
  try {
    const data = await getDataset();
    const byChampion = {};

    for (const key of Object.keys(data.overall)) {
      const [champion, role] = key.split('|');
      const pages = data.overall[key];
      const games = totalGames(pages);
      const wins = totalWins(pages);
      if (!byChampion[champion]) byChampion[champion] = { champion, games: 0, wins: 0, roles: [] };
      byChampion[champion].games += games;
      byChampion[champion].wins += wins;
      byChampion[champion].roles.push(role);
    }

    const list = Object.values(byChampion)
      .map((c) => ({
        champion: c.champion,
        games: c.games,
        winRate: c.games ? Math.round((c.wins / c.games) * 1000) / 10 : 0,
        roles: c.roles,
      }))
      .sort((a, b) => b.games - a.games);

    res.json({ champions: list, matchesInDataset: data.matchesProcessed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
