const clientDot = document.getElementById('clientDot');
const clientText = document.getElementById('clientText');
const datasetText = document.getElementById('datasetText');
const refreshBtn = document.getElementById('refreshBtn');
const autoApplyToggle = document.getElementById('autoApplyToggle');

const champSelectCard = document.getElementById('champSelectCard');
const youText = document.getElementById('youText');
const enemiesText = document.getElementById('enemiesText');
const phaseText = document.getElementById('phaseText');

const recommendationCard = document.getElementById('recommendationCard');
const recText = document.getElementById('recText');
const appliedText = document.getElementById('appliedText');

const logList = document.getElementById('logList');

function log(msg) {
  const div = document.createElement('div');
  const time = new Date().toLocaleTimeString();
  div.textContent = `[${time}] ${msg}`;
  logList.prepend(div);
  while (logList.children.length > 100) logList.removeChild(logList.lastChild);
}

window.runeAI.onStatus((msg) => log(msg));

window.runeAI.onDatasetLoaded(({ source, matches }) => {
  datasetText.textContent = `${matches} matches (${source})`;
  log(`Dataset loaded: ${matches} matches, source=${source}`);
});

window.runeAI.onClientStatus((connected) => {
  clientDot.classList.toggle('on', connected);
  clientText.textContent = connected ? 'Connected' : 'Not detected';
});

window.runeAI.onChampSelectStatus((s) => {
  if (!s) {
    champSelectCard.hidden = true;
    return;
  }
  champSelectCard.hidden = false;
  youText.textContent = `${s.myChamp} (${s.position || 'role not assigned yet'})`;
  enemiesText.textContent = s.enemyChamps.length ? s.enemyChamps.join(', ') : 'none yet';
  phaseText.textContent = s.phase || '-';
});

window.runeAI.onRecommendation(({ myChamp, enemyChamp, position, rec }) => {
  recommendationCard.hidden = false;
  appliedText.hidden = true;
  if (!rec) {
    recText.textContent = `No matchup data yet for ${myChamp} vs ${enemyChamp} (${position}).`;
    return;
  }
  recText.textContent =
    `${myChamp} vs ${enemyChamp} (${position}): ${rec.source}, ` +
    `${(rec.winRate * 100).toFixed(1)}% win rate over ${rec.games} games.`;
  log(`Recommendation: ${recText.textContent}`);
});

window.runeAI.onApplied(() => {
  appliedText.hidden = false;
  log('Runes applied.');
});

window.runeAI.onWatcherError((msg) => log(`Error: ${msg}`));
window.runeAI.onFatalError((msg) => log(`Fatal: ${msg}`));

refreshBtn.addEventListener('click', () => {
  log('Refreshing dataset...');
  window.runeAI.refreshDataset();
});

autoApplyToggle.addEventListener('change', () => {
  window.runeAI.setAutoApply(autoApplyToggle.checked);
  log(`Auto-apply ${autoApplyToggle.checked ? 'enabled' : 'disabled'}.`);
});
