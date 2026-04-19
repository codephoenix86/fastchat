# Testing Guide

Testing strategy, environment setup, helpers, and patterns for fastchat.

---

## Stack

| Tool                | Role                                                     |
| ------------------- | -------------------------------------------------------- |
| **Jest 30**         | Test runner, assertions, mocking                         |
| **Supertest 7**     | HTTP integration tests against the Express app           |
| **Real MongoDB**    | Integration tests hit a real localhost instance          |
| **Real PostgreSQL** | Integration tests hit a real PG instance                 |
| **Real Redis**      | Integration tests hit a real Redis instance              |
| **Mocked S3**       | `@services/s3.service` is mocked globally — no AWS calls |

Integration tests require all three databases running. AWS credentials are never needed — S3 is fully mocked.

---

## Directory Structure

```
tests/
├── integration/               # Full API tests via Supertest
│   ├── auth.test.js
│   ├── auth.edge.test.js
│   ├── users.test.js
│   ├── users.edge.test.js
│   ├── chats.test.js
│   ├── chats.edge.test.js
│   ├── messages.test.js
│   ├── messages.edge.test.js
│   ├── health.test.js
│   ├── errors.test.js
│   ├── flows.test.js
│   ├── pagination.test.js
│   └── security.test.js
├── unit/                      # Isolated tests with mocked dependencies
│   ├── services/
│   │   ├── auth.service.test.js
│   │   ├── chat.service.test.js
│   │   ├── user.service.test.js
│   │   ├── message.service.test.js
│   │   └── s3.service.test.js
│   ├── middlewares/
│   │   ├── authentication.middleware.test.js
│   │   └── sanitization.middleware.test.js
│   ├── repositories/
│   ├── sockets/
│   ├── utils/
│   ├── schemas/
│   ├── config/
│   └── models/
├── helpers/
│   ├── db.helpers.js          # connectTestDB / clearTestDB / disconnectTestDB
│   └── index.js               # re-exports all helpers
├── factories/
│   ├── user.factory.js
│   ├── chat.factory.js
│   ├── message.factory.js
│   └── request.factory.js
├── fixtures/
│   └── test-avatar.jpg        # 1×1 JPEG, auto-created by beforeAll if absent
└── setup.js                   # Global mocks: logger, Socket.io, S3
```

---

## Running Tests

The default `npm test` runs Jest with `--runInBand` (single worker). With a shared local database, parallel workers can interleave HTTP requests and `clearTestDB` calls, which triggers PostgreSQL deadlocks. Serial runs are reliable; parallel runs are faster but may flake on integration tests.

```bash
# Full suite with coverage — serial (recommended)
npm test

# Full suite — parallel workers (faster; may deadlock integration)
npm run test:parallel

# Unit tests only — safe to parallelize
npm run test:unit

# Integration tests only — always serial
npm run test:integration

# Watch mode — re-runs affected tests on save
npm run test:watch

# Attach Node inspector for debugging
npm run test:debug
```

Coverage HTML report: `coverage/lcov-report/index.html`

---

## Environment Setup

Integration tests read from `.env.test`. Create this file alongside `.env`:

```env
NODE_ENV=test

MONGODB_URI=mongodb://localhost:27017/fastchat_test
POSTGRES_URI=postgresql://postgres:password@localhost:5432/fastchat_test
REDIS_URI=redis://localhost:6379

ACCESS_TOKEN_SECRET=test_access_token_secret_minimum_32_chars
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d

ALLOWED_ORIGINS=http://localhost:3000
MAX_FILE_SIZE=5242880

# envalid requires these even in test mode.
# S3 is mocked — no real AWS calls are ever made.
S3_ENABLED=false
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test_key_id
AWS_SECRET_ACCESS_KEY=test_secret_key
S3_BUCKET_NAME=test-bucket
```

Use a **separate database** (e.g. `fastchat_test`) so test runs never affect development data. Run migrations once against the test database:

```bash
POSTGRES_URI=postgresql://postgres:password@localhost:5432/fastchat_test npm run migrate:up
```

---

## Database Lifecycle

Each integration test file follows this pattern:

```js
import { connectTestDB, clearTestDB, disconnectTestDB } from '../helpers'

beforeAll(async () => {
  await connectTestDB() // Connect MongoDB, PostgreSQL, Redis
})

beforeEach(async () => {
  await clearTestDB() // TRUNCATE all PG tables (CASCADE), drop all Mongo docs, flush Redis
})

afterAll(async () => {
  await disconnectTestDB() // Close all connections
})
```

`clearTestDB` uses a PL/pgSQL block to `TRUNCATE … CASCADE` every public table, so referential integrity never prevents a clean reset.

---

## Global Mocks

Three modules are mocked for every test file via `setupFilesAfterEnv` in `tests/setup.js`:

```js
// Suppress all logger output so test output stays readable
jest.mock('@config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}))

// Prevent a real Socket.io server from spinning up in HTTP tests
jest.mock('@sockets', () => ({
  init: jest.fn(),
  io: { to: jest.fn(() => ({ emit: jest.fn() })) },
}))

// Mock all S3 operations — no real AWS calls
jest.mock('@services/s3.service', () => ({
  uploadFile: jest.fn().mockResolvedValue('https://s3.url/avatar'),
  deleteFile: jest.fn().mockResolvedValue(undefined),
}))
```

The S3 mock means:

- Avatar upload tests store the fake URL `'https://s3.url/avatar'` as the avatar value
- Avatar delete tests confirm the DB field clears without triggering a real `DeleteObjectCommand`
- Unit tests for `UserService` can assert that `s3Service.uploadFile` / `deleteFile` were called with correct arguments

