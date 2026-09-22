const express = require('express');
const summonerRoutes = require('./routes/summoner');
const liveGameRoutes = require('./routes/liveGame');
const championStatsRoutes = require('./routes/championStats');
const championRoutes = require('./routes/champion');
const rankingsRoutes = require('./routes/rankings');
const analyticsRoutes = require('./routes/analytics');

const app = express();

app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  next();
});

// Serves the renderer over HTTP purely so the UI can be opened in a
// normal browser for visual checks; the packaged app loads it from disk.
app.use('/ui', express.static(require('path').join(__dirname, '..', 'electron', 'renderer')));

app.get('/', (_req, res) => res.json({ status: 'ok', service: 'runeai-backend' }));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/summoner', summonerRoutes);
app.use('/api/live-game', liveGameRoutes);
app.use('/api/champion-stats', championStatsRoutes);
app.use('/api/champion', championRoutes);
app.use('/api/rankings', rankingsRoutes);
app.use('/api/analytics', analyticsRoutes);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`runeai-backend listening on ${port}`));
