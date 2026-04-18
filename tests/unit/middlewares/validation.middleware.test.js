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

    it('coerces values in place', () => {
      const schema = Joi.object({ body: Joi.object({ age: Joi.number().required() }) })
      const req = makeReq({ body: { age: '25' } })

      validate(schema)(req, {}, makeNext())

      expect(req.body.age).toBe(25)
    })
  })

  describe('invalid input', () => {
    it('throws ValidationError for a missing required field', () => {
      const schema = Joi.object({ body: Joi.object({ name: Joi.string().required() }) })
      expect(() => validate(schema)(makeReq({ body: {} }), {}, makeNext())).toThrow(ValidationError)
    })

    it('throws with code VALIDATION_FAILED', () => {
      const schema = Joi.object({ body: Joi.object({ name: Joi.string().required() }) })
      expect(() => validate(schema)(makeReq({ body: {} }), {}, makeNext())).toThrow(
        expect.objectContaining({ code: 'VALIDATION_FAILED' })
      )
    })

    it('collects all errors when abortEarly is false', () => {
      const schema = Joi.object({
        body: Joi.object({
          name: Joi.string().required(),
          email: Joi.string().email().required(),
        }),
      })

      expect(() => validate(schema)(makeReq({ body: {} }), {}, makeNext())).toThrow(
        expect.objectContaining({
          errors: expect.arrayContaining([expect.anything(), expect.anything()]),
        })
      )
    })

    it('each error has path and message properties', () => {
      const schema = Joi.object({ body: Joi.object({ name: Joi.string().required() }) })

      try {
        validate(schema)(makeReq({ body: {} }), {}, makeNext())
      } catch (err) {
        err.errors.forEach((e) => {
          expect(e).toHaveProperty('path')
          expect(e).toHaveProperty('message')
        })
      }
    })

    it('deduplicates errors for the same path', () => {
      const schema = Joi.object({ body: Joi.object({ name: Joi.string().min(2).max(1) }) })

      try {
        validate(schema)(makeReq({ body: { name: 'X' } }), {}, makeNext())
      } catch (err) {
        const paths = err.errors.map((e) => e.path)
        expect(paths.length).toBe([...new Set(paths)].length)
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
