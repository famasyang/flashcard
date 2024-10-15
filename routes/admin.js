// routes/admin.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { User, InviteCode } = require('../models/User');

let setupToken = null;

function generateSetupToken() {
    setupToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    console.log('\x1b[33m%s\x1b[0m', '警告: 这是一次性的管理员设置令牌。请妥善保管并在使用后立即禁用相关路由。');
    console.log('\x1b[36m%s\x1b[0m', `设置令牌: ${setupToken}`);
    return setupToken;
}

// 初始生成令牌
generateSetupToken();

// 显示当前的设置令牌
router.get('/show-token', (req, res) => {
    const token = generateSetupToken();
    res.json({ message: '新的设置令牌已生成。请查看控制台以获取令牌。' });
});

router.post('/setup-admin/:token', async (req, res) => {
    const { token } = req.params;
    const { username, password } = req.body;

    if (!setupToken || token !== setupToken) {
        return res.status(401).json({ msg: '无效的设置令牌' });
    }

    try {
        // 检查是否已存在管理员
        const adminExists = await User.findOne({ where: { isAdmin: true } });
        if (adminExists) {
            return res.status(400).json({ msg: '管理员已存在' });
        }

        // 创建管理员账户
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const admin = await User.create({
            username,
            password: hashedPassword,
            isAdmin: true
        });

        // 创建一个初始邀请码
        const inviteCode = await InviteCode.create({
            code: Math.random().toString(36).substring(2, 10),
            createdBy: admin.id
        });

        // 使用令牌后立即清除它
        setupToken = null;

        res.json({ 
            msg: '管理员账户创建成功',
            inviteCode: inviteCode.code
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('服务器错误');
    }
});

// 生成新的邀请码的路由
router.post('/generate-invite', async (req, res) => {
    // 这里应该添加身份验证中间件，确保只有管理员可以访问
    try {
        const newCode = Math.random().toString(36).substring(2, 10);
        const inviteCode = await InviteCode.create({
            code: newCode,
            createdBy: req.user.id // 假设req.user包含当前登录用户的信息
        });
        res.json({ inviteCode: inviteCode.code });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('服务器错误');
    }
});

module.exports = {
    router,
    getCurrentToken: () => setupToken
};