// config/db.js
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('flashcards', 'hahaha', 'yangkou9510', {
  host: '127.0.0.1',
  dialect: 'mysql'
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('MariaDB connected');
  } catch (err) {
    console.error('MariaDB connection error:', err);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };