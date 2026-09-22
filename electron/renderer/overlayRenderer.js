const gold = document.getElementById('gold');
const champLine = document.getElementById('champLine');
const threat = document.getElementById('threat');
const buyNow = document.getElementById('buyNow');
const nextGoals = document.getElementById('nextGoals');

function itemRow(item, isTop) {
  const version = item.ddragonVersion || '14.1.1';
  const why = item.reason ? ` &middot; <span class="why">${item.reason}</span>` : '';
  return `
    <div class="ov-item ${isTop ? 'top' : ''}">
      <img src="https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${item.itemId}.png"
           onerror="this.style.visibility='hidden'" alt="" />
      <div class="ov-item-body">
        <div class="ov-item-name">${item.name}</div>
        <div class="ov-item-sub"><span class="wr">${item.winRate}%</span> over ${item.games}g${why}</div>
      </div>
      ${item.cost != null ? `<span class="ov-cost">${item.cost}</span>` : ''}
    </div>`;
}

function renderList(el, items) {
  el.innerHTML = items.length
    ? items.map((i, idx) => itemRow(i, idx === 0)).join('')
    : '<div class="ov-empty">No data for this champion yet</div>';
}

window.overlay.onUpdate((payload) => {
  if (!payload || !payload.inGame) {
    champLine.textContent = 'Waiting for game…';
    gold.textContent = '—';
    threat.innerHTML = '';
    renderList(buyNow, []);
    renderList(nextGoals, []);
    return;
  }

  champLine.textContent = `${payload.championName}${payload.position ? ` · ${payload.position}` : ''}`;
  gold.textContent = `${Math.floor(payload.currentGold)}g`;

  const ap = Math.round((payload.enemyProfile?.apShare || 0) * 100);
  threat.innerHTML = `Enemy damage: <span class="ap">${ap}% AP</span> / <span class="ad">${100 - ap}% AD</span>`;

  renderList(buyNow, payload.buyNow || []);
  renderList(nextGoals, payload.nextGoals || []);
});
