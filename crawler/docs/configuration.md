# Configuration Reference

"Crawler" is configured via environment variables and optional parameters. This allows flexible deployment in different environments.

## Environment Variables

- **SOCKET_PATH**  
  Path to the Unix socket for job and update communication.  
  _Default_: `/home/bun/data/config/api.sock`

- **DATA_DIR**  
  Directory for storing crawled and anonymized data.  
  _Default_: `/home/bun/data/archive`

- **LOOKUP_DB_PATH**
  Path to the lookup database for reversible anonymization.
  _Default_: `/home/bun/data/archive/lookup.db`

- **LOOKUP_DB_DISABLE_IO**
  Disables all storage and retention of mapping information for the lookup database—**not even in memory**.
  When set to a true-ish value (`"1"`, `"true"`, `"yes"`), the lookup database will not read, write, or retain any mapping information at all. **All reverse lookups are disabled**, maximizing privacy and data security.
  _Typical use cases_: privacy-sensitive runs, regulatory compliance, environments with strict data minimization requirements, or testing where no mapping retention is permitted.

- **ANONYMIZATION_SECRET**
  Secret key for HMAC-based anonymization.
  _Default_: `change-this-in-production`

- **LOG_LEVEL**  
  Logging verbosity (`info`, `warn`, `error`, etc.).  
  _Default_: `info`

## Example `.env` File

```env
SOCKET_PATH=/tmp/crawler.sock
DATA_DIR=./data
LOOKUP_DB_PATH=./data/lookup.db
# When set, disables all mapping retention (not even in memory) and disables reverse lookups
LOOKUP_DB_DISABLE_IO=1
ANONYMIZATION_SECRET=super-secret-key
LOG_LEVEL=info
```

## Configuration in Code

```typescript
const CONFIG = {
  socketPath: process.env.SOCKET_PATH || '/home/bun/data/config/api.sock',
  dataDir: process.env.DATA_DIR || '/home/bun/data/archive',
  lookupDbPath: process.env.LOOKUP_DB_PATH || '/home/bun/data/archive/lookup.db',
  // If true, disables all mapping retention (not even in memory) and disables reverse lookups
  lookupDbDisableIO: !!process.env.LOOKUP_DB_DISABLE_IO,
  anonymizationSecret: process.env.ANONYMIZATION_SECRET || 'change-this-in-production',
  consoleLogLevel: process.env.LOG_LEVEL || 'info'
};
```

## Best Practices

- Always set a strong `ANONYMIZATION_SECRET` in production.
- Ensure the data and lookup DB directories are writable.
- Adjust `LOG_LEVEL` for debugging or production as needed.

---

## Docker Deployment

"Crawler" is fully containerized and can be run as a Docker service. The recommended way is via Docker Compose.

### Docker Environment Variables

When running in Docker, the following environment variables are commonly set in the `crawler` service:

- `LOG_LEVEL`: Logging verbosity (e.g., `debug`, `info`)
- `DEBUG`: Enables debug mode if set to `true`
- `CRAWLER_MODE`: Set to `socket` for socket-based job reception
- `SOCKET_PATH`: Path to the Unix socket for job communication (default: `/home/bun/data/config/api.sock`)
- `CRAWLER_DATA_ROOT_DIR`: Directory for storing crawled data (default: `/home/bun/data/archive`)
- `CRAWLER_ID_DATABASE_PATH`: Path to the ID database (default: `/home/bun/data/id_database.db`)
- `CRAWLER_MAX_CONCURRENT_TASKS`: Maximum number of concurrent tasks (default: `3`)
- `CRAWLER_IDLE_POLL_INTERVAL_SECONDS`: Idle poll interval in seconds (default: `20`)
- `CRAWLER_TASK_QUEUE_URL`, `CRAWLER_PROGRESS_API_ENDPOINT`, `CRAWLER_TOKEN_REFRESH_API_ENDPOINT`: Internal API endpoints, typically using the Unix socket
- `CRAWLER_HASHING_SECRET_KEY`, `CRAWLER_HASHING_ALGORITHM`: Anonymization settings

### Docker Volumes

- `/etc/localtime:/etc/localtime:ro`: Synchronizes container time with the host
- `./data:/home/bun/data`: Persists logs, archive, and config outside the container
- `./data/config:/home/bun/data/config`: Ensures configuration is available and persistent
- `./crawler:/usr/src/app/`: Mounts the source code for development or live reload

### Running

See the [README.md](../README.md) for step-by-step Docker Compose instructions.
