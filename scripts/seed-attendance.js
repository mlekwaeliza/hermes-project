const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../server/database.sqlite');
const db = new sqlite3.Database(dbPath);

// Helper to run queries 
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

// Generate the last 4 Sundays
function getLastSundays(count) {
  const dates = [];
  const today = new Date();
  today.setDate(today.getDate() - today.getDay()); // Go back to most recent Sunday
  
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - (i * 7));
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates.reverse(); // chronological
}

async function seedAttendance() {
  const sundays = getLastSundays(6);
  console.log(`Seeding attendance for dates: ${sundays.join(', ')}`);

  const leaders = await all('SELECT * FROM leaders');
  if (leaders.length === 0) {
    console.error('No leaders found in database. Please upload a CSV roster first!');
    process.exit(1);
  }

  const admin = await get("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  const adminId = admin ? admin.id : 1;

  let totalSubmissions = 0;
  let totalAttendance = 0;

  for (const date of sundays) {
    for (const leader of leaders) {
      // 90% chance a leader submits on a given Sunday
      if (Math.random() < 0.90) {
        
        // Log submission
        try {
          await run('INSERT OR IGNORE INTO submission_log (leader_id, section_id, date) VALUES (?, ?, ?)', [leader.id, leader.section_id, date]);
          totalSubmissions++;
        } catch(e) {}

        const members = await all('SELECT id FROM members WHERE leader_id = ?', [leader.id]);
        
        for (let i = 0; i < members.length; i++) {
          const member = members[i];
          // Assign varying attendance probabilities so we get a diverse leaderboard
          // 1st member has 95% attendance, 2nd has 85%, etc.
          const prob = (i % 3 === 0) ? 0.95 : (i % 3 === 1) ? 0.85 : 0.60;
          
          let status;
          const roll = Math.random();
          if (roll < prob) status = 'present';
          else if (roll < prob + 0.05) status = 'excused';
          else status = 'absent';
          
          try {
            await run(
              'INSERT OR REPLACE INTO attendance (member_id, date, status, submitted_by, submitted_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
              [member.id, date, status, adminId]
            );
            totalAttendance++;
          } catch(e) {}
        }
      }
    }
  }

  console.log(`✅ Seeded ${totalSubmissions} submissions and ${totalAttendance} attendance records!`);
  console.log('Refresh your browser and click Full Year on the Rewards tab to see the podiums!');
}

seedAttendance().catch(err => console.error(err)).finally(() => db.close());
