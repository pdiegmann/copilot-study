# Testing & Validation

**STILL WORK IN PROGRESS**

"Crawler" includes comprehensive testing to ensure reliability, correctness, and privacy compliance.

## Test Types

- **Unit Tests**: Cover anonymizer, lookup database, data storage, and core logic
- **Integration Tests**: Validate end-to-end flows (job reception, task processing, data storage)
- **Component Tests**: Test interactions between anonymizer, storage, and processor
- **Error Handling Tests**: Simulate API failures, rate limiting, and parameter errors

## Test Coverage

- Anonymization logic (full value and part hashing)
- Lookup database reversibility
- Data storage structure and file format
- Task processing for all supported task types
- Socket communication (mocked)
- Rate limiting and pagination
- Resume functionality and progress updates
- Error diagnostics and reporting

## Running Tests

```bash
# Run all tests
bun test

# Run a specific test file
bun test tests/anonymizer.test.ts

# Run with coverage
bun test --coverage
```

## Test Infrastructure

- Uses Bun's built-in test runner
- Mocks for GitLab API, socket communication, and file system
- Test data and scenarios for all critical flows

## Best Practices

- Run tests before deploying or after major changes
- Review test coverage and expand for new features
- Use integration tests to validate real-world scenarios

See [architecture.md](./architecture.md) for component responsibilities and [error-handling.md](./error-handling.md) for error simulation.