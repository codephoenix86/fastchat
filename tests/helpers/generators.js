let counter = 0

const generateUsername = () => {
  const timestamp = Date.now().toString(36)
  const c = (counter++).toString(36)
  const random = Math.random().toString(36).substring(2, 5)
  return `u${timestamp}${c}${random}`.substring(0, 20)
}

const generateEmail = () => {
  const timestamp = Date.now().toString(36)
  const c = (counter++).toString(36)
  const random = Math.random().toString(36).substring(2, 5)
  return `test${timestamp}${c}${random}@example.com`
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

module.exports = { generateUsername, generateEmail, wait }
