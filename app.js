// 重构后的代码：引入必要模块
const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const app = express();
const port = 3123;

// 引入 CORS 模块，用于前后端分离后处理跨域问题
const cors = require('cors');

// 定义文件路径
const usersFilePath = path.join(__dirname, 'user', 'users.txt');
const cardsDirectory = path.join(__dirname, 'cards');
const learningRecordsPath = path.join(__dirname, 'learningRecords.json');

// 设置中间件
app.use(cors()); // 重构：增加 CORS 中间件
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'yourSecretKey',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

const iconv = require('iconv-lite');

// 配置文件上传存储
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'cards/');
    },
    filename: function (req, file, cb) {
        // 使用 iconv-lite 解码文件名
        const originalName = iconv.decode(Buffer.from(file.originalname, 'binary'), 'gbk');
        const sanitizedFileName = originalName.replace(/[^a-zA-Z0-9_.-]/g, '_'); // 过滤非法字符
        cb(null, sanitizedFileName);
    }
});

// 设置 multer 上传配置
const upload = multer({ storage: storage });

// 加载用户数据
function loadUsers() {
    if (!fs.existsSync(usersFilePath)) return [];
    const data = fs.readFileSync(usersFilePath, 'utf-8').trim();
    return data.split('\n').map(line => {
        const parts = line.split(',');
        if (parts.length >= 5) {
            return {
                username: parts[0].trim(),
                password: parts[1].trim(),
                role: parts[2].trim(),
                inviteCode: parts[3].trim(),
                isUsed: parts[2].trim() === 'admin' ? false : parts[4].trim() === 'true'
            };
        }
        return null;
    }).filter(user => user !== null);
}

// 生成唯一的邀请码
function generateUniqueInviteCode(users) {
    let inviteCode;
    do {
        inviteCode = uuidv4();
    } while (users.some(user => user.inviteCode === inviteCode));
    return inviteCode;
}

// 获取学习卡列表
function getCardsList(username) {
    const publicCards = [];
    const userCards = [];

    // 获取公共卡片
    if (fs.existsSync(cardsDirectory)) {
        const files = fs.readdirSync(cardsDirectory);
        files.forEach(file => {
            const filePath = path.join(cardsDirectory, file);
            const stats = fs.statSync(filePath);
            if (stats.isFile() && file.endsWith('.txt')) {
                const wordCount = fs.readFileSync(filePath, 'utf-8').split('\n').filter(line => line.trim() !== '').length;
                publicCards.push({ name: file.replace('.txt', ''), wordCount });
            }
        });
    }

    // 获取用户私有卡片
    const userDirectory = path.join(cardsDirectory, username);
    if (fs.existsSync(userDirectory)) {
        const userFiles = fs.readdirSync(userDirectory);
        userFiles.forEach(file => {
            const filePath = path.join(userDirectory, file);
            const stats = fs.statSync(filePath);
            if (stats.isFile() && file.endsWith('.txt')) {
                const wordCount = fs.readFileSync(filePath, 'utf-8').split('\n').filter(line => line.trim() !== '').length;
                userCards.push({ name: file.replace('.txt', ''), wordCount });
            }
        });
    }

    return { publicCards, userCards };
}

// 获取学习卡内容
function getCardContent(cardName, username) {
    if (!cardName || !username) {
        console.error('Invalid arguments: cardName or username is undefined');
        return null;
    }

    // 首先尝试从用户私有目录获取卡片内容
    let filePath = path.join(cardsDirectory, username, `${cardName}.txt`);
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        return parseCardContent(fileContent);
    }

    // 如果不存在，再尝试从公共目录获取
    filePath = path.join(cardsDirectory, `${cardName}.txt`);
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        return parseCardContent(fileContent);
    }

    return null;
}

// 解析学习卡内容
function parseCardContent(fileContent) {
    return fileContent.split('\n').map(line => {
        const parts = line.split(',');
        if (parts.length === 2) {
            return { word: parts[0].trim(), definition: parts[1].trim() };
        }
    }).filter(item => item !== undefined);
}

// 洗牌函数，用于随机排列数组元素
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// 获取随机选项，用于生成选择题
function getRandomOptions(correctAnswer, allAnswers, optionType = 'definition') {
    const shuffled = allAnswers.filter(a => a[optionType] !== correctAnswer[optionType])
                               .sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3).map(item => item[optionType]);
}

// 检查用户是否已登录
function checkAuthentication(req, res, next) {
    if (req.session.loggedIn && req.session.username) {
        next();
    } else {
        res.status(401).json({ message: '用户未登录' }); // 重构：将重定向改为返回 JSON 响应
    }
}

