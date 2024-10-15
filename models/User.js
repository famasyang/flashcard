// models/User.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  isAdmin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

// models/InviteCode.js
const InviteCode = sequelize.define('InviteCode', {
  code: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  isUsed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

// …Ë÷√πÿ¡™
User.hasMany(InviteCode, { foreignKey: 'createdBy' });
InviteCode.belongsTo(User, { foreignKey: 'createdBy' });

module.exports = { User, InviteCode };