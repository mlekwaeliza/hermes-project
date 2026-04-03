const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const { queries, get } = require('../database');

const router = express.Router();

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/profiles/'))
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, req.session.userId + '-' + uniqueSuffix + path.extname(file.originalname))
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await queries.findUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Store user info in session (exclude password)
    req.session.userId = user.id;
    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      full_name: user.full_name,
      profile_picture: user.profile_picture
    };

    res.json({
      message: 'Login successful',
      user: req.session.user
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

// Check session
router.get('/me', async (req, res) => {
  if (req.session.user) {
    // Refresh user data to get latest profile picture and name if changed elsewhere
    try {
      const user = await queries.findUserByUsername(req.session.user.username);
      if (user) {
        req.session.user.profile_picture = user.profile_picture;
        req.session.user.full_name = user.full_name;
      }
      res.json({ user: req.session.user });
    } catch (e) {
      res.json({ user: req.session.user });
    }
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// Change password
router.post('/change-password', async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current password and new password required' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Get user from session
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Use session user ID to get user directly
    const user = await get('SELECT * FROM users WHERE id = ?', [req.session.userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const validPassword = bcrypt.compareSync(current_password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash and save new password
    const newPasswordHash = bcrypt.hashSync(new_password, 10);
    await queries.updateUserPassword(newPasswordHash, user.id);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Update profile details
router.put('/profile', async (req, res) => {
  try {
    const { full_name } = req.body;
    if (!full_name || full_name.trim().length === 0) {
      return res.status(400).json({ error: 'Name cannot be empty' });
    }
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    await queries.updateUserFullName(full_name.trim(), req.session.userId);
    req.session.user.full_name = full_name.trim();
    res.json({ message: 'Profile updated', full_name: full_name.trim() });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Upload profile picture
router.post('/profile-picture', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  upload.single('image')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    try {
      // Create the URL path to save in DB
      const pictureUrl = `/uploads/profiles/${req.file.filename}`;
      
      // Update database
      await queries.updateUserProfilePicture(pictureUrl, req.session.userId);
      
      // Update session
      req.session.user.profile_picture = pictureUrl;
      
      res.json({ 
        message: 'Profile picture updated successfully',
        profile_picture: pictureUrl
      });
    } catch (error) {
      console.error('Profile picture update error:', error);
      res.status(500).json({ error: 'Failed to update profile picture' });
    }
  });
});

module.exports = router;