// 检查管理员权限
function checkAdmin(req, res, next) {
    if (req.session.loggedIn && req.session.username === 'admin') {
        next();
    } else {
        res.status(403).json({ message: '没有权限访问此页面' }); // 重构：将错误返回改为 JSON 响应
    }
}

// 加载学习记录
function loadLearningRecords() {
    if (!fs.existsSync(learningRecordsPath)) {
        fs.writeFileSync(learningRecordsPath, '[]');
        return [];
    }
    const data = fs.readFileSync(learningRecordsPath, 'utf-8').trim();
    return JSON.parse(data);
}

// 保存学习记录
function saveLearningRecords(records) {
    fs.writeFileSync(learningRecordsPath, JSON.stringify(records, null, 2));
}

// 更新学习记录
function updateLearningRecords(username, wordsLearned) {
    let learningRecords = loadLearningRecords();
    const userRecord = learningRecords.find(record => record.username === username);
    if (userRecord) {
        userRecord.totalWords += wordsLearned;
    } else {
        learningRecords.push({ username, totalWords: wordsLearned });
    }
    saveLearningRecords(learningRecords);
}

// 注册接口
app.post('/api/register', (req, res) => {
    const { username, password, inviteCode } = req.body;
    const users = loadUsers();

    if (users.find(user => user.username === username)) {
        return res.status(400).json({ message: '用户名已存在！' });
    }

    const invitingUser = users.find(u => u.inviteCode === inviteCode);

    if (!invitingUser) {
        return res.status(400).json({ message: '邀请码无效！' });
    }

    if (invitingUser.role !== 'admin' && invitingUser.isUsed) {
        return res.status(400).json({ message: '邀请码已被使用！' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const newUserInviteCode = generateUniqueInviteCode(users);
    const newUser = `${username},${hashedPassword},user,${newUserInviteCode},false`;

    if (invitingUser.role !== 'admin') {
        const updatedUsers = users.map(user => {
            if (user.inviteCode === inviteCode) {
                return `${user.username},${user.password},${user.role},${user.inviteCode},true`;
            }
            return `${user.username},${user.password},${user.role},${user.inviteCode},${user.isUsed}`;
        }).join('\n');
        fs.writeFileSync(usersFilePath, updatedUsers + '\n' + newUser + '\n');
    } else {
        fs.appendFileSync(usersFilePath, newUser + '\n');
    }

    const userDirectory = path.join(cardsDirectory, username);
    if (!fs.existsSync(userDirectory)) {
        fs.mkdirSync(userDirectory);
    }

    res.json({ message: '注册成功！' });
});

// 登录接口
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = loadUsers();
    const user = users.find(u => u.username === username);
    if (user && bcrypt.compareSync(password, user.password)) {
        req.session.loggedIn = true;
        req.session.username = username;
        return res.json({ message: '登录成功！' });
    } else {
        return res.status(401).json({ message: '用户名或密码错误！' });
    }
});

// 文件上传接口
app.post('/upload', checkAuthentication, upload.single('file'), (req, res) => { // 重构：增加 checkAuthentication 中间件
    console.log('Received upload request:', req.file, req.body);

    let fileName;
    let fileContent;

    if (req.file) {
        fileName = req.file.originalname;
        fileContent = fs.readFileSync(req.file.path, 'utf-8');
    } else if (req.body.customFileName && req.body.word && req.body.definition) {
        fileName = req.body.customFileName + '.txt';
        fileContent = req.body.word.map((word, index) => `${word},${req.body.definition[index]}`).join('\n');
    } else {
        return res.status(400).json({ success: false, message: '无效的请求，既没有文件上传也没有手动输入数据。' });
    }

    const isPublic = req.body.isPublic === 'true';
    let cardsPath;

    if (isPublic) {
        cardsPath = path.join(cardsDirectory, fileName);
    } else {
        const userDirectory = path.join(cardsDirectory, req.session.username);
        if (!fs.existsSync(userDirectory)) {
            fs.mkdirSync(userDirectory, { recursive: true });
        }
        cardsPath = path.join(userDirectory, fileName);
    }

    if (fs.existsSync(cardsPath)) {
        return res.status(400).json({ 
            success: false, 
            message: '文件名已存在，请选择其他名称或修改文件名后再上传。' 
        });
    }

    fs.writeFileSync(cardsPath, fileContent);

    if (req.file) {
        fs.unlinkSync(req.file.path);
    }

    res.json({ success: true, message: '上传成功！' });
});

// 获取学习卡内容接口
app.get('/api/card/:name', checkAuthentication, (req, res) => { // 重构：将原本的页面渲染接口改为返回 JSON 数据
    const cardName = req.params.name;
    let cardContent = getCardContent(cardName, req.session.username);
    if (cardContent) {
        cardContent = shuffleArray(cardContent);
        res.json({ questions: cardContent });
    } else {
        res.status(404).json({ message: '卡片未找到' });
    }
});

// 注销接口
app.get('/api/logout', (req, res) => { // 重构：改为 API，返回 JSON 消息
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: '退出时发生错误' });
        }
        res.json({ message: '注销成功' });
    });
});

