// TODO: update to the deployed Render URL once the backend is live.
// Falls back to localhost for local development.
module.exports = {
  BACKEND_URL: process.env.RUNEAI_BACKEND_URL || 'http://localhost:3000',
};
