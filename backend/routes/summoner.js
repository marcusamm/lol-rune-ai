const express = require('express');
const { platformGet, regionalGet } = require('../riotApi');

const router = express.Router();

const QUEUE_NAMES = {
  420: 'Ranked Solo/Duo',
  440: 'Ranked Flex',
};

// GET /api/summoner/:platform/:gameName/:tagLine
router.get('/:platform/:gameName/:tagLine', async (req, res) => {
  const { platform, gameName, tagLine } = req.params;

  try {
    const account = await regionalGet(
      platform,
      `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    );
    if (account.status !== 200) {
      return res.status(account.status).json({ error: 'Player not found', detail: account.body });
    }
    const puuid = account.body.puuid;

    const [summoner, league, matchIds] = await Promise.all([
      platformGet(platform, `/lol/summoner/v4/summoners/by-puuid/${puuid}`),
      platformGet(platform, `/lol/league/v4/entries/by-puuid/${puuid}`),
      regionalGet(platform, `/lol/match/v5/matches/by-puuid/${puuid}/ids?count=5`),
    ]);

    const matches = Array.isArray(matchIds.body)
      ? await Promise.all(
          matchIds.body.map((id) => regionalGet(platform, `/lol/match/v5/matches/${id}`))
        )
      : [];

    const recentMatches = matches
      .filter((m) => m.status === 200 && m.body?.info)
      .map((m) => {
        const p = m.body.info.participants.find((pp) => pp.puuid === puuid);
        if (!p) return null;
        return {
          championName: p.championName,
          win: p.win,
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          position: p.teamPosition,
          queue: QUEUE_NAMES[m.body.info.queueId] || m.body.info.queueId,
          gameCreation: m.body.info.gameCreation,
        };
      })
      .filter(Boolean);

    res.json({
      riotId: `${account.body.gameName}#${account.body.tagLine}`,
      puuid,
      profileIconId: summoner.body?.profileIconId,
      summonerLevel: summoner.body?.summonerLevel,
      ranks: Array.isArray(league.body)
        ? league.body.map((r) => ({
            queue: QUEUE_NAMES[r.queueType] || r.queueType,
            tier: r.tier,
            rank: r.rank,
            leaguePoints: r.leaguePoints,
            wins: r.wins,
            losses: r.losses,
          }))
        : [],
      recentMatches,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
