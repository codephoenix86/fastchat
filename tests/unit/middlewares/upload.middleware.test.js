const { UnsupportedMediaTypeError } = require('@errors')
const { VALIDATION } = require('@constants')

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

const upload = require('@middlewares/upload.middleware')

describe('upload.middleware', () => {
  it('uses memoryStorage', () => {
    expect(capturedConfig.storage).toBe('memoryStorageInstance')
  })

  it('sets fileSize limit from VALIDATION.FILE.MAX_SIZE', () => {
    expect(capturedConfig.limits.fileSize).toBe(VALIDATION.FILE.MAX_SIZE)
  })

  it('exports a multer instance with a .single method', () => {
    expect(typeof upload.single).toBe('function')
  })

  describe('fileFilter', () => {
    it('accepts image/jpeg', () => {
      const cb = jest.fn()
      capturedConfig.fileFilter({}, { mimetype: 'image/jpeg' }, cb)
      expect(cb).toHaveBeenCalledWith(null, true)
    })

    it('accepts image/jpg', () => {
      const cb = jest.fn()
      capturedConfig.fileFilter({}, { mimetype: 'image/jpg' }, cb)
      expect(cb).toHaveBeenCalledWith(null, true)
    })

    it('accepts image/png', () => {
      const cb = jest.fn()
      capturedConfig.fileFilter({}, { mimetype: 'image/png' }, cb)
      expect(cb).toHaveBeenCalledWith(null, true)
    })

    it('accepts image/gif', () => {
      const cb = jest.fn()
      capturedConfig.fileFilter({}, { mimetype: 'image/gif' }, cb)
      expect(cb).toHaveBeenCalledWith(null, true)
    })

    it('rejects video/mp4 with UnsupportedMediaTypeError', () => {
      const cb = jest.fn()
      capturedConfig.fileFilter({}, { mimetype: 'video/mp4' }, cb)
      expect(cb).toHaveBeenCalledWith(expect.any(UnsupportedMediaTypeError))
    })

    it('rejects application/pdf with UnsupportedMediaTypeError', () => {
      const cb = jest.fn()
      capturedConfig.fileFilter({}, { mimetype: 'application/pdf' }, cb)
      expect(cb).toHaveBeenCalledWith(expect.any(UnsupportedMediaTypeError))
    })

    it('sets error code to UNSUPPORTED_FILE_TYPE', () => {
      const cb = jest.fn()
      capturedConfig.fileFilter({}, { mimetype: 'text/plain' }, cb)
      expect(cb.mock.calls[0][0].code).toBe('UNSUPPORTED_FILE_TYPE')
    })
  })
})
