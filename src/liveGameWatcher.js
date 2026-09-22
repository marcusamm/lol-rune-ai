// Watches the running game via the Live Client Data API and emits build
// advice. Separate from MatchupWatcher, which only covers champ select:
// this one is only alive while an actual match is in progress.

const EventEmitter = require('events');
const https = require('https');
const { getAllGameData } = require('./liveClient');
const { recommendNextItems } = require('./liveAdvisor');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', reject);
  });
}

class LiveGameWatcher extends EventEmitter {
  constructor({ pollMs = 5000 } = {}) {
    super();
    this.pollMs = pollMs;
    this.timer = null;
    this.itemMeta = null;
    this.ddragonVersion = null;
    this.dataset = null;
    this.wasInGame = false;
  }

  setDataset(dataset) {
    this.dataset = dataset;
  }

  async loadItemMeta() {
    const versions = await fetchJson('https://ddragon.leagueoflegends.com/api/versions.json');
    this.ddragonVersion = versions[0];
    const items = await fetchJson(
      `https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/data/en_US/item.json`
    );
    this.itemMeta = {};
    for (const [id, item] of Object.entries(items.data)) {
      this.itemMeta[Number(id)] = { name: item.name, cost: item.gold?.total ?? null };
    }
  }

  async start() {
    if (!this.itemMeta) await this.loadItemMeta();
    this.timer = setInterval(() => {
      this.poll().catch((err) => this.emit('error', err));
    }, this.pollMs);
    this.poll().catch(() => {});
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async poll() {
    const { status, body } = await getAllGameData();

    if (status !== 200 || !body?.activePlayer) {
      if (this.wasInGame) {
        this.wasInGame = false;
        this.emit('game-ended');
      }
      this.emit('update', { inGame: false });
      return;
    }

    if (!this.wasInGame) {
      this.wasInGame = true;
      this.emit('game-started');
    }

    const active = body.activePlayer;
    const all = body.allPlayers || [];
    const me = all.find((p) => p.riotId === active.riotId || p.summonerName === active.summonerName);

    if (!me || !this.dataset) {
      this.emit('update', { inGame: true, championName: me?.championName || '?', currentGold: active.currentGold, buyNow: [], nextGoals: [] });
      return;
    }

    const ownedItemIds = (me.items || []).map((i) => i.itemID);
    const position = (me.position || '').toUpperCase();

    const advice = recommendNextItems({
      dataset: this.dataset,
      championName: me.championName,
      position: position || 'MIDDLE',
      ownedItemIds,
      currentGold: active.currentGold,
      allPlayers: all,
      myTeam: me.team,
      itemMeta: this.itemMeta,
    });

    const withVersion = (list) => list.map((i) => ({ ...i, ddragonVersion: this.ddragonVersion }));

    this.emit('update', {
      inGame: true,
      championName: me.championName,
      position,
      currentGold: active.currentGold,
      enemyProfile: advice.enemyProfile,
      buyNow: withVersion(advice.buyNow),
      nextGoals: withVersion(advice.nextGoals),
    });
  }
}

module.exports = { LiveGameWatcher };
