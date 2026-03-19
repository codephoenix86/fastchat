# Testing Guide

Testing strategy, tooling, structure, and best practices for fastchat.

---

## Testing Stack

| Tool                | Role                                                                  |
| ------------------- | --------------------------------------------------------------------- |
| **Jest**            | Test runner, assertions, mocking                                      |
| **Supertest**       | HTTP integration testing against the Express app                      |
| **Real MongoDB**    | Integration tests hit a real localhost MongoDB instance               |
| **Real PostgreSQL** | Integration tests hit a real PG instance (configured via `.env.test`) |
| **Real Redis**      | Integration tests hit a real Redis instance (flushed between tests)   |
| **Mocked S3**       | `@services/s3.service` is mocked globally — no real AWS calls         |

> Integration tests require all three databases running locally. Use dedicated test database names (e.g. `fastchat_test`) so tests never affect development data. AWS credentials are **not** required for testing — S3 is fully mocked.

---

## Directory Structure

```
tests/
├── integration/          # Full API tests via Supertest
│   ├── auth.test.js
│   ├── chats.test.js
│   ├── messages.test.js
│   ├── users.test.js
│   ├── errors.test.js
│   ├── health.test.js
│   └── helpers.js        # createTestUser, createTestChat, expectError, …
├── unit/                 # Isolated tests with mocked dependencies
│   ├── middlewares/
│   │   ├── authentication.middleware.test.js
│   │   └── senitization.middleware.test.js
│   ├── services/
│   │   ├── auth.service.test.js
│   │   ├── chat.service.test.js
│   │   ├── user.service.test.js
│   │   └── s3.service.test.js
│   ├── utils/
│   │   ├── asyncHandler.test.js
│   │   ├── errors.test.js
│   │   ├── jwt.test.js
│   │   ├── pagination.test.js
│   │   └── response.test.js
│   └── helpers.js        # createMockUser, mockRequest, mockResponse, …
├── helpers/
│   ├── db.helpers.js     # connectTestDB / clearTestDB / disconnectTestDB
│   └── index.js
├── factories/
│   └── user.factory.js
├── fixtures/
│   └── test-avatar.jpg   # Minimal valid JPEG created on first run
└── setup.js              # Jest global setup — mocks logger, Socket.io, S3
```

---

## Running Tests

```bash
# All tests with coverage report
npm test

# Watch mode (re-runs on file save)
npm run test:watch

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Run serially (useful when debugging flaky tests)
npm run test:sequential

# Attach Node inspector
npm run test:debug
```

Coverage HTML report is written to `coverage/lcov-report/index.html`.

---

## Environment Setup

Integration tests read from `.env.test`. Create this file alongside `.env`:

```env
NODE_ENV=test

MONGODB_URI=mongodb://localhost:27017/fastchat_test
POSTGRES_URI=postgresql://postgres:password@localhost:5432/fastchat_test
REDIS_URI=redis://localhost:6379

ACCESS_TOKEN_SECRET=test_access_token_secret_minimum_32_characters
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d

ALLOWED_ORIGINS=http://localhost:3000
MAX_FILE_SIZE=5242880

# AWS vars are required by envalid at startup even in test mode.
# The values below are placeholders — S3 is fully mocked and no
# real AWS calls are made during tests.
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test_key_id
AWS_SECRET_ACCESS_KEY=test_secret_key
S3_BUCKET_NAME=test-bucket
```

Use a separate database name (e.g. `fastchat_test`) so tests never affect development data. Run `npm run migrate:up` once against this test database.

---

## Test Database Lifecycle

Each integration test file follows this lifecycle:

```javascript
beforeAll(async () => {
  await connectTestDB() // Connects MongoDB, PostgreSQL pool, Redis
})

beforeEach(async () => {
  await clearTestDB() // Truncates all PG tables (CASCADE), drops all Mongo
  // documents, flushes Redis
})

afterAll(async () => {
  await disconnectTestDB() // Closes all connections gracefully
})
```

`clearTestDB` uses a PL/pgSQL block to `TRUNCATE … CASCADE` every public table, ensuring referential integrity is never an obstacle to clean state.

---

## Mocking Strategy

### Global mocks (`tests/setup.js`)

Three modules are mocked for every test file via `setupFilesAfterEnv`:

```javascript
// Suppress all logger output during test runs
jest.mock('@config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}))

// Prevent a real Socket.io server being spun up in HTTP tests
jest.mock('@sockets', () => ({
  init: jest.fn(),
  io: {
    to: jest.fn(() => ({ emit: jest.fn() })),
  },
}))

// Mock all S3 operations — no real AWS calls are ever made
jest.mock('@services/s3.service', () => ({
  uploadFile: jest.fn().mockResolvedValue('https://s3.url/avatar'),
  deleteFile: jest.fn().mockResolvedValue(undefined),
}))
```

The S3 mock means:

- Avatar upload tests (`POST /users/me/avatar`) receive a fake URL `'https://s3.url/avatar'` as the stored avatar value.
- Avatar delete tests (`DELETE /users/me/avatar`) confirm the DB field is cleared without triggering a real S3 `DeleteObjectCommand`.
- Unit tests for `UserService` can assert that `s3Service.uploadFile` / `s3Service.deleteFile` were called with the correct arguments.

### Unit tests

All external dependencies are mocked. The key mocks:

