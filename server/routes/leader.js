const express = require('express');
const { db, queries } = require('../database');
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();
router.use(isAuthenticated);

// GET members assigned to this leader
router.get('/members', async (req, res) => {
  try {
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) {
      return res.status(404).json({ error: 'Leader record not found' });
    }

    const members = await queries.getMembersByLeader(leaderRecord.id);
    res.json({
      section_name: leaderRecord.section_name,
      leader_name: req.session.user.full_name,
      is_head: Boolean(leaderRecord.is_head),
      members
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Create a new member for this leader
router.post('/members', async (req, res) => {
  try {
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) return res.status(404).json({ error: 'Leader not found' });

    const { membership_id, full_name, phone, email, gender, age_group } = req.body;
    if (!membership_id || !full_name) {
      return res.status(400).json({ error: 'Membership ID and Full Name are required' });
    }

    const existingMember = await queries.getMemberByMembershipId(membership_id);
    if (existingMember) {
      return res.status(400).json({ error: 'Membership ID already exists' });
    }

    await queries.createMember(
      membership_id, full_name, leaderRecord.section_id, leaderRecord.id,
      phone || null, email || null, gender || null, age_group || null
    );

    res.json({ message: 'Member created successfully' });
  } catch (error) {
    console.error('Create member error:', error);
    res.status(500).json({ error: 'Failed to create member' });
  }
});

// Update a member
router.put('/members/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, phone, email, gender, age_group } = req.body;

    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) return res.status(404).json({ error: 'Leader not found' });

    const member = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM members WHERE id = ?', [id], (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    });

    if (!member) return res.status(404).json({ error: 'Member not found' });
    if (member.leader_id !== leaderRecord.id) {
      return res.status(403).json({ error: 'Access denied: Member belongs to another leader' });
    }

    await queries.updateMember(full_name, phone, email, gender, age_group, id);
    res.json({ message: 'Member updated successfully' });
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// Delete a member
router.delete('/members/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) return res.status(404).json({ error: 'Leader not found' });

    const member = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM members WHERE id = ?', [id], (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    });

    if (!member) return res.status(404).json({ error: 'Member not found' });
    if (member.leader_id !== leaderRecord.id) {
      return res.status(403).json({ error: 'Access denied: Member belongs to another leader' });
    }

    await queries.deleteMember(id);
    res.json({ message: 'Member deleted successfully' });
  } catch (error) {
    console.error('Delete member error:', error);
    res.status(500).json({ error: 'Failed to delete member' });
  }
});

// Check submission status for a specific date
router.get('/attendance/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);

    if (!leaderRecord) {
      return res.status(404).json({ error: 'Leader record not found' });
    }

    // Check if submission exists
    const existing = await queries.checkSubmissionExists(leaderRecord.id, date);
    if (existing) {
      return res.json({ submitted: true, submitted_at: existing.submitted_at });
    }

    // Get existing attendance for this date if any
    const attendance = await queries.getAttendanceByLeaderAndDate(leaderRecord.id, date);
    res.json({ submitted: false, attendance });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check attendance status' });
  }
});

// Get section overview for head leaders
router.get('/section-overview/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    
    if (!leaderRecord || !leaderRecord.is_head) {
      return res.status(403).json({ error: 'Access denied. Not a head leader.' });
    }

    const allLeaders = await queries.getLeadersBySection(leaderRecord.section_id);
    const attendance = await queries.getAttendanceByDateAndSection(date, leaderRecord.section_id);

    const logs = await new Promise((resolve, reject) => {
      db.all('SELECT leader_id FROM submission_log WHERE section_id = ? AND date = ?', [leaderRecord.section_id, date], (err, rows) => {
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
        phone: l.phone,
        submitted: submittedLeaderIds.has(l.id),
        stats: lStats
      };
    });

    res.json({
      section_name: leaderRecord.section_name,
      date,
      stats,
      subleaders: subleaderReport
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch section overview' });
  }
});

// Submit attendance for a Sunday
router.post('/attendance', async (req, res) => {
  try {
    const { date, attendance } = req.body;

    if (!date || !Array.isArray(attendance) || attendance.length === 0) {
      return res.status(400).json({ error: 'Date and attendance array required' });
    }

    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) {
      return res.status(404).json({ error: 'Leader record not found' });
    }

    // Check if already submitted for this date
    const existingSubmission = await queries.checkSubmissionExists(leaderRecord.id, date);
    if (existingSubmission) {
      return res.status(400).json({ error: 'Attendance already submitted for this date' });
    }

    // Begin transaction
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) return reject(err);

          try {
            // Insert/replace attendance records
            attendance.forEach(record => {
              if (!['present', 'absent', 'excused'].includes(record.status)) {
                throw new Error(`Invalid status for member ${record.member_id}`);
              }
              // Use run directly since we're in a transaction
              db.run(
                'INSERT OR REPLACE INTO attendance (member_id, date, status, submitted_by, submitted_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
                [record.member_id, date, record.status, req.session.userId]
              );
            });

            // Log the submission
            db.run(
              'INSERT INTO submission_log (leader_id, section_id, date) VALUES (?, ?, ?)',
              [leaderRecord.id, leaderRecord.section_id, date],
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

// Get leader's submission history
router.get('/history', async (req, res) => {
  try {
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) {
      return res.status(404).json({ error: 'Leader record not found' });
    }

    const history = await new Promise((resolve, reject) => {
      const isHead = Boolean(leaderRecord.is_head);
      const whereClause = isHead ? 'sl.section_id = ?' : 'sl.leader_id = ?';
      const filterParam = isHead ? leaderRecord.section_id : leaderRecord.id;
      const limit = isHead ? 100 : 20;

      db.all(`
        SELECT sl.date, sl.submitted_at, u.full_name as leader_name, COUNT(a.id) as records_count
        FROM submission_log sl
        JOIN leaders l ON sl.leader_id = l.id
        JOIN users u ON l.user_id = u.id
        LEFT JOIN attendance a ON sl.date = a.date AND a.submitted_by = u.id
        WHERE ${whereClause}
        GROUP BY sl.date, sl.leader_id
        ORDER BY sl.date DESC, sl.submitted_at DESC
        LIMIT ${limit}
      `, [filterParam], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Get attendance trends data for charts
router.get('/attendance-trends', async (req, res) => {
  try {
    const leaderRecord = await queries.getLeaderByUserId(req.session.userId);
    if (!leaderRecord) {
      return res.status(404).json({ error: 'Leader record not found' });
    }

    const { days = 90 } = req.query; // Default to last 90 days (approx 12 Sundays)
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    const startDateStr = startDate.toISOString().split('T')[0];

    const trends = await queries.getLeaderSectionAttendanceStats(leaderRecord.id, startDateStr, endDate);
    res.json({ trends, date_range: { start: startDateStr, end: endDate } });
  } catch (error) {
    console.error('Trends error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance trends' });
  }
});

module.exports = router;
