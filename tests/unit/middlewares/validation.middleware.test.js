const Joi = require('joi')
const validate = require('@middlewares/validation.middleware')
const { ValidationError } = require('@errors')

const makeReq = (overrides = {}) => ({
  headers: {},
  params: {},
  query: {},
  body: {},
  ...overrides,
})

const makeNext = () => jest.fn()

describe('validation.middleware', () => {
  describe('valid input', () => {
    it('calls next() when schema passes', () => {
      const schema = Joi.object({ body: Joi.object({ name: Joi.string().required() }) })
      const req = makeReq({ body: { name: 'Alice' } })
      const next = makeNext()

      validate(schema)(req, {}, next)

      expect(next).toHaveBeenCalledWith()
    })

    it('strips unknown body fields after validation', () => {
      const schema = Joi.object({ body: Joi.object({ name: Joi.string().required() }) })
      const req = makeReq({ body: { name: 'Alice', extra: 'should be removed' } })

      validate(schema)(req, {}, makeNext())

      expect(req.body.extra).toBeUndefined()
      expect(req.body.name).toBe('Alice')
    })

    it('mutates req.body in place with coerced values', () => {
      const schema = Joi.object({
        body: Joi.object({ age: Joi.number().required() }),
      })
      const req = makeReq({ body: { age: '25' } })

      validate(schema)(req, {}, makeNext())

      expect(typeof req.body.age).toBe('number')
      expect(req.body.age).toBe(25)
    })
  })

  describe('invalid input', () => {
    it('throws ValidationError when a required field is missing', () => {
      const schema = Joi.object({ body: Joi.object({ name: Joi.string().required() }) })
      const req = makeReq({ body: {} })

      expect(() => validate(schema)(req, {}, makeNext())).toThrow(ValidationError)
    })

    it('throws with code VALIDATION_FAILED', () => {
      const schema = Joi.object({ body: Joi.object({ name: Joi.string().required() }) })
      const req = makeReq({ body: {} })

      try {
        validate(schema)(req, {}, makeNext())
      } catch (err) {
        expect(err.code).toBe('VALIDATION_FAILED')
      }
    })

    it('collects all errors (abortEarly: false), not just the first', () => {
      const schema = Joi.object({
        body: Joi.object({
          name: Joi.string().required(),
          email: Joi.string().email().required(),
        }),
      })
      const req = makeReq({ body: {} })

      try {
        validate(schema)(req, {}, makeNext())
      } catch (err) {
        expect(err.errors.length).toBeGreaterThan(1)
      }
    })

    it('each error object has path and message properties', () => {
      const schema = Joi.object({ body: Joi.object({ name: Joi.string().required() }) })
      const req = makeReq({ body: {} })

      try {
        validate(schema)(req, {}, makeNext())
      } catch (err) {
        err.errors.forEach((e) => {
          expect(e).toHaveProperty('path')
          expect(e).toHaveProperty('message')
        })
      }
    })

    it('deduplicates errors for the same path', () => {
      const schema = Joi.object({
        body: Joi.object({ name: Joi.string().min(2).max(1) }),
      })
      const req = makeReq({ body: { name: 'X' } })

      try {
        validate(schema)(req, {}, makeNext())
      } catch (err) {
        const paths = err.errors.map((e) => e.path)
        const uniquePaths = [...new Set(paths)]
        expect(paths.length).toBe(uniquePaths.length)
      }
    })
  })

  describe('validates different request parts', () => {
    it('validates body fields', () => {
      const schema = Joi.object({ body: Joi.object({ x: Joi.string().required() }) })
      expect(() => validate(schema)(makeReq({ body: {} }), {}, makeNext())).toThrow(ValidationError)
    })

    it('validates params fields', () => {
      const schema = Joi.object({ params: Joi.object({ id: Joi.string().uuid().required() }) })
      expect(() => validate(schema)(makeReq({ params: { id: 'bad' } }), {}, makeNext())).toThrow(
        ValidationError
      )
    })

    it('validates query fields', () => {
      const schema = Joi.object({ query: Joi.object({ page: Joi.number().required() }) })
      expect(() => validate(schema)(makeReq({ query: {} }), {}, makeNext())).toThrow(
        ValidationError
      )
    })
  })
})
