const express = require('express');
const { platformGet, regionalGet } = require('../riotApi');

const router = express.Router();

const TIER_ENDPOINTS = {
  challenger: 'challengerleagues',
  grandmaster: 'grandmasterleagues',
  master: 'masterleagues',
};

// GET /api/rankings/:platform?tier=challenger&limit=50
router.get('/:platform', async (req, res) => {
  const { platform } = req.params;
  const tier = (req.query.tier || 'challenger').toLowerCase();
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  const endpoint = TIER_ENDPOINTS[tier];
  if (!endpoint) {
    return res.status(400).json({ error: `Unknown tier "${tier}"` });
  }

  try {
    const league = await platformGet(
      platform,
      `/lol/league/v4/${endpoint}/by-queue/RANKED_SOLO_5x5`
    );
    if (league.status !== 200) {
      return res.status(league.status).json({ error: 'League lookup failed', detail: league.body });
    }

    const entries = (league.body.entries || [])
      .sort((a, b) => b.leaguePoints - a.leaguePoints)
      .slice(0, limit);

    // Riot IDs aren't in the league payload, so resolve them per entry.
    const withNames = await Promise.all(
      entries.map(async (e, idx) => {
        let riotId = null;
        try {
          const acct = await regionalGet(platform, `/riot/account/v1/accounts/by-puuid/${e.puuid}`);
          if (acct.status === 200) riotId = `${acct.body.gameName}#${acct.body.tagLine}`;
        } catch {
          // a failed name lookup shouldn't drop the whole row
        }
        return {
          rank: idx + 1,
          riotId,
          leaguePoints: e.leaguePoints,
          wins: e.wins,
          losses: e.losses,
          winRate: Math.round((e.wins / (e.wins + e.losses)) * 100),
          hotStreak: e.hotStreak,
        };
      })
    );

    res.json({ platform, tier, players: withNames });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
