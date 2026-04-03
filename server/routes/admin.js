const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { queries, run, db } = require('../database');
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Apply authentication to all routes
router.use(isAuthenticated);

// GET all sections
router.get('/sections', async (req, res) => {
  try {
    const sections = await queries.getAllSections();
    res.json(sections);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sections' });
  }
});

// POST create section
router.post('/sections', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Section name required' });
    }
    await queries.createSection(name);
    res.json({ message: 'Section created' });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Section already exists' });
    }
    res.status(500).json({ error: 'Failed to create section' });
  }
});

// GET all members (with optional filters)
router.get('/members', async (req, res) => {
  try {
    const { section_id, leader_id, membership_id } = req.query;

    if (membership_id) {
      const member = await queries.getMemberByMembershipId(membership_id);
      return res.json(member ? [member] : []);
    }

    let members;
    if (section_id) {
      members = await queries.getMembersBySection(section_id);
    } else if (leader_id) {
      const membersByLeader = await queries.getMembersByLeader(leader_id);
      members = membersByLeader.map(m => ({
        ...m,
        section_name: m.section_name || 'Unknown'
      }));
    } else {
      members = await queries.getAllMembers();
    }
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// PUT update member
router.put('/members/:id', async (req, res) => {
  try {
    const { full_name, phone, email, gender, age_group } = req.body;
    const { id } = req.params;

    await queries.updateMember(full_name, phone, email, gender, age_group, id);
    res.json({ message: 'Member updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// DELETE member
router.delete('/members/:id', async (req, res) => {
  try {
    await queries.deleteMember(req.params.id);
    res.json({ message: 'Member deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete member' });
  }
});

// --- Leader CRUD ---
// POST create leader
router.post('/leaders', async (req, res) => {
  try {
    const { username, full_name, section_id, phone, email } = req.body;
    if (!username || !full_name || !section_id) {
      return res.status(400).json({ error: 'Username, full name, and section are required' });
    }
    // Check if user exists
    const existingUser = await queries.findUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken' });
    }
    // Default password for new leaders
    const passwordHash = bcrypt.hashSync('leader123', 10);
    const { lastID: userId } = await queries.createUser(username, passwordHash, 'leader', full_name);
    await queries.createLeader(userId, section_id, phone, email);
    res.json({ message: 'Leader created successfully', userId });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Username already taken' });
    }
    res.status(500).json({ error: 'Failed to create leader' });
  }
});

// PUT update leader
router.put('/leaders/:id', async (req, res) => {
  try {
    const { full_name, section_id, phone, email } = req.body;
    const { id } = req.params; // this is the leader id
    
    // First, get the leader to find the user_id
    const db = require('../database').get;
    const leader = await db('SELECT user_id FROM leaders WHERE id = ?', [id]);
    if (!leader) return res.status(404).json({ error: 'Leader not found' });
    
    // Update users table
    if (full_name) {
      const { run } = require('../database');
      await run('UPDATE users SET full_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [full_name, leader.user_id]);
    }
    // Update leaders table
    await queries.updateLeaderInfo(id, section_id, phone, email);
    res.json({ message: 'Leader updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update leader' });
  }
});

// DELETE leader
router.delete('/leaders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = require('../database').get;
    const leader = await db('SELECT user_id FROM leaders WHERE id = ?', [id]);
    if (!leader) return res.status(404).json({ error: 'Leader not found' });
    
    // Deleting the user will securely cascade delete the leader and members
    await queries.deleteUserAndCascade(leader.user_id);
    res.json({ message: 'Leader deleted successfully along with associated records' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete leader' });
  }
});

// POST upload CSV
router.post('/upload-csv', upload.single('csv'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'CSV file required' });
  }

  const results = {
    sectionsCreated: 0,
    leadersCreated: 0,
    membersCreated: 0,
    errors: []
  };

  const tempDir = path.join(__dirname, '..', 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const tempPath = path.join(tempDir, `${uuidv4()}.csv`);

  try {
    fs.writeFileSync(tempPath, req.file.buffer);

    const rows = await new Promise((resolve, reject) => {
      const data = [];
      fs.createReadStream(tempPath)
        .pipe(csv())
        .on('data', (row) => data.push(row))
        .on('end', () => resolve(data))
        .on('error', reject);
    });

    const sectionsMap = new Map();
    const leadersMap = new Map();
    const userPasswords = new Map();

    // Pre-populate existing sections
    const existingSections = await queries.getAllSections();
    existingSections.forEach(s => sectionsMap.set(s.name.toLowerCase().trim(), s.id));

    for (const row of rows) {
      try {
        const sectionName = row.Section?.trim();
        const leaderName = row.LeaderName?.trim();
        const membershipId = row.MembershipID?.trim();
        const fullName = row.FullName?.trim();

        if (!sectionName || !leaderName || !membershipId || !fullName) {
          results.errors.push(`Row skipped: missing required fields for ${fullName || 'unknown member'}`);
          continue;
        }

        // Create or get section
        let sectionId = sectionsMap.get(sectionName.toLowerCase());
        if (!sectionId) {
          try {
            await queries.createSection(sectionName);
            const section = await queries.getSectionByName(sectionName);
            sectionId = section.id;
            sectionsMap.set(sectionName.toLowerCase(), sectionId);
            results.sectionsCreated++;
          } catch (error) {
            if (error.message.includes('UNIQUE')) {
              const section = await queries.getSectionByName(sectionName);
              sectionId = section.id;
              sectionsMap.set(sectionName.toLowerCase(), sectionId);
            } else {
              results.errors.push(`Failed to create section "${sectionName}": ${error.message}`);
              continue;
            }
          }
        }

        // Create leader user if not exists
        const leaderUsername = leaderName.toLowerCase().replace(/\s+/g, '_');
        let leaderUser = await queries.findUserByUsername(leaderUsername);

        if (!leaderUser) {
          const tempPassword = `temp_${uuidv4().substring(0, 8)}`;
          const passwordHash = bcrypt.hashSync(tempPassword, 10);
          try {
            await queries.createUser(leaderUsername, passwordHash, 'leader', leaderName);
            leaderUser = await queries.findUserByUsername(leaderUsername);
            userPasswords.set(leaderUsername, tempPassword);
            results.leadersCreated++;
          } catch (error) {
            results.errors.push(`Failed to create leader user "${leaderUsername}": ${error.message}`);
            continue;
          }
        }

        // Get or create leader record
        let leaderRecord = await queries.getLeaderByUserId(leaderUser.id);
        if (!leaderRecord) {
          try {
            await queries.createLeader(leaderUser.id, sectionId, row.LeaderPhone || null, row.LeaderEmail || null);
            leaderRecord = await queries.getLeaderByUserId(leaderUser.id);
          } catch (error) {
            results.errors.push(`Failed to create leader record for ${leaderName}: ${error.message}`);
            continue;
          }
        }

        const leaderId = leaderRecord.id;

        // Check if member exists
        const existingMember = await queries.getMemberByMembershipId(membershipId);
        if (existingMember) {
          await queries.updateMember(
            fullName,
            row.Phone || null,
            row.Email || null,
            row.Gender || null,
            row.AgeGroup || null,
            existingMember.id
          );
          continue;
        }

        // Create new member
        try {
          await queries.createMember(
            membershipId,
            fullName,
            sectionId,
            leaderId,
            row.Phone || null,
            row.Email || null,
            row.Gender || null,
            row.AgeGroup || null
          );
          results.membersCreated++;
        } catch (error) {
          results.errors.push(`Failed to create member ${membershipId}: ${error.message}`);
        }
      } catch (error) {
        results.errors.push(`Unexpected error: ${error.message}`);
      }
    }

    // Cleanup temp file
    fs.unlinkSync(tempPath);

    res.json({
      message: 'CSV uploaded successfully',
      results,
      tempPasswords: userPasswords.size > 0 ? Array.from(userPasswords.entries()).map(([username, password]) => ({ username, password })) : null
    });
  } catch (error) {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath, () => {});
    }
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// GET all attendance (with filters)
router.get('/attendance', async (req, res) => {
  try {
    const { date, section_id, leader_id } = req.query;

    let query = `
      SELECT a.*, m.full_name as member_name, m.membership_id, s.name as section_name, u.full_name as leader_name
      FROM attendance a
      JOIN members m ON a.member_id = m.id
      JOIN sections s ON m.section_id = s.id
      JOIN leaders l ON m.leader_id = l.id
      JOIN users u ON l.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (req.query.filterType && req.query.filterValue) {
      if (req.query.filterType === 'yearly') {
        query += " AND strftime('%Y', a.date) = ?";
        params.push(req.query.filterValue);
      } else if (req.query.filterType === 'monthly') {
        query += " AND strftime('%Y-%m', a.date) = ?";
        params.push(req.query.filterValue);
      } else if (req.query.filterType === 'weekly') {
        const parts = req.query.filterValue.split('-W');
        query += " AND strftime('%Y-%W', a.date) = ?";
        params.push(`${parts[0]}-${parts[1].padStart(2, '0')}`);
      }
    } else if (date) {
      query += ' AND a.date = ?';
      params.push(date);
    }
    if (section_id) {
      query += ' AND m.section_id = ?';
      params.push(section_id);
    }
    if (leader_id) {
      query += ' AND m.leader_id = ?';
      params.push(leader_id);
    }

    query += ' ORDER BY a.date DESC, m.full_name';

    const attendance = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    res.json(attendance);
  } catch (error) {
    console.error('Attendance fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

// PUT update attendance (admin override)
router.put('/attendance/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    if (!['present', 'absent', 'excused'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await run('UPDATE attendance SET status = ?, submitted_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);
    res.json({ message: 'Attendance updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update attendance' });
  }
});

// GET export attendance as CSV
router.get('/export', async (req, res) => {
  try {
    const { start_date, end_date, section_id } = req.query;

    let query = `
      SELECT
        a.date,
        s.name as section_name,
        u.full_name as leader_name,
        m.membership_id,
        m.full_name as member_name,
        a.status
      FROM attendance a
      JOIN members m ON a.member_id = m.id
      JOIN sections s ON m.section_id = s.id
      JOIN leaders l ON m.leader_id = l.id
      JOIN users u ON l.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      query += ' AND a.date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND a.date <= ?';
      params.push(end_date);
    }
    if (section_id) {
      query += ' AND s.id = ?';
      params.push(section_id);
    }

    query += ' ORDER BY a.date DESC, s.name, m.full_name';

    const records = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Convert to CSV
    const headers = ['Date', 'Section', 'Leader', 'MembershipID', 'MemberName', 'Status'];
    const csvRows = [];
    csvRows.push(headers.join(','));

    records.forEach(row => {
      const values = [
        row.date,
        `"${row.section_name}"`,
        `"${row.leader_name}"`,
        row.membership_id,
        `"${row.member_name}"`,
        row.status
      ];
      csvRows.push(values.join(','));
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvRows.join('\n'));
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// GET leaders list (for admin management)
router.get('/leaders', async (req, res) => {
  try {
    const leaders = await new Promise((resolve, reject) => {
      db.all(`
        SELECT l.id, u.username, u.full_name, s.name as section_name, l.phone, l.email
        FROM leaders l
        JOIN users u ON l.user_id = u.id
        JOIN sections s ON l.section_id = s.id
        ORDER BY s.name, u.full_name
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    res.json(leaders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaders' });
  }
});

// POST reset leader password
router.post('/leaders/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;

    // Get leader's user account with username
    const leader = await new Promise((resolve, reject) => {
      db.get(`
        SELECT l.user_id, u.username
        FROM leaders l
        JOIN users u ON l.user_id = u.id
        WHERE l.id = ?
      `, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!leader) {
      return res.status(404).json({ error: 'Leader not found' });
    }

    // Generate temporary password
    const tempPassword = `temp_${uuidv4().substring(0, 8)}`;
    const passwordHash = bcrypt.hashSync(tempPassword, 10);

    // Update user password
    await run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [passwordHash, leader.user_id]);

    res.json({
      message: 'Password reset successful',
      temp_password: tempPassword,
      username: leader.username
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// POST create a member (Admin override)
router.post('/members', async (req, res) => {
  try {
    const { membership_id, full_name, section_id, leader_id, phone, email, gender, age_group } = req.body;
    if (!membership_id || !full_name || !section_id || !leader_id) {
      return res.status(400).json({ error: 'Membership ID, Name, Section, and Leader are required' });
    }

    const existingMember = await queries.getMemberByMembershipId(membership_id);
    if (existingMember) {
      return res.status(400).json({ error: 'Membership ID already exists' });
    }

    await queries.createMember(
      membership_id, full_name, section_id, leader_id,
      phone || null, email || null, gender || null, age_group || null
    );

    res.json({ message: 'Member created successfully' });
  } catch (error) {
    console.error('Create member error:', error);
    res.status(500).json({ error: 'Failed to create member' });
  }
});

// GET global history
router.get('/history', async (req, res) => {
  try {
    const history = await new Promise((resolve, reject) => {
      db.all(`
        SELECT sl.date, sl.submitted_at, u.full_name as leader_name, s.name as section_name, COUNT(a.id) as records_count
        FROM submission_log sl
        JOIN leaders l ON sl.leader_id = l.id
        JOIN users u ON l.user_id = u.id
        JOIN sections s ON sl.section_id = s.id
        LEFT JOIN attendance a ON sl.date = a.date AND a.submitted_by = u.id
        GROUP BY sl.id
        ORDER BY sl.date DESC, sl.submitted_at DESC
        LIMIT 200
      `, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch global history' });
  }
});

// GET global attendance trends
router.get('/attendance-trends', async (req, res) => {
  try {
    const { days = 90 } = req.query;
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    const startDateStr = startDate.toISOString().split('T')[0];

    const trends = await new Promise((resolve, reject) => {
        const query = `
          SELECT 
            date,
            SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
            SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count,
            SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) as excused_count,
            COUNT(*) as total_members
          FROM attendance
          WHERE date >= ? AND date <= ?
          GROUP BY date
          ORDER BY date ASC
        `;
        db.all(query, [startDateStr, endDate], (err, rows) => {
          if (err) reject(err); else resolve(rows || []);
        });
    });

    res.json({ trends, date_range: { start: startDateStr, end: endDate } });
  } catch (error) {
    console.error('Global Trends error:', error);
    res.status(500).json({ error: 'Failed to fetch global attendance trends' });
  }
});

// GET section overview for admin
router.get('/section-overview/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const { section_id } = req.query;

    const allLeaders = await new Promise((resolve, reject) => {
        let q = `SELECT l.id, u.full_name as full_name, l.phone, s.name as section_name, l.section_id FROM leaders l JOIN users u ON l.user_id = u.id JOIN sections s ON l.section_id = s.id`;
        let params = [];
        if (section_id) { q += ` WHERE l.section_id = ?`; params.push(section_id); }
        db.all(q, params, (err, rows) => {
            if (err) reject(err); else resolve(rows);
        });
    });

    const attendance = await new Promise((resolve, reject) => {
        let q = `SELECT a.*, u.full_name as leader_name FROM attendance a JOIN members m ON a.member_id = m.id JOIN leaders l ON m.leader_id = l.id JOIN users u ON l.user_id = u.id WHERE a.date = ?`;
        let params = [date];
        if (section_id) { q += ` AND m.section_id = ?`; params.push(section_id); }
        db.all(q, params, (err, rows) => {
            if (err) reject(err); else resolve(rows);
        });
    });

    const logs = await new Promise((resolve, reject) => {
      let q = 'SELECT leader_id FROM submission_log WHERE date = ?';
      let params = [date];
      if (section_id) { q += ' AND section_id = ?'; params.push(section_id); }
      db.all(q, params, (err, rows) => {
        if (err) reject(err); else resolve(rows);
      });
    });
    
    const submittedLeaderIds = new Set(logs.map(l => l.leader_id));
    const stats = { present: 0, absent: 0, excused: 0, total_submitted_leaders: submittedLeaderIds.size, total_leaders: allLeaders.length };
    
    const subleaderReport = allLeaders.map(l => {
      const leaderAttendance = attendance.filter(a => a.leader_name === l.full_name);
      const lStats = { present: 0, absent: 0, excused: 0 };
      leaderAttendance.forEach(a => {
        if (a.status === 'present') { lStats.present++; stats.present++; }
        if (a.status === 'absent') { lStats.absent++; stats.absent++; }
        if (a.status === 'excused') { lStats.excused++; stats.excused++; }
      });

      return {
        leader_id: l.id,
        leader_name: l.full_name,
        section_name: l.section_name,
        phone: l.phone,
        submitted: submittedLeaderIds.has(l.id),
        stats: lStats
      };
    });

    res.json({
      section_name: section_id ? subleaderReport[0]?.section_name : 'Global',
      date,
      stats,
      subleaders: subleaderReport
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

// GET aggregated overview for weekly, monthly, yearly
router.get('/aggregated-overview', async (req, res) => {
  try {
    const { filterType, filterValue } = req.query;
    
    if (!['weekly', 'monthly', 'yearly'].includes(filterType) || !filterValue) {
      return res.status(400).json({ error: 'Valid filterType and filterValue required' });
    }

    let dateCondition = '';
    let params = [];
    
    if (filterType === 'yearly') {
      dateCondition = "strftime('%Y', a.date) = ?";
      params.push(filterValue);
    } else if (filterType === 'monthly') {
      dateCondition = "strftime('%Y-%m', a.date) = ?";
      params.push(filterValue);
    } else if (filterType === 'weekly') {
      const parts = filterValue.split('-W');
      if (parts.length === 2) {
         dateCondition = "strftime('%Y-%W', a.date) = ?";
         params.push(`${parts[0]}-${parts[1].padStart(2, '0')}`);
      } else {
         return res.status(400).json({ error: 'Invalid weekly format' });
      }
    }

    const attendance = await new Promise((resolve, reject) => {
        let q = `SELECT a.*, l.id as leader_id FROM attendance a JOIN members m ON a.member_id = m.id JOIN leaders l ON m.leader_id = l.id WHERE ${dateCondition}`;
        db.all(q, params, (err, rows) => {
          if (err) reject(err); else resolve(rows);
        });
    });

    const allLeaders = await queries.getAllLeaders();
    const stats = { present: 0, absent: 0, excused: 0, total_submitted_leaders: 0, total_leaders: allLeaders.length };
    
    const logs = await new Promise((resolve, reject) => {
       db.all(`SELECT leader_id FROM submission_log a WHERE ${dateCondition}`, params, (err, rows) => {
          if(err) resolve([]); else resolve(rows);
       });
    });
    
    const submittedCount = {};
    logs.forEach(log => {
       submittedCount[log.leader_id] = (submittedCount[log.leader_id] || 0) + 1;
    });

    let submittedLeadersSet = new Set(logs.map(l => l.leader_id));
    stats.total_submitted_leaders = submittedLeadersSet.size;

    const subleaderReport = allLeaders.map(l => {
      const leaderAttendance = attendance.filter(a => a.leader_id === l.id);
      const lStats = { present: 0, absent: 0, excused: 0 };
      leaderAttendance.forEach(a => {
        if (a.status === 'present') { lStats.present++; stats.present++; }
        if (a.status === 'absent') { lStats.absent++; stats.absent++; }
        if (a.status === 'excused') { lStats.excused++; stats.excused++; }
      });

      return {
        leader_id: l.id,
        leader_name: l.full_name,
        section_name: l.section_name,
        phone: l.phone,
        submissions_count: submittedCount[l.id] || 0,
        stats: lStats
      };
    });

    res.json({ filterType, filterValue, stats, subleaders: subleaderReport });
  } catch (error) {
    res.status(500).json({ error: 'Failed to aggregate overview' });
  }
});

// GET comprehensive details for a specific leader dashboard (Admin Drill-Down)
router.get('/leader-dashboard/:id', async (req, res) => {
  try {
    const leaderId = req.params.id;
    
    // Fetch leader base info
    const leader = await new Promise((resolve, reject) => {
      db.get(`
        SELECT l.*, u.full_name, u.username, s.name as section_name 
        FROM leaders l 
        JOIN users u ON l.user_id = u.id 
        JOIN sections s ON l.section_id = s.id 
        WHERE l.id = ?
      `, [leaderId], (err, row) => err ? reject(err) : resolve(row));
    });

    if (!leader) return res.status(404).json({ error: 'Leader not found' });

    // Roster
    const members = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM members WHERE leader_id = ? ORDER BY full_name', [leaderId], (err, rows) => err ? reject(err) : resolve(rows));
    });

    // History log
    const history = await new Promise((resolve, reject) => {
      db.all(`
        SELECT sl.date, sl.submitted_at, COUNT(a.id) as records_count
        FROM submission_log sl
        LEFT JOIN attendance a ON sl.date = a.date AND sl.leader_id = (SELECT m.leader_id FROM members m WHERE m.id = a.member_id LIMIT 1)
        WHERE sl.leader_id = ?
        GROUP BY sl.id
        ORDER BY sl.date DESC
        LIMIT 20
      `, [leaderId], (err, rows) => err ? reject(err) : resolve(rows));
    });

    // Trends calculation (last 90 days)
    const trends = await new Promise((resolve, reject) => {
      db.all(`
        SELECT date, 
               SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
               SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count,
               SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) as excused_count
        FROM attendance
        WHERE member_id IN (SELECT id FROM members WHERE leader_id = ?)
          AND date >= date('now', '-90 days')
        GROUP BY date
        ORDER BY date ASC
      `, [leaderId], (err, rows) => err ? reject(err) : resolve(rows));
    });

    res.json({
      leader,
      roster: members,
      history,
      trends
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch leader drill-down dashboard' });
  }
});

// POST bulk attendance (Admin bulk substitute)
router.post('/attendance', async (req, res) => {
  try {
    const { date, attendance, leader_id, section_id } = req.body;

    if (!date || !Array.isArray(attendance) || attendance.length === 0 || !leader_id || !section_id) {
      return res.status(400).json({ error: 'Date, leader_id, section_id, and attendance array required' });
    }

    const existingSubmission = await queries.checkSubmissionExists(leader_id, date);
    if (existingSubmission) {
      return res.status(400).json({ error: 'Attendance already submitted for this leader on this date' });
    }

    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) return reject(err);

          try {
            attendance.forEach(record => {
              if (!['present', 'absent', 'excused'].includes(record.status)) {
                throw new Error(`Invalid status for member ${record.member_id}`);
              }
              db.run(
                'INSERT OR REPLACE INTO attendance (member_id, date, status, submitted_by, submitted_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
                [record.member_id, date, record.status, req.session.userId]
              );
            });

            db.run(
              'INSERT INTO submission_log (leader_id, section_id, date) VALUES (?, ?, ?)',
              [leader_id, section_id, date],
              (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return reject(err);
                }
                db.run('COMMIT', (commitErr) => {
                  if (commitErr) {
                    db.run('ROLLBACK');
                    return reject(commitErr);
                  }
                  resolve();
                });
              }
            );
          } catch (err) {
            db.run('ROLLBACK');
            reject(err);
          }
        });
      });
    });

    res.json({ message: 'Attendance submitted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit attendance', details: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// REWARDS & RECOGNITION PROGRAM
// ─────────────────────────────────────────────────────────────

// Helper: build date condition from query params (year + optional week)
function buildRewardDateCondition(query, tableAlias = 'sl') {
  const year = query.year || new Date().getFullYear().toString();
  const week = query.week; // format: "YYYY-Www" or just "Www" if year is separate

  if (week) {
    // Expect week param as "YYYY-Www" e.g. "2026-W13"
    const parts = week.split('-W');
    if (parts.length === 2) {
      const w = parts[1].padStart(2, '0');
      const y = parts[0] || year;
      return {
        condition: `strftime('%Y-%W', ${tableAlias}.date) = ?`,
        params: [`${y}-${w}`]
      };
    }
  }

  // Default: full year
  return {
    condition: `strftime('%Y', ${tableAlias}.date) = ?`,
    params: [year]
  };
}

// GET /admin/rewards/top-members
// Rankings: members by attendance rate on actual service days
router.get('/rewards/top-members', async (req, res) => {
  try {
    const { condition, params } = buildRewardDateCondition(req.query);

    const rows = await new Promise((resolve, reject) => {
      const query = `
        WITH service_days AS (
          SELECT DISTINCT date
          FROM submission_log sl
          WHERE ${condition}
        ),
        member_stats AS (
          SELECT
            m.id,
            m.membership_id,
            m.full_name,
            s.name            AS section_name,
            u.full_name       AS leader_name,
            (SELECT COUNT(*) FROM service_days) AS total_services,
            COUNT(CASE WHEN a.status = 'present' THEN 1 END) AS times_present
          FROM members m
          JOIN sections  s ON m.section_id = s.id
          JOIN leaders   l ON m.leader_id  = l.id
          JOIN users     u ON l.user_id    = u.id
          LEFT JOIN attendance a
            ON a.member_id = m.id
            AND a.date IN (SELECT date FROM service_days)
          GROUP BY m.id
        )
        SELECT
          id, membership_id, full_name, section_name, leader_name,
          total_services, times_present,
          CASE
            WHEN total_services > 0
            THEN ROUND((times_present * 100.0 / total_services), 1)
            ELSE 0
          END AS attendance_rate
        FROM member_stats
        ORDER BY attendance_rate DESC, times_present DESC
      `;
      db.all(query, params, (err, r) => err ? reject(err) : resolve(r || []));
    });

    // Assign shared ranks (dense ranking — ties share the same rank)
    let rank = 1;
    const ranked = rows.map((row, idx) => {
      if (idx > 0 && row.attendance_rate < rows[idx - 1].attendance_rate) {
        rank = idx + 1;
      }
      return { ...row, rank };
    });

    res.json({ members: ranked, total_service_days: ranked[0]?.total_services || 0 });
  } catch (error) {
    console.error('Rewards top-members error:', error);
    res.status(500).json({ error: 'Failed to fetch member leaderboard' });
  }
});

// GET /admin/rewards/top-leaders
// Rankings: leaders by submission consistency on actual service days
router.get('/rewards/top-leaders', async (req, res) => {
  try {
    const { condition, params } = buildRewardDateCondition(req.query);

    const rows = await new Promise((resolve, reject) => {
      const query = `
        WITH service_days AS (
          SELECT DISTINCT date
          FROM submission_log sl
          WHERE ${condition}
        ),
        leader_stats AS (
          SELECT
            l.id,
            u.full_name  AS leader_name,
            s.name       AS section_name,
            (SELECT COUNT(*) FROM service_days) AS total_service_days,
            COUNT(DISTINCT CASE
              WHEN sl.date IN (SELECT date FROM service_days)
              THEN sl.date
            END) AS submitted_count
          FROM leaders  l
          JOIN users    u ON l.user_id    = u.id
          JOIN sections s ON l.section_id = s.id
          LEFT JOIN submission_log sl ON sl.leader_id = l.id
          GROUP BY l.id
        )
        SELECT
          id, leader_name, section_name,
          total_service_days, submitted_count,
          CASE
            WHEN total_service_days > 0
            THEN ROUND((submitted_count * 100.0 / total_service_days), 1)
            ELSE 0
          END AS submission_rate
        FROM leader_stats
        ORDER BY submission_rate DESC, submitted_count DESC
      `;
      db.all(query, params, (err, r) => err ? reject(err) : resolve(r || []));
    });

    // Dense ranking — ties share the same rank
    let rank = 1;
    const ranked = rows.map((row, idx) => {
      if (idx > 0 && row.submission_rate < rows[idx - 1].submission_rate) {
        rank = idx + 1;
      }
      return { ...row, rank };
    });

    res.json({ leaders: ranked, total_service_days: ranked[0]?.total_service_days || 0 });
  } catch (error) {
    console.error('Rewards top-leaders error:', error);
    res.status(500).json({ error: 'Failed to fetch leader leaderboard' });
  }
});

module.exports = router;


