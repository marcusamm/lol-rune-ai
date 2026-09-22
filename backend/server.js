const express = require('express');
const summonerRoutes = require('./routes/summoner');
const liveGameRoutes = require('./routes/liveGame');
const championStatsRoutes = require('./routes/championStats');

const app = express();

app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  next();
});

app.get('/', (_req, res) => res.json({ status: 'ok', service: 'runeai-backend' }));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/summoner', summonerRoutes);
app.use('/api/live-game', liveGameRoutes);
app.use('/api/champion-stats', championStatsRoutes);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`runeai-backend listening on ${port}`));
