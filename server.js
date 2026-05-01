const express = require('express');
const Database = require('better-sqlite3');

const server = express();
const leaderboard = new Database('leaderboard.db');

server.use(express.json());
server.use(express.static('.'));

leaderboard.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    placementid INTEGER PRIMARY KEY AUTOINCREMENT,
    trackident TEXT,
    username TEXT,
    score REAL,
    date INTEGER
  )
`);

server.post('/score', (req, res) => {
  const { trackident, username, score, date } = req.body;
  leaderboard.prepare('INSERT INTO scores (trackident, username, score, date) VALUES (?, ?, ?, ?)').run(trackident, username, score, date);
  res.json({ ok: true });
});

server.get('/leaderboard/:trackident', (req, res) => {
  const scores = leaderboard.prepare('SELECT username, score, date FROM scores WHERE trackident = ? ORDER BY score DESC').all(req.params.trackident);
  res.json(scores);
});

server.listen(3000, () => console.log('running on localhost:3000'));