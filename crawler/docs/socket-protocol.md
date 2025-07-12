# Socket Protocol

"Crawler" uses a Unix socket for all communication with the external web application. This protocol replaces HTTP polling and enables real-time, low-latency job management and progress reporting.

## Message Types

- **JOB_REQUEST / JOB_RESPONSE**: Job fetching and assignment
- **PROGRESS_UPDATE**: Real-time progress and status updates
- **TOKEN_REFRESH_REQUEST / TOKEN_REFRESH_RESPONSE**: OAuth2 token refresh
- **HEARTBEAT**: Connection health checks
- **MESSAGE / COMMAND**: General messaging and control

## Message Format

All messages follow a consistent structure:

```json
{
  "origin": "external-crawler" | "web-server",
  "destination": "web-server" | "external-crawler",
  "type": "jobRequest" | "jobResponse" | "message" | "command" | "heartbeat",
  "key": "request_jobs" | "jobs_available" | "PROGRESS_UPDATE" | ...,
  "payload": { /* message-specific data */ },
  "timestamp": 1234567890123
}
```

## Example Flows

### Job Fetching

1. Crawler sends `JOB_REQUEST` with key `"request_jobs"`.
2. Web app responds with `JOB_RESPONSE` and key `"jobs_available"` (or `"jobs_error"`).

### Progress Updates

1. Crawler sends `PROGRESS_UPDATE` messages as tasks are processed.
2. Web app updates job status and stores progress.

### Token Refresh

1. Crawler sends `TOKEN_REFRESH_REQUEST` when access token expires.
2. Web app responds with `TOKEN_REFRESH_RESPONSE` containing new credentials.

## Benefits

- **Real-time**: Immediate job assignment and progress feedback.
- **Efficient**: Eliminates HTTP overhead and polling delays.
- **Unified**: All crawler-webapp communication uses the same protocol.

## Extending the Protocol

To add new message types or keys:
- Update the message type enums and handlers in both the crawler and web application.
- Ensure backward compatibility for existing message flows.

See [architecture.md](./architecture.md) for component responsibilities.