const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
const Reel = require('../models/Reel');
const asyncHandler = require('express-async-handler');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);


const TEMP_DIR = path.join(__dirname, '..', 'uploads', 'temp');
const OUT_DIR = path.join(__dirname, '..', 'uploads', 'final');
if (!fsSync.existsSync(TEMP_DIR)) {
  fsSync.mkdirSync(TEMP_DIR, { recursive: true });
}
if (!fsSync.existsSync(OUT_DIR)) {
  fsSync.mkdirSync(OUT_DIR, { recursive: true });
}

async function getMediaDuration(filePath) {
  return new Promise((res, rej) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return rej(err);
      const s = metadata.format.duration;
      res(s);
    });
  });
}

async function createVideoFromImage(imagePath, outVideoPath, duration = 15) {
  return new Promise((res, rej) => {
    // create a simple static video from image
    ffmpeg()
      .input(imagePath)
      .loop(duration)
      .outputOptions([
        '-c:v libx264',
        '-t ' + duration,
        '-pix_fmt yuv420p',
        '-vf scale=720:-2' // scale width to 720px keeping aspect
      ])
      .save(outVideoPath)
      .on('end', () => res(outVideoPath))
      .on('error', (err) => rej(err));
  });
}

async function trimVideo(inputPath, outPath, duration = 15) {
  return new Promise((res, rej) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-c:v libx264',
        '-preset veryfast',
        '-t ' + duration,
        '-vf scale=720:-2',
        '-pix_fmt yuv420p',
      ])
      .noAudio() // remove old audio; we'll add the song later
      .save(outPath)
      .on('end', () => res(outPath))
      .on('error', (err) => rej(err));
  });
}

async function trimAudio(inputPath, outPath, duration = 15) {
  return new Promise((res, rej) => {
    ffmpeg(inputPath)
      .outputOptions(['-t ' + duration])
      .audioCodec('aac')
      .save(outPath)
      .on('end', () => res(outPath))
      .on('error', (err) => rej(err));
  });
}

async function muxAudioVideo(videoPath, audioPath, outPath) {
  return new Promise((res, rej) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions([
        '-map 0:v:0',
        '-map 1:a:0',
        '-c:v copy',
        '-c:a aac',
        '-shortest'
      ])
      .save(outPath)
      .on('end', () => res(outPath))
      .on('error', (err) => rej(err));
  });
}

// cleanup helper
async function safeUnlink(filePath) {
  try { await fs.unlink(filePath); } catch (e) { 
    console.log(`Exception while doing something: ${e}`)
  }
}

exports.createReel = asyncHandler(async (req, res) => {
  // expected fields: media (file), song (file), caption (optional)
  if (!req.files?.media) {
    return res.status(400).json({ message: 'media is required.' });
  }
  const songFile = req.files.song ? req.files.song[0] : null;
  const mediaFile = req.files.media[0];
  const caption = req.body.caption || '';
  const userId = req.user?._id ? req.user._id : null; // adapt to your auth

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const mediaPath = mediaFile.path;
  const songPath = songFile.path;

  const id = uuidv4();
  const tmpVideo = path.join(TEMP_DIR, `${id}-video.mp4`);
  const tmpAudio = path.join(TEMP_DIR, `${id}-audio.m4a`);
  const finalFile = path.join(OUT_DIR, `${id}-reel.mp4`);

  try {
    // 1) determine if media is image or video
    const isImage = mediaFile.mimetype.startsWith('image/');
    let finalDuration = 15;

    if (isImage) {
      // make 15s video from image
      await createVideoFromImage(mediaPath, tmpVideo, finalDuration);
    } else {
      // media is a video: check duration and trim if necessary
      const duration = await getMediaDuration(mediaPath);
      // use min(duration, 15)
      finalDuration = Math.min(Math.floor(duration || 0), finalDuration) || 1; // fallback 1s
      // trim video to finalDuration and remove audio
      await trimVideo(mediaPath, tmpVideo, finalDuration);
    }
    // 2) trim audio to finalDuration
    await trimAudio(songPath, tmpAudio, finalDuration);

    // 3) mux audio and video
    await muxAudioVideo(tmpVideo, tmpAudio, finalFile);

    // optional: produce thumbnail (first frame)
    const thumbPath = path.join(OUT_DIR, `${id}-thumb.jpg`);
    await new Promise((resolve, reject) => {
      ffmpeg(finalFile)
        .screenshots({
          timestamps: ['0.5'],
          filename: path.basename(thumbPath),
          folder: path.dirname(thumbPath),
          size: '480x?'
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // 4) save DB record (adjust mediaUrl to real public URL as needed)
    const reel = await Reel.create({
      user: userId,
      caption,
      mediaUrl: `/uploads/final/${path.basename(finalFile)}`,
      thumbnailUrl: `/uploads/final/${path.basename(thumbPath)}`,
      duration: finalDuration
    });

    // 5) cleanup temp files
    await Promise.all([
      safeUnlink(mediaPath),
      safeUnlink(songPath),
      safeUnlink(tmpVideo),
      safeUnlink(tmpAudio)
    ]);

    return res.status(201).json({ message: 'Reel created', reel });
  } catch (err) {
    // attempt cleanup
    await safeUnlink(tmpVideo);
    await safeUnlink(tmpAudio);
    await safeUnlink(finalFile);
    console.error('createReel error', err);
    return res.status(500).json({ message: 'Failed to create reel', error: err.message });
  }
});


exports.getAllReels = asyncHandler(async(req,res)=>{

    let page = Number.parseInt(req.query.page) || 1;
    const limit = 5; // number of reels per page
    const skip = (page - 1) * limit;

    const totalReels = await Reel.countDocuments();
    const allReels = await Reel.find()
        .sort({ createdAt: -1 }) // latest first
        .skip(skip)
        .limit(limit)
        .lean();

    res.status(200).json({
        message: "Reels fetch successful",
        allReels,
        totalPages: Math.ceil(totalReels / limit),
        currentPage: page
  });
})