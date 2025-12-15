const multer = require("multer");
const path = require("node:path");
const fs = require("node:fs");

const tempDir = path.join(__dirname,"..",'middleware','temp')
fs.mkdirSync(tempDir,{recursive:true})

const storage = multer.diskStorage({
    destination: function (req,file,cb){
        cb(null,tempDir)
    },
    filename: function (req,file,cb){
        const ext = path.extname(file.originalname)
        const name = `${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
        cb(null,name)
    }
})
const fileFilter = (req, file, cb) => {
  const { fieldname, mimetype } = file;
  if (fieldname === 'media') {
    // accept video/mp4, webm; images jpeg/png
    if (mimetype.startsWith('image/') || mimetype.startsWith('video/')) return cb(null, true);
    return cb(new Error('Media must be an image or video.'));
  }
  if (fieldname === 'song') {
    if (mimetype.startsWith('audio/')) return cb(null, true);
    return cb(new Error('Song must be an audio file.'));
  }
  cb(null, false);
};

const limits = {
  fileSize: 50 * 1024 * 1024 // 50 MB limit for each file (adjust)
};

const upload = multer({ storage, fileFilter, limits });

module.exports = upload;