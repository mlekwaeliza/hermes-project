const { db, queries, run } = require('./server/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

async function resetAllLeaderPasswords() {
  console.log('Fetching all leaders...');
  try {
    const leadersQuery = `
      SELECT u.id as user_id, u.username, u.full_name, s.name as section_name
      FROM users u
      JOIN leaders l ON u.id = l.user_id
      JOIN sections s ON l.section_id = s.id
      WHERE u.role = 'leader'
      ORDER BY s.name, u.full_name
    `;
    
    db.all(leadersQuery, [], async (err, leaders) => {
      if (err) {
        console.error('Error fetching leaders:', err);
        return;
      }
      
      console.log(`Found ${leaders.length} leaders. Resetting passwords...`);
      let markdownOutput = `# Leader Credentials Report\n\n`;
      markdownOutput += `*These passwords have been securely generated and applied to all leader accounts in the system.*\n\n`;
      markdownOutput += `| Section | Leader Name | Username | New Password |\n`;
      markdownOutput += `|---------|-------------|----------|--------------|\n`;

      for (const leader of leaders) {
        const tempPassword = `temp_${uuidv4().substring(0, 6)}`;
        const hash = bcrypt.hashSync(tempPassword, 10);
        
        await run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, leader.user_id]);
        
        markdownOutput += `| ${leader.section_name} | ${leader.full_name} | \`${leader.username}\` | \`${tempPassword}\` |\n`;
        console.log(`Reset password for ${leader.username}`);
      }
      
      fs.writeFileSync('leader_credentials.md', markdownOutput);
      console.log('✅ Successfully reset all leader passwords.');
      console.log('✅ Saved credentials list to leader_credentials.md in your project folder.');
    });
  } catch (error) {
    console.error(error);
  }
}

resetAllLeaderPasswords();
