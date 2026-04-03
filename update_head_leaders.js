const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'server', 'database.sqlite'));

db.serialize(() => {
  console.log("Adding is_head column...");
  db.run("ALTER TABLE leaders ADD COLUMN is_head BOOLEAN DEFAULT 0", (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error(err);
    } else {
      console.log("Column added (or already exists).");
    }

    // Set specific users as Head Leaders
    const headLeaders = ['ELIZABETH NEHEMIAH', 'NEEMA DICKSON', 'HAPPINESS ERASTO', 'HAPPY JOSEPH SIKAWA'];
    const placeholders = headLeaders.map(() => '?').join(',');
    
    // First, find their user_ids
    db.all(`SELECT id, full_name FROM users WHERE full_name IN (${placeholders})`, headLeaders, (err, rows) => {
      if (err) return console.error(err);
      
      const userIds = rows.map(r => r.id);
      console.log(`Setting ${userIds.length} users to Head Leaders...`);
      
      const idPlaceholders = userIds.map(() => '?').join(',');
      db.run(`UPDATE leaders SET is_head = 1 WHERE user_id IN (${idPlaceholders})`, userIds, function(err) {
        if (err) return console.error(err);
        console.log(`Successfully updated ${this.changes} leader records!`);
        db.close();
      });
    });
  });
});
