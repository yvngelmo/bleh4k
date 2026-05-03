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

server.get('/proxy', async (req, res) => {
  const url = req.query.lib;
  
  if(!url) {
    return res.status(400).json({ error: 'no url' });
  }
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if(!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const buf = await response.arrayBuffer();
    res.set('Content-Type', 'application/octet-stream');
    res.end(Buffer.from(buf));
    
  } catch(e) { 
    res.status(500).json({ error: e.message }); 
  }
});

server.listen(3000, () => console.log('running on localhost:3000'));