// 获取排行榜接口
app.get('/api/leaderboard', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    let leaderboard = [];

    if (fs.existsSync(learningRecordsPath)) {
        const learningRecords = JSON.parse(fs.readFileSync(learningRecordsPath));

        for (let user in learningRecords) {
            if (learningRecords[user][today]) {
                leaderboard.push({
                    username: user,
                    totalWords: learningRecords[user][today].totalWords
                });
            }
        }

        leaderboard.sort((a, b) => b.totalWords - a.totalWords);
    }

    res.json(leaderboard);
});

// 管理员生成邀请码接口
app.post('/admin/generate-invite-code', checkAdmin, (req, res) => {
    const users = loadUsers();
    const inviteCode = generateUniqueInviteCode(users);

    const adminUser = users.find(u => u.username === 'admin');
    adminUser.inviteCode = inviteCode;

    fs.writeFileSync(usersFilePath, users.map(u => `${u.username},${u.password},${u.role},${u.inviteCode},${u.isUsed}`).join('\n'));

    res.json({ message: '邀请码生成成功', inviteCode });
});

// 管理员查看学习记录接口
app.get('/admin/view-learning-records', checkAdmin, (req, res) => {
    const learningRecords = loadLearningRecords();
    res.json(learningRecords);
});

// 管理员冻结用户接口
app.post('/admin/freeze-user', checkAdmin, (req, res) => {
    const { username } = req.body;
    const users = loadUsers();
    const user = users.find(u => u.username === username);

    if (user) {
        user.isFrozen = true;
        fs.writeFileSync(usersFilePath, users.map(u => `${u.username},${u.password},${u.role},${u.inviteCode},${u.isUsed},${u.isFrozen || false}`).join('\n'));
        res.json({ message: `用户 ${username} 已被冻结。` });
    } else {
        res.status(404).json({ message: '用户未找到。' });
    }
});

// 管理员删除用户接口
app.post('/admin/delete-user', checkAdmin, (req, res) => {
    const { username } = req.body;
    let users = loadUsers();
    const userIndex = users.findIndex(u => u.username === username);

    if (userIndex !== -1) {
        users.splice(userIndex, 1);
        fs.writeFileSync(usersFilePath, users.map(u => `${u.username},${u.password},${u.role},${u.inviteCode},${u.isUsed}`).join('\n'));
        res.json({ message: `用户 ${username} 已被删除。` });
    } else {
        res.status(404).json({ message: '用户未找到。' });
    }
});

// 管理员删除学习卡接口
app.post('/admin/delete-card', checkAdmin, (req, res) => {
    const { cardName } = req.body;
    const publicCardPath = path.join(cardsDirectory, `${cardName}.txt`);
    const userCardPath = path.join(cardsDirectory, req.session.username, `${cardName}.txt`);

    let filePath;
    if (fs.existsSync(publicCardPath)) {
        filePath = publicCardPath;
    } else if (fs.existsSync(userCardPath)) {
        filePath = userCardPath;
    } else {
        return res.status(404).json({ success: false, message: `找不到学习卡：${cardName}` });
    }

    fs.unlink(filePath, (err) => {
        if (err) {
            console.error('删除文件时出错:', err);
            return res.status(500).json({ success: false, message: '删除文件失败', error: err.message });
        }
        return res.json({ success: true, message: `学习卡 ${cardName} 已删除` });
    });
});

// 管理员上传全局学习卡接口
app.post('/admin/upload-global-card', checkAdmin, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('请上传 .txt 文件');
    }
    const globalCardPath = path.join(cardsDirectory, req.file.originalname);
    
    if (fs.existsSync(globalCardPath)) {
        return res.status(400).send('文件名已存在，请选择其他名称');
    }

    fs.rename(req.file.path, globalCardPath, (err) => {
        if (err) {
            console.error('文件移动失败:', err);
            return res.status(500).send('文件处理失败');
        }
        res.json({ message: '全局学习卡上传成功！' });
    });
});

// 管理员页面路由
app.get('/admin', checkAdmin, (req, res) => {
    const users = loadUsers();
    const cards = getCardsList(req.session.username);
    const publicCards = cards.publicCards;
    const userCards = cards.userCards;

    res.render('admin', { users, publicCards, userCards });
});

// 启动服务器
app.listen(port, () => {
    console.log(`服务器运行在 http://localhost:${port}`);
});