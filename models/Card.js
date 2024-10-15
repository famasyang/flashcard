// models/Card.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const CardSet = sequelize.define('CardSet', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  }
});

const Card = sequelize.define('Card', {
  word: {
    type: DataTypes.STRING,
    allowNull: false
  },
  definition: {
    type: DataTypes.TEXT,
    allowNull: false
  }
});

CardSet.hasMany(Card);
Card.belongsTo(CardSet);

module.exports = { Card, CardSet };
