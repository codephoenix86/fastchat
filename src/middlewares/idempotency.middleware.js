const { StatusCodes } = require('http-status-codes')
const { redis } = require('@config')
const { ApiResponse } = require('@utils')
const { logger } = require('@config')

const redisClient = redis.getClient()

const idempotency = (options = {}) => {
  const ttl = options.ttl || 24 * 60 * 60 // 24 hours by default

  return async (req, res, next) => {
    const idempotencyKey = req.headers['x-idempotency-key']

    if (!idempotencyKey) {
      return next()
    }

    // Isolate by user to prevent key collisions across different users
    const cacheKey = `idempotency:${req.user?.id || 'anonymous'}:${idempotencyKey}`

    try {
      // 1. Check if the key already exists
      const cachedResult = await redisClient.get(cacheKey)

      if (cachedResult) {
        if (cachedResult === 'PROCESSING') {
          return res
            .status(StatusCodes.CONFLICT)
            .json(
              new ApiResponse(
                'A request with this idempotency key is already being processed.',
                null,
                StatusCodes.CONFLICT
              )
            )
        }

        const parsedResponse = JSON.parse(cachedResult)
        logger.debug(`Idempotency cache hit for key: ${idempotencyKey}`)

        // Return the cached response
        return res.status(parsedResponse.statusCode).json(parsedResponse.body)
      }

      // 2. Lock the key to indicate it is currently processing (avoid race conditions)
      // SET NX prevents overwriting if another request just created it
      // EX 30 ensures the lock expires if the server crashes while processing
      const acquired = await redisClient.set(cacheKey, 'PROCESSING', 'NX', 'EX', 30)
      if (!acquired) {
        return res
          .status(StatusCodes.CONFLICT)
          .json(
            new ApiResponse(
              'A request with this idempotency key is already being processed.',
              null,
              StatusCodes.CONFLICT
            )
          )
      }

      // 3. Intercept the response
      const originalJson = res.json.bind(res)

      res.json = (body) => {
        // Cache the successful/failed response payload
        const responseToCache = {
          statusCode: res.statusCode,
          body,
        }

        // Save the actual response and set the full TTL
        redisClient.set(cacheKey, JSON.stringify(responseToCache), 'EX', ttl).catch((err) => {
          logger.error('Failed to save idempotency cache', err)
        })

        // Send the original response
        return originalJson(body)
      }

      next()
    } catch (error) {
      logger.error('Idempotency middleware error', error)
      next(error)
    }
  }
}

module.exports = idempotency
