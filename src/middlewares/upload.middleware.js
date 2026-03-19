const multer = require('multer')

const { UnsupportedMediaTypeError } = require('@errors')
const { VALIDATION } = require('@constants')

const storage = multer.memoryStorage()

const fileFilter = (req, file, cb) => {
  if (!VALIDATION.FILE.ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    return cb(
      new UnsupportedMediaTypeError(
        `Invalid file format. Please upload an image in one of the following formats: ${VALIDATION.FILE.ALLOWED_IMAGE_TYPES.join(', ')}`,
        'UNSUPPORTED_FILE_TYPE'
      )
    )
  }
  cb(null, true)
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: VALIDATION.FILE.MAX_SIZE,
  },
})

module.exports = upload
