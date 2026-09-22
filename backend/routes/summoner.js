const express = require('express');
const { platformGet, regionalGet } = require('../riotApi');

const router = express.Router();

const QUEUE_NAMES = {
  420: 'Ranked Solo/Duo',
  440: 'Ranked Flex',
};

const MATCH_SAMPLE_SIZE = 15; // used for both the recent-games list and the role breakdown

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

    const [summoner, league, mastery, matchIds] = await Promise.all([
      platformGet(platform, `/lol/summoner/v4/summoners/by-puuid/${puuid}`),
      platformGet(platform, `/lol/league/v4/entries/by-puuid/${puuid}`),
      platformGet(platform, `/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=3`),
      regionalGet(platform, `/lol/match/v5/matches/by-puuid/${puuid}/ids?count=${MATCH_SAMPLE_SIZE}`),
    ]);

    const matches = Array.isArray(matchIds.body)
      ? await Promise.all(matchIds.body.map((id) => regionalGet(platform, `/lol/match/v5/matches/${id}`)))
      : [];

    const parsed = matches
      .filter((m) => m.status === 200 && m.body?.info)
      .map((m) => {
        const info = m.body.info;
        const p = info.participants.find((pp) => pp.puuid === puuid);
        if (!p) return null;

        const team = info.participants.filter((pp) => pp.teamId === p.teamId);
        const teamKills = team.reduce((sum, pp) => sum + pp.kills, 0);
        const teammates = team.filter((pp) => pp.puuid !== puuid).map((pp) => pp.championName);

        return {
          championName: p.championName,
          win: p.win,
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          position: p.teamPosition,
          summoner1Id: p.summoner1Id,
          summoner2Id: p.summoner2Id,
          cs: (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0),
          killParticipation: teamKills > 0 ? Math.round(((p.kills + p.assists) / teamKills) * 100) : null,
          teammates,
          queue: QUEUE_NAMES[info.queueId] || info.queueId,
          gameDurationSeconds: info.gameDuration,
          gameCreation: info.gameCreation,
        };
      })
      .filter(Boolean);

    // Role breakdown across the whole sample, not just what's displayed.
    const roleStats = {};
    for (const m of parsed) {
      if (!m.position) continue;
      if (!roleStats[m.position]) roleStats[m.position] = { games: 0, wins: 0 };
      roleStats[m.position].games += 1;
      if (m.win) roleStats[m.position].wins += 1;
    }
    const roles = Object.entries(roleStats)
      .map(([position, s]) => ({
        position,
        games: s.games,
        winRate: Math.round((s.wins / s.games) * 100),
      }))
      .sort((a, b) => b.games - a.games);

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
      topChampions: Array.isArray(mastery.body)
        ? mastery.body.map((c) => ({
            championId: c.championId,
            level: c.championLevel,
            points: c.championPoints,
          }))
        : [],
      roles,
      recentMatches: parsed.slice(0, 10),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
