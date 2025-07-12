# Error Handling

"Crawler" is designed for resilience and transparency, providing detailed diagnostics and robust error recovery throughout the crawling process.

## Error Types

- **Network/API Errors**: Connection issues, timeouts, invalid responses
- **Authentication Errors**: Expired or invalid tokens, handled via socket-based token refresh
- **Parameter Errors**: Missing required parameters for API endpoints
- **Rate Limiting**: Exceeded GitLab API limits, handled with adaptive backoff
- **Processing Errors**: Data parsing, validation, or storage failures

## Diagnostics

- **Detailed Logging**: All errors are logged with context (task ID, endpoint, parameters)
- **Enhanced API Error Messages**: For example, 404 errors include the full URL, project ID, and possible root causes
- **Graceful Degradation**: Tasks with missing parameters or unrecoverable errors are marked as completed with warnings, not crashes

## Example: Enhanced 404 Handling

When a 404 error occurs (e.g., project not found):

- The processor logs the full API URL and project ID
- Diagnostics check if the project exists, if issues are enabled, and if the token has access
- Actionable guidance is provided in logs for resolution

## Error Recovery Strategies

- **Retries**: Automatic retries for transient network errors
- **Token Refresh**: Automatic OAuth2 token refresh via socket protocol
- **Rate Limit Backoff**: Waits for rate limits to reset before retrying
- **Fallbacks**: Unknown or unmapped commands/entities are handled gracefully

## Reporting

- **Progress Updates**: Errors are reported back to the web application via progress or failure updates
- **Completion with Warning**: Tasks missing required parameters are completed with a warning, not a crash

## Best Practices

- Monitor logs for actionable diagnostics
- Ensure tokens and configuration are valid
- Regularly review error reports for recurring issues

See [socket-protocol.md](./socket-protocol.md) for error reporting via socket and [architecture.md](./architecture.md) for component integration.