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

const usersFilePath = path.join(__dirname, 'user', 'users.txt');
const cardsDirectory = path.join(__dirname, 'cards');
const learningRecordsPath = path.join(__dirname, 'learningRecords.json');

app.set('view engine', 'ejs');
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


const upload = multer({ storage: storage });

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

function generateUniqueInviteCode(users) {
    let inviteCode;
    do {
        inviteCode = uuidv4();
    } while (users.some(user => user.inviteCode === inviteCode));
    return inviteCode;
}

function getCardsList(username) {
    const publicCards = [];
    const userCards = [];

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

function getCardContent(cardName, username) {
    if (!cardName || !username) {
        console.error('Invalid arguments: cardName or username is undefined');
        return null;
    }

    let filePath = path.join(cardsDirectory, username, `${cardName}.txt`);
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        return parseCardContent(fileContent);
    }

    filePath = path.join(cardsDirectory, `${cardName}.txt`);
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        return parseCardContent(fileContent);
    }

    return null;
}

function parseCardContent(fileContent) {
    return fileContent.split('\n').map(line => {
        const parts = line.split(',');
        if (parts.length === 2) {
            return { word: parts[0].trim(), definition: parts[1].trim() };
        }
    }).filter(item => item !== undefined);
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function getRandomOptions(correctAnswer, allAnswers, optionType = 'definition') {
    const shuffled = allAnswers.filter(a => a[optionType] !== correctAnswer[optionType])
                               .sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3).map(item => item[optionType]);
}

function checkAuthentication(req, res, next) {
    if (req.session.loggedIn && req.session.username) {
        next();
    } else {
        res.redirect('/login');
    }
}

function loadLearningRecords() {
    if (!fs.existsSync(learningRecordsPath)) {
        fs.writeFileSync(learningRecordsPath, '[]');
        return [];
    }
    const data = fs.readFileSync(learningRecordsPath, 'utf-8').trim();
    return JSON.parse(data);
}

function saveLearningRecords(records) {
    fs.writeFileSync(learningRecordsPath, JSON.stringify(records, null, 2));
}

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

