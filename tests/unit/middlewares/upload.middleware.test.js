const { UnsupportedMediaTypeError } = require('@errors')
const { VALIDATION } = require('@constants')

// jest.mock is hoisted, so we use a module-level variable to capture config
let capturedConfig = null
const mockSingle = jest.fn().mockReturnValue(jest.fn())

jest.mock('multer', () => {
  const memoryStorage = jest.fn().mockReturnValue('memoryStorageInstance')
  const multerFn = jest.fn().mockImplementation((config) => {
    capturedConfig = config
    return { single: mockSingle }
  })
  multerFn.memoryStorage = memoryStorage
  return multerFn
})

// Must require AFTER mock registration (hoisting ensures mock is in place)
const upload = require('@middlewares/upload.middleware')

describe('upload.middleware', () => {
  it('uses memoryStorage (not disk storage)', () => {
    // multer.memoryStorage() was called at module load; capturedConfig.storage holds the result
    expect(capturedConfig.storage).toBe('memoryStorageInstance')
  })

  it('sets fileSize limit to VALIDATION.FILE.MAX_SIZE', () => {
    expect(capturedConfig.limits.fileSize).toBe(VALIDATION.FILE.MAX_SIZE)
  })

  it('exports a multer instance with a .single method', () => {
    expect(typeof upload.single).toBe('function')
  })

  describe('fileFilter', () => {
    it('calls cb(null, true) for image/jpeg', () => {
      const cb = jest.fn()
      capturedConfig.fileFilter({}, { mimetype: 'image/jpeg' }, cb)
      expect(cb).toHaveBeenCalledWith(null, true)
    })

    it('calls cb(null, true) for image/jpg', () => {
      const cb = jest.fn()
      capturedConfig.fileFilter({}, { mimetype: 'image/jpg' }, cb)
      expect(cb).toHaveBeenCalledWith(null, true)
    })

    it('calls cb(null, true) for image/png', () => {
      const cb = jest.fn()
      capturedConfig.fileFilter({}, { mimetype: 'image/png' }, cb)
      expect(cb).toHaveBeenCalledWith(null, true)
    })

    it('calls cb(null, true) for image/gif', () => {
      const cb = jest.fn()
      capturedConfig.fileFilter({}, { mimetype: 'image/gif' }, cb)
      expect(cb).toHaveBeenCalledWith(null, true)
    })

    it('calls cb with UnsupportedMediaTypeError for video/mp4', () => {
      const cb = jest.fn()
      capturedConfig.fileFilter({}, { mimetype: 'video/mp4' }, cb)
      expect(cb).toHaveBeenCalledWith(expect.any(UnsupportedMediaTypeError))
    })

    it('calls cb with UnsupportedMediaTypeError for application/pdf', () => {
      const cb = jest.fn()
      capturedConfig.fileFilter({}, { mimetype: 'application/pdf' }, cb)
      expect(cb).toHaveBeenCalledWith(expect.any(UnsupportedMediaTypeError))
    })

    it('the error has code UNSUPPORTED_FILE_TYPE', () => {
      const cb = jest.fn()
      capturedConfig.fileFilter({}, { mimetype: 'text/plain' }, cb)
      const err = cb.mock.calls[0][0]
      expect(err.code).toBe('UNSUPPORTED_FILE_TYPE')
    })
  })
})
