const sequelize = require('../db')
const { DataTypes, Deferrable } = require('sequelize')

const learning_data = sequelize.define('tickets', {
  text: DataTypes.TEXT,
  label: DataTypes.TEXT,
})

// common_information.sync({ alter: true })

module.exports.LearningData = learning_data