The S3 service's own unit tests (`tests/unit/services/s3.service.test.js`) call `jest.unmock('@services/s3.service')` at the top of the file to opt out of the global mock and test the real implementation against a mocked `@aws-sdk/client-s3`.

---

## Test Helpers

### `createTestUser(overrides?)`

Inserts a user and profile row into PostgreSQL and issues a token pair. Returns `{ user, tokens }`.

```js
const { user, tokens } = await createTestUser()
const admin = await createTestUser({ role: 'admin' })
const withAvatar = await createTestUser({ avatar: 'https://s3.url/old-avatar' })
```

### `createTestUsers(count)`

Calls `createTestUser` in a loop and returns an array.

```js
const [user1, user2, user3] = await createTestUsers(3)
```

### `createTestChat(creator, participantIds, overrides?)`

Creates a Chat document in MongoDB. Adds the creator as a participant (and as admin for group chats).

```js
// Private chat
const chat = await createTestChat(user1.user, [user2.user.id])

// Group chat
const group = await createTestChat(user1.user, [user2.user.id, user3.user.id], {
  type: 'group',
  groupName: 'Test Group',
})
```

### `createTestMessage(chat, sender, overrides?)`

Creates a Message document in MongoDB.

```js
const msg = await createTestMessage(chat, user1.user, { content: 'Hello' })
```

### Assertion helpers

```js
// Assert success response shape
expectSuccess(response, 201, 'User created successfully')

// Assert error response shape and code
expectError(response, 400, 'VALIDATION_FAILED')

// Assert pagination fields are present and well-formed
expectPagination(response)
```

### `generateUsername()` / `generateEmail()`

Generate unique, schema-valid identifiers for each test run using `@faker-js/faker`.

---

## Writing Tests

### Integration test pattern (AAA)

```js
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

### Unit test pattern

```js
// services/user.service.test.js
jest.mock('@repositories')
jest.mock('@services/s3.service')

describe('UserService.updateAvatar', () => {
  beforeEach(() => jest.clearAllMocks())

  it('should delete old avatar before uploading new one', async () => {
    userRepository.findById.mockResolvedValue({ id: 'uuid', avatar: 'https://old.s3.url' })
    s3Service.deleteFile.mockResolvedValue(undefined)
    s3Service.uploadFile.mockResolvedValue('https://new.s3.url')
    userRepository.updateById.mockResolvedValue({ id: 'uuid', avatar: 'https://new.s3.url' })

    await userService.updateAvatar('uuid', mockFile)

    expect(s3Service.deleteFile).toHaveBeenCalledWith('https://old.s3.url')
    expect(s3Service.uploadFile).toHaveBeenCalled()
  })
})
```

### Testing S3 interactions

```js
const s3Service = require('@services/s3.service')

it('should upload new avatar and delete old one', async () => {
  const { user, tokens } = await createTestUser({ avatar: 'https://old.s3.url/avatar' })

  await request(app)
    .post('/api/v1/users/me/avatar')
    .set('Authorization', `Bearer ${tokens.accessToken}`)
    .attach('avatar', testImagePath)

  expect(s3Service.deleteFile).toHaveBeenCalledWith('https://old.s3.url/avatar')
  expect(s3Service.uploadFile).toHaveBeenCalled()
})
```

### Testing error cases

```js
it('should return 401 for an expired token', async () => {
  const jwt = require('jsonwebtoken')
  const { env } = require('@config')
  const expired = jwt.sign({ id: 'x' }, env.ACCESS_TOKEN_SECRET, { expiresIn: '-1h' })

  const response = await request(app)
    .get('/api/v1/users/me')
    .set('Authorization', `Bearer ${expired}`)

  expectError(response, 401, 'TOKEN_EXPIRED')
})
```

### Test naming convention

```
should <expected result> [when <condition>]
```

Examples:

- `should return 409 for duplicate email`
- `should delete chat when last member leaves`
- `should throw AuthenticationError when token is expired`

### Test isolation

- Every test is fully independent. Never rely on state created by a previous test.
- Use `beforeEach` to reset the database in integration tests.
- Use `jest.clearAllMocks()` in `beforeEach` for unit tests.

---

## Coverage Requirements

Minimum thresholds enforced in `jest.config.js` (build fails if not met):

| Metric     | Threshold |
| ---------- | --------- |
| Branches   | 85%       |
| Functions  | 90%       |
| Lines      | 90%       |
| Statements | 90%       |

Target coverage by layer:

| Layer        | Target                              |
| ------------ | ----------------------------------- |
| Controllers  | ~90% (covered by integration tests) |
| Services     | ~85% (unit + integration)           |
| Repositories | ~75% (integration)                  |
| Utilities    | ~95% (pure functions)               |
| Middlewares  | ~85% (unit + integration)           |

---

## Git Hook

The `.husky/pre-commit` hook runs `npm run test:sequential` followed by `lint-staged` before every commit. A failing test blocks the commit. This ensures no broken code reaches the repository.

---

## Debugging

```bash
# Run a single test file
npm test -- tests/integration/auth.test.js

# Run tests matching a name pattern
npm test -- -t "should create a new user"

# Attach Node inspector
npm run test:debug
```

Focus or skip individual tests:

```js
it.only('run just this one', async () => { … })
it.skip('skip for now', async () => { … })
```

---

## Further Reading

- [Jest documentation](https://jestjs.io/docs/getting-started)
- [Supertest](https://github.com/ladjs/supertest)
- [Architecture Overview](ARCHITECTURE.md) — understand what each layer does before testing it
- [REST API Reference](API_REST.md) — endpoint contracts that integration tests verify
