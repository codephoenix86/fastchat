const app = require('./src/app')
const { port } = require('./src/config/env')
const connectDB = require('./src/config/db')
connectDB()
app.listen(port, () => {
  console.log('server listening on port:', port)
})
