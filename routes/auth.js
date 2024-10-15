// routes/auth.js

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { User, InviteCode } = require('../models/User');

router.post('/register', async (req, res) => {
    const { username, password, inviteCode } = req.body;

    try {
        // 验证邀请码
        const validInviteCode = await InviteCode.findOne({ where: { code: inviteCode, isUsed: false } });
        if (!validInviteCode) {
            return res.status(400).json({ msg: '无效的邀请码' });
        }

        // 检查用户是否已存在
        let user = await User.findOne({ where: { username } });
        if (user) {
            return res.status(400).json({ msg: '用户已存在' });
        }

        // 创建新用户
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = await User.create({
            username,
            password: hashedPassword
        });

        // 标记邀请码为已使用
        await validInviteCode.update({ isUsed: true });

        res.redirect('/login'); // 注册成功后重定向到登录页面
    } catch (err) {
        console.error(err.message);
        res.status(500).send('服务器错误');
    }
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // 查找用户
        const user = await User.findOne({ where: { username } });
        if (!user) {
            return res.status(400).json({ msg: '用户不存在' });
        }

        // 验证密码
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: '密码不正确' });
        }

        // 创建 JWT
        const payload = {
            user: {
                id: user.id,
                isAdmin: user.isAdmin
            }
        };

        jwt.sign(
            payload,
            'your_jwt_secret', // 请使用环境变量存储这个密钥
            { expiresIn: '1h' },
            (err, token) => {
                if (err) throw err;
                res.json({ token });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('服务器错误');
    }
});

module.exports = router;