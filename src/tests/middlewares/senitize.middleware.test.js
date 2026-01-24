const sanitize = require('../../middlewares/sanitize.middleware')
const { mockRequest, mockResponse, mockNext } = require('../helpers')

describe('Sanitize Middleware', () => {
  it('should sanitize string values in request body', () => {
    const req = mockRequest({
      body: {
        name: '<script>alert("xss")</script>John',
        email: 'test@example.com',
      },
    })
    const res = mockResponse()
    const next = mockNext()

    sanitize(req, res, next)

    expect(req.body.name).not.toContain('<script>')
    expect(req.body.email).toBe('test@example.com')
    expect(next).toHaveBeenCalled()
  })

  it('should sanitize nested objects', () => {
    const req = mockRequest({
      body: {
        user: {
          name: '<img src=x onerror=alert(1)>',
          bio: 'Normal text',
        },
      },
    })
    const res = mockResponse()
    const next = mockNext()

    sanitize(req, res, next)

    expect(req.body.user.name).not.toContain('onerror')
    expect(req.body.user.bio).toBe('Normal text')
  })

  it('should sanitize arrays', () => {
    const req = mockRequest({
      body: {
        items: ['<script>bad</script>', 'good', '<b>bold</b>'],
      },
    })
    const res = mockResponse()
    const next = mockNext()

    sanitize(req, res, next)

    expect(req.body.items[0]).not.toContain('<script>')
    expect(req.body.items[1]).toBe('good')
  })

  it('should preserve non-string values', () => {
    const req = mockRequest({
      body: {
        count: 123,
        active: true,
        price: 99.99,
        empty: null,
      },
    })
    const res = mockResponse()
    const next = mockNext()

    sanitize(req, res, next)

    expect(req.body.count).toBe(123)
    expect(req.body.active).toBe(true)
    expect(req.body.price).toBe(99.99)
    expect(req.body.empty).toBeNull()
  })

  it('should handle empty body', () => {
    const req = mockRequest({ body: {} })
    const res = mockResponse()
    const next = mockNext()

    sanitize(req, res, next)

    expect(req.body).toEqual({})
    expect(next).toHaveBeenCalled()
  })

  it('should handle missing body', () => {
    const req = mockRequest()
    delete req.body
    const res = mockResponse()
    const next = mockNext()

    sanitize(req, res, next)

    expect(next).toHaveBeenCalled()
  })

  it('should sanitize XSS attempts', () => {
    const req = mockRequest({
      body: {
        comment: '<iframe src="javascript:alert(\'XSS\')"></iframe>',
      },
    })
    const res = mockResponse()
    const next = mockNext()

    sanitize(req, res, next)

    // xss library escapes dangerous HTML, doesn't remove content
    expect(req.body.comment).toContain('&lt;iframe')
    expect(req.body.comment).toContain('&gt;')
    expect(req.body.comment).not.toContain('<iframe')
  })

  it('should allow safe HTML', () => {
    const req = mockRequest({
      body: {
        text: 'Hello <b>World</b>',
      },
    })
    const res = mockResponse()
    const next = mockNext()

    sanitize(req, res, next)

    // xss library allows some safe tags by default
    expect(req.body.text).toContain('World')
  })
})