app.post('/api/register', (req, res) => {
    const { username, password, inviteCode } = req.body;
    const users = loadUsers();

    if (users.find(user => user.username === username)) {
        return res.json({ message: '用户名已存在！' });
    }

    const invitingUser = users.find(u => u.inviteCode === inviteCode);

    if (!invitingUser) {
        return res.json({ message: '邀请码无效！' });
    }

    if (invitingUser.role !== 'admin' && invitingUser.isUsed) {
        return res.json({ message: '邀请码已被使用！' });
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

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = loadUsers();
    const user = users.find(u => u.username === username);
    if (user && bcrypt.compareSync(password, user.password)) {
        req.session.loggedIn = true;
        req.session.username = username;
        return res.json({ message: '登录成功！' });
    } else {
        return res.json({ message: '用户名或密码错误！' });
    }
});

app.post('/upload', upload.single('file'), (req, res) => {
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

app.get('/', checkAuthentication, (req, res) => {
    const { publicCards, userCards } = getCardsList(req.session.username);
    const users = loadUsers();
    const currentUser = users.find(user => user.username === req.session.username);
    const learningRecords = loadLearningRecords();

    res.render('index', { 
        publicCards, 
        userCards, 
        isLoggedIn: req.session.loggedIn, 
        username: req.session.username, 
        inviteCode: currentUser.inviteCode,
        learningRecords,
        role: currentUser.role
    });
});

app.get('/login', (req, res) => {
    if (req.session.loggedIn) {
        return res.redirect('/');
    }
    res.render('login');
});

app.get('/card/:name', checkAuthentication, (req, res) => {
    const cardName = decodeURIComponent(req.params.name);
    const cardContent = getCardContent(cardName, req.session.username);

    if (cardContent) {
        const isRandom = req.query.random === 'true';
        const contentToShow = isRandom ? shuffleArray([...cardContent]) : cardContent;
        
        res.render('quiz', { cardName, cardContent: contentToShow, total: cardContent.length });
    } else {
        res.status(404).send('卡片未找到');
    }
});

app.get('/api/card/:name', checkAuthentication, (req, res) => {
    const cardName = req.params.name;
    let cardContent = getCardContent(cardName, req.session.username);
    if (cardContent) {
        cardContent = shuffleArray(cardContent);
        res.json({ questions: cardContent });
    } else {
        res.status(404).json({ message: '卡片未找到' });
    }
});

app.get('/api/card/:name/question/:index', checkAuthentication, (req, res) => {
    const cardName = req.params.name;
    const index = parseInt(req.params.index, 10);
    const isRandom = req.query.random === 'true';
    let cardContent = getCardContent(cardName, req.session.username);

    if (!cardContent) {
        return res.status(404).json({ message: '卡片未找到' });
    }

    if (isRandom) {
        cardContent = shuffleArray(cardContent);
    }

    if (index >= cardContent.length) {
        return res.status(404).json({ message: '没有更多题目了' });
    }

    const question = cardContent[index];
    const correctAnswer = question.definition;
    const definitionOptions = [...getRandomOptions(question, cardContent, 'definition'), correctAnswer].sort(() => 0.5 - Math.random());
    const wordOptions = [...getRandomOptions(question, cardContent, 'word'), question.word].sort(() => 0.5 - Math.random());

    const username = req.session.username;
    const today = new Date().toISOString().split('T')[0];

    let learningRecords = {};
    if (fs.existsSync(learningRecordsPath)) {
        const recordsData = fs.readFileSync(learningRecordsPath);
        learningRecords = JSON.parse(recordsData);
    }

    if (!learningRecords[username]) {
        learningRecords[username] = {};
    }

    if (!learningRecords[username][today]) {
        learningRecords[username][today] = {
            totalWords: 0,
            learnedWords: []
        };
    }

    if (!learningRecords[username][today].learnedWords.includes(question.word)) {
        learningRecords[username][today].learnedWords.push(question.word);
        learningRecords[username][today].totalWords += 1;
    }

    fs.writeFileSync(learningRecordsPath, JSON.stringify(learningRecords, null, 2));

res.json({
        word: question.word,
        correctAnswer: correctAnswer,
        options: definitionOptions,
        wordOptions: wordOptions,
        total: cardContent.length,
        index: index + 1
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('退出时发生错误');
        }
        res.redirect('/login');
    });
});

app.get('/api/leaderboard', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const learningRecordsPath = path.join(__dirname, 'learningRecords.json');

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

function checkAdmin(req, res, next) {
    if (req.session.loggedIn && req.session.username === 'admin') {
        next();
    } else {
        res.status(403).send('没有权限访问此页面');
    }
}

app.post('/admin/generate-invite-code', checkAdmin, (req, res) => {
    const users = loadUsers();
    const inviteCode = generateUniqueInviteCode(users);

    const adminUser = users.find(u => u.username === 'admin');
    adminUser.inviteCode = inviteCode;

    fs.writeFileSync(usersFilePath, users.map(u => `${u.username},${u.password},${u.role},${u.inviteCode},${u.isUsed}`).join('\n'));

    res.json({ message: '邀请码生成成功', inviteCode });
});

app.get('/admin/view-learning-records', checkAdmin, (req, res) => {
    const learningRecords = loadLearningRecords();
    res.json(learningRecords);
});

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

app.get('/admin', checkAdmin, (req, res) => {
    const users = loadUsers();
    const cards = getCardsList(req.session.username);
    const publicCards = cards.publicCards;
    const userCards = cards.userCards;

    res.render('admin', { users, publicCards, userCards });
});

app.listen(port, () => {
    console.log(`服务器运行在 http://localhost:${port}`);
});
