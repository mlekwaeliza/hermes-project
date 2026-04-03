const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Enable WAL mode for better concurrency
db.serialize(() => {
  db.run(`PRAGMA journal_mode = WAL`);

  // Initialize database schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'leader', 'pastor')),
      full_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS leaders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      section_id INTEGER NOT NULL,
      phone TEXT,
      email TEXT,
      is_head BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
      UNIQUE(user_id, section_id)
    );

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      membership_id TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      section_id INTEGER NOT NULL,
      leader_id INTEGER NOT NULL,
      phone TEXT,
      email TEXT,
      gender TEXT,
      age_group TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
      FOREIGN KEY (leader_id) REFERENCES leaders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      date DATE NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'excused')),
      submitted_by INTEGER NOT NULL,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
      FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(member_id, date)
    );

    CREATE TABLE IF NOT EXISTS submission_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leader_id INTEGER NOT NULL,
      section_id INTEGER NOT NULL,
      date DATE NOT NULL,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (leader_id) REFERENCES leaders(id) ON DELETE CASCADE,
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
      UNIQUE(leader_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_members_section ON members(section_id);
    CREATE INDEX IF NOT EXISTS idx_members_leader ON members(leader_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
    CREATE INDEX IF NOT EXISTS idx_attendance_member_date ON attendance(member_id, date);
    CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);
  `);

  // Migration: Add profile_picture to users if it doesn't exist
  db.run(`ALTER TABLE users ADD COLUMN profile_picture TEXT`, (err) => {
    // If column already exists, sqlite throws an error which we can safely ignore
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Migration note:', err.message);
    }
  });
});

// Helper function to promisify database operations
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Prepared statement wrappers
const queries = {
  // Auth queries
  findUserByUsername: (username) => get('SELECT * FROM users WHERE username = ?', [username]),
  createUser: (username, password_hash, role, full_name, profile_picture = null) =>
    run('INSERT INTO users (username, password_hash, role, full_name, profile_picture) VALUES (?, ?, ?, ?, ?)', [username, password_hash, role, full_name, profile_picture]),
  updateUserPassword: (password_hash, userId) =>
    run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [password_hash, userId]),
  updateUserFullName: (full_name, userId) =>
    run('UPDATE users SET full_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [full_name, userId]),

  // Section queries
  getAllSections: () => all('SELECT * FROM sections ORDER BY name'),
  getSectionByName: (name) => get('SELECT * FROM sections WHERE name = ?', [name]),
  createSection: (name) => run('INSERT INTO sections (name) VALUES (?)', [name]),

  // Leader queries
  getLeaderByUserId: (userId) => get(`
    SELECT l.*, s.name as section_name, u.username
    FROM leaders l
    JOIN sections s ON l.section_id = s.id
    JOIN users u ON l.user_id = u.id
    WHERE l.user_id = ?
  `, [userId]),
  getLeadersBySection: (sectionId) => all(`
    SELECT l.id, u.username, u.full_name, l.phone, l.email
    FROM leaders l
    JOIN users u ON l.user_id = u.id
    WHERE l.section_id = ?
  `, [sectionId]),
  createLeader: (userId, sectionId, phone, email) =>
    run('INSERT INTO leaders (user_id, section_id, phone, email) VALUES (?, ?, ?, ?)', [userId, sectionId, phone, email]),
  updateLeaderInfo: (leaderId, sectionId, phone, email) =>
    run('UPDATE leaders SET section_id = ?, phone = ?, email = ? WHERE id = ?', [sectionId, phone, email, leaderId]),
  deleteUserAndCascade: (userId) =>
    run('DELETE FROM users WHERE id = ?', [userId]),

  // Member queries
  getMembersByLeader: (leaderId) => all(`
    SELECT m.id, m.membership_id, m.full_name, m.phone, m.email, m.gender, m.age_group, s.name as section_name
    FROM members m
    JOIN sections s ON m.section_id = s.id
    WHERE m.leader_id = ?
    ORDER BY m.full_name
  `, [leaderId]),
  getMembersBySection: (sectionId) => all(`
    SELECT m.id, m.membership_id, m.full_name, m.phone, m.email, m.gender, m.age_group,
           u.full_name as leader_name
    FROM members m
    JOIN leaders l ON m.leader_id = l.id
    JOIN users u ON l.user_id = u.id
    WHERE m.section_id = ?
    ORDER BY m.full_name
  `, [sectionId]),
  getAllMembers: () => all(`
    SELECT m.*, s.name as section_name, u.full_name as leader_name
    FROM members m
    JOIN sections s ON m.section_id = s.id
    JOIN leaders l ON m.leader_id = l.id
    JOIN users u ON l.user_id = u.id
    ORDER BY s.name, m.full_name
  `),
  createMember: (membershipId, fullName, sectionId, leaderId, phone, email, gender, ageGroup) =>
    run(`
      INSERT INTO members (membership_id, full_name, section_id, leader_id, phone, email, gender, age_group)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [membershipId, fullName, sectionId, leaderId, phone, email, gender, ageGroup]),
  updateMember: (fullName, phone, email, gender, ageGroup, memberId) =>
    run(`
      UPDATE members
      SET full_name = ?, phone = ?, email = ?, gender = ?, age_group = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [fullName, phone, email, gender, ageGroup, memberId]),
  deleteMember: (id) => run('DELETE FROM members WHERE id = ?', [id]),
  getMemberByMembershipId: (membershipId) => get('SELECT * FROM members WHERE membership_id = ?', [membershipId]),

  // Attendance queries
  getAttendanceByLeaderAndDate: (leaderId, date) => all(`
    SELECT a.*, m.full_name as member_name, m.membership_id
    FROM attendance a
    JOIN members m ON a.member_id = m.id
    WHERE m.leader_id = ? AND a.date = ?
  `, [leaderId, date]),
  bulkInsertAttendance: (memberId, date, status, submittedBy) =>
    run(`
      INSERT OR REPLACE INTO attendance (member_id, date, status, submitted_by, submitted_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [memberId, date, status, submittedBy]),
  checkSubmissionExists: (leaderId, date) => get('SELECT * FROM submission_log WHERE leader_id = ? AND date = ?', [leaderId, date]),
  logSubmission: (leaderId, sectionId, date) =>
    run('INSERT INTO submission_log (leader_id, section_id, date) VALUES (?, ?, ?)', [leaderId, sectionId, date]),
  getAttendanceByDateAndSection: (date, sectionId) => all(`
    SELECT a.status, m.full_name, m.membership_id, u.full_name as leader_name
    FROM attendance a
    JOIN members m ON a.member_id = m.id
    JOIN leaders l ON m.leader_id = l.id
    JOIN users u ON l.user_id = u.id
    WHERE a.date = ? AND m.section_id = ?
  `, [date, sectionId]),

  // Dashboard/Stats queries
  getOverallAttendanceStats: () => all(`
    SELECT
      date,
      COUNT(*) as total_members,
      SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
      SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count,
      SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) as excused_count
    FROM attendance
    GROUP BY date
    ORDER BY date DESC
    LIMIT 30
  `),
  getLeaderSectionAttendanceStats: (leaderId, startDate, endDate) => all(`
    SELECT
      a.date,
      COUNT(*) as total_members,
      SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
      SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
      SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) as excused_count
    FROM attendance a
    JOIN members m ON a.member_id = m.id
    WHERE m.leader_id = ? AND a.date BETWEEN ? AND ?
    GROUP BY a.date
    ORDER BY a.date ASC
  `, [leaderId, startDate, endDate]),
  getSectionAttendanceStats: (startDate, endDate) => all(`
    SELECT
      s.name as section_name,
      a.date,
      COUNT(*) as total,
      SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present
    FROM attendance a
    JOIN members m ON a.member_id = m.id
    JOIN sections s ON m.section_id = s.id
    WHERE a.date BETWEEN ? AND ?
    GROUP BY s.name, a.date
    ORDER BY a.date DESC, s.name
  `, [startDate, endDate]),
  getLeaderMetrics: (startDate, endDate) => all(`
    SELECT
      u.full_name as leader_name,
      s.name as section_name,
      COUNT(DISTINCT a.date) as reporting_days,
      COUNT(*) as total_records,
      SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as total_present,
      ROUND(AVG(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0.0 END) * 100, 1) as attendance_rate
    FROM attendance a
    JOIN members m ON a.member_id = m.id
    JOIN leaders l ON m.leader_id = l.id
    JOIN users u ON l.user_id = u.id
    JOIN sections s ON l.section_id = s.id
    WHERE a.date BETWEEN ? AND ?
    GROUP BY l.id
    ORDER BY attendance_rate DESC
  `, [startDate, endDate]),
  getAtRiskMembers: () => all(`
    SELECT
      m.membership_id,
      m.full_name,
      s.name as section_name,
      u.full_name as leader_name,
      COUNT(*) as absence_count
    FROM attendance a
    JOIN members m ON a.member_id = m.id
    JOIN leaders l ON m.leader_id = l.id
    JOIN users u ON l.user_id = u.id
    JOIN sections s ON m.section_id = s.id
    WHERE a.status = 'absent'
      AND a.date BETWEEN DATE('now', '-30 days') AND DATE('now')
    GROUP BY m.id
    HAVING absence_count >= 3
    ORDER BY absence_count DESC
  `),
  getSubmissionCompletion: (startDate, endDate) => all(`
    SELECT
      s.name as section_name,
      u.full_name as leader_name,
      COUNT(DISTINCT sl.date) as days_submitted
    FROM submission_log sl
    JOIN leaders l ON sl.leader_id = l.id
    JOIN users u ON l.user_id = u.id
    JOIN sections s ON l.section_id = s.id
    WHERE sl.date BETWEEN ? AND ?
    GROUP BY l.id
    ORDER BY s.name, u.full_name
  `, [startDate, endDate]),
  
  // Profile Picture Queries
  updateUserProfilePicture: (profilePicturePath, userId) =>
    run('UPDATE users SET profile_picture = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [profilePicturePath, userId]),
};

// Transaction helper
function transaction(callback) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) return reject(err);
        try {
          const result = callback({ run, get, all });
          db.run('COMMIT', (err) => {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }
            resolve(result);
          });
        } catch (err) {
          db.run('ROLLBACK');
          reject(err);
        }
      });
    });
  });
}

module.exports = {
  db,
  queries,
  run,
  get,
  all,
  transaction
};
