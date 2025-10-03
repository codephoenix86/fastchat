require('dotenv').config()

const express = require('express')
const app = express()

const routes = require('./routes')
const { errorHandler } = require('./middlewares')

app.use(express.json())
app.use('/api', routes)
app.use(errorHandler)

module.exports = app
