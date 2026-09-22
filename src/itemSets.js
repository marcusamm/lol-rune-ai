// Pushes a generated item set into the League client so the recommended
// build shows up in the in-game shop. Item sets are per-summoner and
// replace-by-full-list, so we read the existing sets, drop any previous
// RuneAI-generated ones, and write ours back alongside the user's own.

const { request } = require('./lcu');

const SET_PREFIX = 'RuneAI:';

async function currentSummonerId(creds) {
  const { status, body } = await request(creds, 'GET', '/lol-summoner/v1/current-summoner');
  if (status !== 200) throw new Error(`Couldn't read current summoner (status ${status})`);
  return body.summonerId;
}

function buildItemSet(championName, championId, position, itemIds) {
  return {
    title: `${SET_PREFIX} ${championName} ${position}`,
    type: 'custom',
    map: 'SR',
    mode: 'any',
    priority: false,
    sortrank: 1,
    associatedChampions: championId ? [championId] : [],
    associatedMaps: [11],
    blocks: [
      {
        type: 'Most Built (by win rate)',
        items: itemIds.map((id) => ({ id: String(id), count: 1 })),
      },
    ],
  };
}

async function applyItemSet(creds, { championName, championId, position, itemIds }) {
  if (!itemIds || itemIds.length === 0) return null;

  const summonerId = await currentSummonerId(creds);
  const existing = await request(creds, 'GET', `/lol-item-sets/v1/item-sets/${summonerId}/sets`);
  const sets = existing.status === 200 && Array.isArray(existing.body?.itemSets)
    ? existing.body.itemSets.filter((s) => !s.title?.startsWith(SET_PREFIX))
    : [];

  sets.unshift(buildItemSet(championName, championId, position, itemIds));

  const { status, body } = await request(
    creds,
    'PUT',
    `/lol-item-sets/v1/item-sets/${summonerId}/sets`,
    { accountId: existing.body?.accountId ?? 0, itemSets: sets, timestamp: Date.now() }
  );

  if (status !== 200 && status !== 201 && status !== 204) {
    throw new Error(`Failed to write item set (status ${status}): ${JSON.stringify(body)}`);
  }
  return sets[0].title;
}

module.exports = { applyItemSet, SET_PREFIX };
