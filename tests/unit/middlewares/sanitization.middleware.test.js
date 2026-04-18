const sanitize = require('@middlewares/sanitization.middleware')
const { mockRequest, mockResponse, mockNext } = require('@tests/unit/helpers')

describe('sanitization.middleware', () => {
  it('strips script tags from string body fields', () => {
    const req = mockRequest({
      body: {
        name: '<script>alert("xss")</script>John',
        email: 'test@example.com',
      },
    })
    const next = mockNext()

    sanitize(req, mockResponse(), next)

    expect(req.body.name).not.toContain('<script>')
    expect(req.body.email).toBe('test@example.com')
    expect(next).toHaveBeenCalled()
  })

  it('sanitizes nested objects', () => {
    const req = mockRequest({
      body: {
        user: {
          name: '<img src=x onerror=alert(1)>',
          bio: 'Normal text',
        },
      },
    })

    sanitize(req, mockResponse(), mockNext())

    expect(req.body.user.name).not.toContain('onerror')
    expect(req.body.user.bio).toBe('Normal text')
  })

  it('sanitizes strings inside arrays', () => {
    const req = mockRequest({
      body: { items: ['<script>bad</script>', 'good', '<b>bold</b>'] },
    })

    sanitize(req, mockResponse(), mockNext())

    expect(req.body.items[0]).not.toContain('<script>')
    expect(req.body.items[1]).toBe('good')
  })

  it('preserves non-string values', () => {
    const req = mockRequest({
      body: { count: 123, active: true, price: 99.99, empty: null },
    })

    sanitize(req, mockResponse(), mockNext())

    expect(req.body.count).toBe(123)
    expect(req.body.active).toBe(true)
    expect(req.body.price).toBe(99.99)
    expect(req.body.empty).toBeNull()
  })

  it('handles an empty body', () => {
    const req = mockRequest({ body: {} })
    const next = mockNext()

    sanitize(req, mockResponse(), next)

    expect(req.body).toEqual({})
    expect(next).toHaveBeenCalled()
  })

  it('handles a missing body', () => {
    const req = mockRequest()
    delete req.body
    const next = mockNext()

    sanitize(req, mockResponse(), next)

    expect(next).toHaveBeenCalled()
  })

  it('escapes dangerous HTML tags', () => {
    const req = mockRequest({
      body: { comment: '<iframe src="javascript:alert(\'XSS\')"></iframe>' },
    })

    sanitize(req, mockResponse(), mockNext())

    expect(req.body.comment).toContain('&lt;iframe')
    expect(req.body.comment).toContain('&gt;')
    expect(req.body.comment).not.toContain('<iframe')
  })

  it('passes safe HTML through', () => {
    const req = mockRequest({ body: { text: 'Hello <b>World</b>' } })

    sanitize(req, mockResponse(), mockNext())

    expect(req.body.text).toContain('World')
  })
})
