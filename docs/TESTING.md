# Testing Guide

Comprehensive testing documentation for fastchat application.

## Table of Contents

- [Testing Stack](#testing-stack)
- [Test Architecture](#test-architecture)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Patterns](#test-patterns)
- [Coverage Requirements](#coverage-requirements)

---

## Testing Stack

```
┌─────────────────────────────────────────────────────┐
│              Testing Infrastructure                 │
├─────────────────────────────────────────────────────┤
│ • Jest (Test Framework & Runner)                    │
│ • Supertest (HTTP Integration Testing)              │
│ • MongoDB Memory Server (In-Memory Test Database)   │
│ • Jest Mocks (Dependency Mocking)                   │
└─────────────────────────────────────────────────────┘
```

### Dependencies

- **Jest**: Test framework and runner with built-in mocking
- **Supertest**: HTTP assertion library for API testing
- **MongoDB Memory Server**: In-memory MongoDB for isolated tests
- **Jest Mocks**: For mocking dependencies in unit tests

---

## Test Architecture

### Directory Structure

```
tests/
├── unit/                # Unit tests for individual functions/logic
├── integration/         # API integration tests
├── fixtures/            # Mock data and sample payloads
├── helpers/             # Test-specific utility functions
└── setup.js             # Global test configuration and hooks
```

---

## Running Tests

### Basic Commands

```bash
# Run all tests with coverage
npm test

# Run tests in watch mode
npm run test:watch

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run integration tests in watch mode
npm run test:integration:watch

# Run tests with verbose output
npm run test:verbose

# Run tests sequentially (useful for debugging)
npm run test:sequential

# Debug tests
npm run test:debug
```

### Test Execution Flow

```
npm test
    │
    ├─ Load jest.config.js
    │
    ├─ Execute setup.js (set env vars, mock logger)
    │
    ├─ Discover test files (*.test.js)
    │
    ├─ For each test suite:
    │   │
    │   ├─ beforeAll: Connect test DB
    │   │
    │   ├─ For each test:
    │   │   ├─ beforeEach: Clear database
    │   │   ├─ Run test
    │   │   └─ afterEach: Cleanup if needed
    │   │
    │   └─ afterAll: Disconnect test DB
    │
    ├─ Generate coverage report
    │
    └─ Exit with appropriate code
```

### Performance

- Tests run in parallel by default (50% of CPU cores)
- Each worker gets isolated environment
- Typical suite runs in 30-60 seconds
- Sequential mode available for debugging

---

## Test Architecture Overview

### Two Testing Strategies

#### 1. Unit Tests

Test individual components in isolation with mocked dependencies.

```javascript
// Example: Service Unit Test
describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should create new user successfully', async () => {
    // Arrange
    const userData = { username: 'test', email: 'test@example.com' }
    userRepository.create.mockResolvedValue(mockUser)

    // Act
    const result = await authService.signup(userData)

    // Assert
    expect(userRepository.create).toHaveBeenCalledWith(userData)
    expect(result.username).toBe(userData.username)
  })
})
```

**Characteristics:**

- Fast execution (no real database)
- Isolated from external dependencies
- Mock repositories, services, and external APIs
- Focus on business logic correctness

#### 2. Integration Tests

Test complete API flows with real database operations.

```javascript
// Example: Integration Test
describe('POST /api/v1/auth/signup', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  it('should create a new user successfully', async () => {
    const response = await request(app).post('/api/v1/auth/signup').send({
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password@123',
    })

    expect(response.status).toBe(201)
    expect(response.body.data.user.username).toBe('testuser')
  })
})
```

**Characteristics:**

- Tests entire request-response cycle
- Uses in-memory MongoDB for speed
- Validates API contracts
- Tests middleware chain, controllers, services, and repositories

---

## Test Database Management

### MongoDB Memory Server Setup

```
┌─────────────────────────────────────────────────────┐
│           MongoDB Memory Server Setup               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. Create in-memory MongoDB instance               │
│     ↓                                               │
│  2. Connect application to test database            │
│     ↓                                               │
│  3. Run test suite                                  │
│     ↓                                               │
│  4. Clear database between tests                    │
│     ↓                                               │
│  5. Disconnect and cleanup after all tests          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Benefits:**

- Fast (runs in-memory)
- Isolated (each test suite gets fresh state)
- No external dependencies
- Automatic cleanup

---

## Mocking Strategy

### Mocking Hierarchy

```
┌─────────────────────────────────────────────────────┐
│                 Mocking Hierarchy                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Unit Tests:                                        │
│  ├─ Mock Repositories                               │
│  ├─ Mock External Services                          │
│  └─ Mock Dependencies (bcrypt, fs, etc.)            │
│                                                     │
│  Integration Tests:                                 │
│  ├─ Real Database (in-memory)                       │
│  ├─ Mock Socket.io (no WebSocket needed)            │
│  └─ Real Middleware & Controllers                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Example Mocks

```javascript
// Mock repository for unit tests
jest.mock('@repositories', () => ({
  userRepository: {
    create: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
  },
}))

// Mock Socket.io for integration tests
jest.mock('@sockets', () => ({
  socketServer: {
    get: jest.fn(() => ({
      to: jest.fn(() => ({
        emit: jest.fn(),
      })),
    })),
  },
}))

// Mock external dependencies
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}))
```

---

## Writing Tests

### Test Utilities & Factories

The project provides helper functions for creating test data:

```javascript
// Test Data Factories (helpers.js)
const createTestUser = async (overrides = {}) => {
  const userData = {
    username: generateUsername(),
    email: generateEmail(),
    password: 'Password@123',
    ...overrides,
  }

  const user = await User.create(userData)
  const tokens = generateTokens({
    id: user._id,
    username: user.username,
    role: user.role,
  })

  return { user, tokens }
}

// Usage in tests
const { user, tokens } = await createTestUser()
```

**Available Helpers:**

| Helper                                             | Description                 |
| -------------------------------------------------- | --------------------------- |
| `createTestUser(overrides)`                        | Create user with tokens     |
| `createTestUsers(count)`                           | Create multiple users       |
| `createTestChat(creator, participants, overrides)` | Create chat                 |
| `createTestMessage(chat, sender, overrides)`       | Create message              |
| `generateUsername()`                               | Generate unique username    |
| `generateEmail()`                                  | Generate unique email       |
| `expectError(response, status, code)`              | Assert error response       |
| `expectSuccess(response, status, message)`         | Assert success response     |
| `expectPagination(response)`                       | Assert pagination structure |

### Response Validation Helpers

```javascript
// Success response assertion
const expectSuccess = (response, status = 200, message = null) => {
  expect(response.status).toBe(status)
  expect(response.body.success).toBe(true)
  expect(response.body.timestamp).toBeDefined()
  if (message) {
    expect(response.body.message).toBe(message)
  }
}

// Error response assertion
const expectError = (response, status, errorCode = null) => {
  expect(response.status).toBe(status)
  expect(response.body.success).toBe(false)
  expect(response.body.error).toBeDefined()
  if (errorCode) {
    expect(response.body.error.code).toBe(errorCode)
  }
}

// Usage
expectSuccess(response, 201, 'User created successfully')
expectError(response, 400, 'VALIDATION_ERROR')
```

---

## Test Patterns

### 1. AAA Pattern (Arrange-Act-Assert)

```javascript
it('should update user profile', async () => {
  // Arrange
  const { user, tokens } = await createTestUser()
  const updateData = { newBio: 'Updated bio' }

  // Act
  const response = await request(app)
    .patch('/api/v1/users/me')
    .set('Authorization', `Bearer ${tokens.accessToken}`)
    .send(updateData)

  // Assert
  expect(response.status).toBe(200)
  expect(response.body.data.user.bio).toBe('Updated bio')
})
```

### 2. Test Naming Convention

```javascript
describe('Feature/Component', () => {
  describe('Method/Endpoint', () => {
    it('should <expected behavior> when <condition>', () => {
      // Test implementation
    })
  })
})
```

**Examples:**

- `should create a new user successfully`
- `should return 400 for invalid email format`
- `should throw AuthError when token is expired`

### 3. Error Case Testing

```javascript
describe('Error Scenarios', () => {
  it('should return 400 for invalid input', async () => {
    const response = await request(app).post('/api/v1/auth/signup').send({ username: 'ab' }) // Too short

    expectError(response, 400, 'VALIDATION_ERROR')
  })
})
```

### 4. Mocking in Unit Tests

```javascript
describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should update user successfully', async () => {
    const userId = 'user123'
    const mockUser = { _id: userId, username: 'test' }
    const updateData = { username: 'newusername' }

    userRepository.findByIdWithPassword.mockResolvedValue(mockUser)
    userRepository.findByIdAndUpdate.mockResolvedValue({
      ...mockUser,
      ...updateData,
    })

    const result = await userService.updateUser(userId, updateData)

    expect(result.username).toBe('newusername')
  })
})
```

---

## Coverage Requirements

### Minimum Thresholds

```javascript
// jest.config.js
coverageThreshold: {
  global: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70,
  },
}
```

### Coverage by Category

| Category     | Target | Description                                   |
| ------------ | ------ | --------------------------------------------- |
| Controllers  | ~90%   | High-level logic, well-tested via integration |
| Services     | ~85%   | Business logic, comprehensive unit tests      |
| Repositories | ~75%   | Data access, tested via integration           |
| Utilities    | ~95%   | Pure functions, easy to test                  |
| Middlewares  | ~85%   | Request processing, unit + integration        |

### Viewing Coverage Reports

```bash
# Generate coverage report
npm test

# View HTML report
open coverage/lcov-report/index.html

# View console summary
npm test -- --coverage
```

---

## Common Test Scenarios

### Testing Authentication

```javascript
describe('Authentication', () => {
  it('should authenticate user with valid credentials', async () => {
    const { user } = await createTestUser()

    const response = await request(app).post('/api/v1/auth/login').send({
      username: user.username,
      password: 'Password@123',
    })

    expectSuccess(response, 200, 'User logged in successfully')
    expect(response.body.data.accessToken).toBeDefined()
    expect(response.body.data.refreshToken).toBeDefined()
  })

  it('should return 401 for invalid credentials', async () => {
    const response = await request(app).post('/api/v1/auth/login').send({
      username: 'nonexistent',
      password: 'WrongPassword@123',
    })

    expectError(response, 401, 'AUTHENTICATION_ERROR')
  })
})
```

### Testing Pagination

```javascript
describe('GET /api/v1/users', () => {
  it('should paginate users correctly', async () => {
    // Create 25 users
    await createTestUsers(25)

    const response = await request(app).get('/api/v1/users').query({ page: 2, limit: 10 })

    expectSuccess(response, 200)
    expect(response.body.data.length).toBe(10)
    expect(response.body.pagination.page).toBe(2)
    expect(response.body.pagination.total).toBe(25)
    expect(response.body.pagination.hasNextPage).toBe(true)
    expect(response.body.pagination.hasPrevPage).toBe(true)
  })
})
```

### Testing Authorization

```javascript
describe('Authorization', () => {
  it('should return 403 when non-admin tries admin action', async () => {
    const [user1, user2] = await createTestUsers(2)
    const chat = await createTestChat(user1.user, [user2.user._id], {
      type: 'group',
      groupName: 'Test',
    })

    const response = await request(app)
      .patch(`/api/v1/chats/${chat._id}`)
      .set('Authorization', `Bearer ${user2.tokens.accessToken}`)
      .send({ groupName: 'Hacked' })

    expectError(response, 403, 'FORBIDDEN')
  })
})
```

### Testing File Uploads

```javascript
describe('POST /api/v1/users/me/avatar', () => {
  it('should upload avatar successfully', async () => {
    const { tokens } = await createTestUser()
    const testImagePath = path.join(__dirname, 'fixtures', 'test-avatar.jpg')

    const response = await request(app)
      .post('/api/v1/users/me/avatar')
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .attach('avatar', testImagePath)

    expectSuccess(response, 200, 'Avatar uploaded successfully')
    expect(response.body.data.user.avatar).toBeDefined()
  })
})
```

---

## Best Practices

### 1. Test Isolation

- Each test should be independent
- Use `beforeEach` to reset state
- Don't rely on test execution order

```javascript
beforeEach(async () => {
  await clearDatabase() // Fresh state for each test
})
```

### 2. Clear Test Names

```javascript
// Good
it('should return 409 for duplicate email')

// Bad
it('test signup')
```

### 3. Test One Thing

```javascript
// Good - Tests one specific behavior
it('should return 400 for missing username', async () => {
  const response = await request(app)
    .post('/api/v1/auth/signup')
    .send({ email: 'test@example.com', password: 'Pass@123' })

  expectError(response, 400, 'VALIDATION_ERROR')
})

// Bad - Tests multiple things
it('should validate all signup fields', async () => {
  // Tests username, email, password all together
})
```

### 4. Use Test Helpers

```javascript
// Good - Using helper
const { user, tokens } = await createTestUser()

// Bad - Manual creation
const user = await User.create({ ... })
const tokens = generateTokens({ ... })
await RefreshToken.create({ ... })
```

### 5. Clean Up Resources

```javascript
afterEach(async () => {
  // Clean up any resources created during test
})

afterAll(async () => {
  await disconnectTestDB()
})
```

---

## Debugging Tests

### Running Single Test

```bash
# Run specific test file
npm test -- users.test.js

# Run specific test by name
npm test -- -t "should create a new user"

# Run with Node inspector
npm run test:debug
```

### Debugging Tips

1. **Use `console.log`**: Temporarily log values during development
2. **Use `.only`**: Focus on one test

```javascript
it.only('should test this specific case', async () => {
  // Only this test will run
})
```

3. **Use `.skip`**: Skip failing tests temporarily

```javascript
it.skip('should test this later', async () => {
  // This test will be skipped
})
```

4. **Check database state**:

```javascript
it('should create user in database', async () => {
  await createTestUser()

  // Verify database state
  const users = await User.find({})
  console.log('Users in DB:', users)
  expect(users.length).toBe(1)
})
```

---

## Further Reading

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [MongoDB Memory Server](https://github.com/nodkz/mongodb-memory-server)
- [Architecture Overview](ARCHITECTURE.md)
- [API Documentation](API_REST.md)