```javascript
// Repositories (used by services)
jest.mock('@repositories')

// bcrypt (CPU-intensive, no need to be real in unit tests)
jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }))

// Redis client (token repository)
jest.mock('@config/redis', () => ({
  getClient: () => ({ set: jest.fn(), get: jest.fn(), del: jest.fn() }),
}))
```

The S3 service unit tests (`tests/unit/services/s3.service.test.js`) call `jest.unmock('@services/s3.service')` at the top of the file to opt out of the global mock and test the real implementation against a mocked `@aws-sdk/client-s3`.

### Integration tests

- MongoDB, PostgreSQL, and Redis are all **real** instances running on localhost (flushed/cleared between tests).
- Socket.io and S3 are **mocked** globally (see above).
- Avatar upload tests use a minimal real JPEG fixture (`tests/fixtures/test-avatar.jpg`) created automatically by `beforeAll` if it does not already exist. The file is a valid 1×1 pixel JPEG so that Multer's file type validation passes — the actual upload is intercepted by the S3 mock.

---

## Test Helpers

### `createTestUser(overrides?)`

Inserts a user + profile row into PostgreSQL and issues a token pair. Returns `{ user, tokens }`.

```javascript
const { user, tokens } = await createTestUser()
const admin = await createTestUser({ role: 'admin' })
```

### `createTestUsers(count)`

Calls `createTestUser` in a loop and returns an array.

```javascript
const [user1, user2, user3] = await createTestUsers(3)
```

### `createTestChat(creator, participantIds, overrides?)`

Creates a Chat document in MongoDB. Adds the creator as a participant and (for group chats) as admin.

```javascript
const chat = await createTestChat(user1.user, [user2.user.id])

const group = await createTestChat(user1.user, [user2.user.id, user3.user.id], {
  type: 'group',
  groupName: 'Test Group',
})
```

### `createTestMessage(chat, sender, overrides?)`

Creates a Message document in MongoDB.

```javascript
const msg = await createTestMessage(chat, user1.user, { content: 'Hello' })
```

### Response assertion helpers

```javascript
// Assert a successful response
expectSuccess(response, 201, 'User created successfully')

// Assert an error response
expectError(response, 400, 'VALIDATION_FAILED')

// Assert pagination shape
expectPagination(response)
```

### `generateUsername()` / `generateEmail()`

Generate unique, schema-valid values for each test run.

---

## Writing Tests

### AAA pattern

Every test follows Arrange → Act → Assert:

```javascript
it('should update bio', async () => {
  // Arrange
  const { tokens } = await createTestUser()

  // Act
  const response = await request(app)
    .patch('/api/v1/users/me')
    .set('Authorization', `Bearer ${tokens.accessToken}`)
    .send({ bio: 'New bio' })

  // Assert
  expectSuccess(response, 200, 'User updated successfully')
  expect(response.body.data.user.bio).toBe('New bio')
})
```

### Naming convention

```
should <expected result> [when <condition>]
```

Examples:

- `should return 409 for duplicate email`
- `should delete chat when last member leaves`
- `should throw AuthenticationError when token is expired`
- `should upload new avatar and delete old one from S3`

### Test isolation

- Each test is independent. Never rely on state created by a previous test.
- Use `beforeEach` to reset the database.
- Use `jest.clearAllMocks()` in `beforeEach` for unit tests.

### Testing S3 interactions

Because `@services/s3.service` is mocked globally, assert on the mock functions rather than real S3 state:

```javascript
const s3Service = require('@services/s3.service')

it('should delete old avatar when uploading a new one', async () => {
  const { tokens } = await createTestUser({ avatar: 'https://old.s3.url/avatar' })

  await request(app)
    .post('/api/v1/users/me/avatar')
    .set('Authorization', `Bearer ${tokens.accessToken}`)
    .attach('avatar', testImagePath)

  expect(s3Service.deleteFile).toHaveBeenCalledWith('https://old.s3.url/avatar')
  expect(s3Service.uploadFile).toHaveBeenCalled()
})
```

### Testing error cases

```javascript
it('should return 401 for expired token', async () => {
  const jwt = require('jsonwebtoken')
  const { env } = require('@config')
  const expired = jwt.sign({ id: 'x' }, env.ACCESS_TOKEN_SECRET, { expiresIn: '-1h' })

  const response = await request(app)
    .get('/api/v1/users/me')
    .set('Authorization', `Bearer ${expired}`)

  expectError(response, 401, 'TOKEN_EXPIRED')
})
```

---

## Coverage Requirements

Minimum thresholds enforced in `jest.config.js`:

| Metric     | Threshold |
| ---------- | --------- |
| Branches   | 70%       |
| Functions  | 70%       |
| Lines      | 70%       |
| Statements | 70%       |

The build fails if any threshold is not met.

Target by layer:

| Layer        | Target                              |
| ------------ | ----------------------------------- |
| Controllers  | ~90% (covered by integration tests) |
| Services     | ~85% (unit + integration)           |
| Repositories | ~75% (integration)                  |
| Utilities    | ~95% (pure functions)               |
| Middlewares  | ~85% (unit + integration)           |

---

## Debugging

```bash
# Run a single test file
npm test -- auth.test.js

# Run tests matching a name pattern
npm test -- -t "should create a new user"

# Attach Node inspector
npm run test:debug
```

Focus or skip individual tests:

```javascript
it.only('test just this one', async () => { … })
it.skip('come back to this later', async () => { … })
```

---

## Further Reading

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest](https://github.com/ladjs/supertest)
- [Architecture Overview](ARCHITECTURE.md)
- [REST API Reference](API_REST.md)
