const mongoose = require('mongoose')
const { dbUri } = require('./env')
module.exports = async () => {
  try {
    await mongoose.connect(dbUri)
    console.log('database connected successfully')
  } catch (err) {
    console.log(err)
  }
}
