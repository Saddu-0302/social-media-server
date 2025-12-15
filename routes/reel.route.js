const express = require('express');
const router = express.Router();
const upload = require('../middleware/multerConfig');
const protect = require('../middleware/authMiddleware');
const reelController = require('../controllers/reels.controller');
const asyncHandler = require('express-async-handler');

// middleware to accept two files: media and song
const cpUpload = upload.fields([
  { name: 'media', maxCount: 1 },
  { name: 'song', maxCount: 1 }
]);

// Add your auth middleware that sets req.user
router
.get('/',reelController.getAllReels)
.post('/create', protect,cpUpload, asyncHandler(reelController.createReel));

module.exports = router;
