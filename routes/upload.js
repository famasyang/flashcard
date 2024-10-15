// 在 routes 文件夹中添加 upload.js 文件
// routes/upload.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// 设置存储引擎
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function(req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

// 文件上传限制
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 1000000 }, // 1MB 限制
  fileFilter: function(req, file, cb) {
    checkFileType(file, cb);
  }
}).single('wordcard');

// 检查文件类型
function checkFileType(file, cb) {
  const filetypes = /txt/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb('错误: 只允许上传 .txt 文件!');
  }
}

// 上传路由
router.post('/', (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      res.status(400).json({ msg: err });
    } else {
      if (req.file == undefined) {
        res.status(400).json({ msg: '没有选择文件' });
      } else {
        res.json({ msg: '文件上传成功', file: `uploads/${req.file.filename}` });
      }
    }
  });
});

module.exports = router;
