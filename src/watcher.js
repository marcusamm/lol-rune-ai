// Core matchup-watching logic as an EventEmitter, shared by the CLI
// (src/app.js) and the Electron app (electron/main.js) so there's one
// implementation of "watch champ select, guess opponent, recommend/apply
// runes" instead of two copies drifting apart.

const EventEmitter = require('events');
const https = require('https');
const { getLcuCredentials, request } = require('./lcu');
const { recommendPage, guessLaneOpponent } = require('./matchupDb');
const { applyRunePage } = require('./runes');
const { loadDataset } = require('./dataSource');

function httpsGetJson(url) {
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

async function loadChampionIdToName() {
  const versions = await httpsGetJson('https://ddragon.leagueoflegends.com/api/versions.json');
  const version = versions[0];
  const champJson = await httpsGetJson(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`
  );
  const idToName = {};
  for (const champ of Object.values(champJson.data)) {
    idToName[Number(champ.key)] = champ.id;
  }
  return idToName;
}

class MatchupWatcher extends EventEmitter {
  constructor({ userDataDir, autoApply = true, pollMs = 2000 } = {}) {
    super();
    this.userDataDir = userDataDir;
    this.autoApply = autoApply;
    this.pollMs = pollMs;
    this.idToName = null;
    this.dataset = null;
    this.handledSessionId = null;
    this.timer = null;
  }

  async start() {
    this.emit('status', 'Loading champion data...');
    this.idToName = await loadChampionIdToName();

    await this.refreshDataset();

    this.emit('status', 'Watching for champ select...');
    this.timer = setInterval(() => {
      this.poll().catch((err) => this.emit('error', err));
    }, this.pollMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async refreshDataset() {
    this.emit('status', 'Loading matchup dataset...');
    const { data, source } = await loadDataset(this.userDataDir);
    this.dataset = data;
    this.emit('dataset-loaded', { source, matches: data.matchesProcessed });
  }

  setAutoApply(value) {
    this.autoApply = value;
  }

  championName(id) {
    return this.idToName[id] || null;
  }

  async poll() {
    const creds = getLcuCredentials();
    this.emit('client-status', Boolean(creds));
    if (!creds) return;

    const { status, body } = await request(creds, 'GET', '/lol-champ-select/v1/session');
    if (status !== 200) {
      this.emit('champ-select-status', null);
      return;
    }

    const sessionId = body.gameId || body.id;

    const localCellId = body.localPlayerCellId;
    const me = body.myTeam.find((p) => p.cellId === localCellId);
    if (!me || !me.championId) return;

    const position = (me.assignedPosition || '').toUpperCase();
    const myChamp = this.championName(me.championId);
    if (!myChamp) return;

    const enemyChamps = body.theirTeam
      .filter((p) => p.championId && p.championId !== 0)
      .map((p) => this.championName(p.championId))
      .filter(Boolean);

    this.emit('champ-select-status', {
      myChamp,
      position,
      enemyChamps,
      phase: body.timer?.phase,
    });

    if (sessionId === this.handledSessionId) return;
    if (!position) return; // no role assigned (ARAM etc.) - nothing to recommend
    if (body.timer?.phase !== 'FINALIZATION' || enemyChamps.length < 4) return;

    const enemyChamp = guessLaneOpponent(this.dataset, position, enemyChamps);
    if (!enemyChamp) return;

    const rec = recommendPage(this.dataset, myChamp, enemyChamp, position);
    if (!rec) {
      this.emit('recommendation', { myChamp, enemyChamp, position, rec: null });
      this.handledSessionId = sessionId;
      return;
    }

    this.emit('recommendation', { myChamp, enemyChamp, position, rec });

    if (this.autoApply) {
      await applyRunePage(creds, rec);
      this.emit('applied', { myChamp, enemyChamp, position, rec });
    }

    this.handledSessionId = sessionId;
  }
}

module.exports = { MatchupWatcher, loadChampionIdToName };
