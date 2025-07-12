# "Crawler" GitLab Crawler

"Crawler" is a Bun-based TypeScript application for scientific and large-scale crawling of GitLab data. It receives jobs from an external web application via Unix socket, processes them with robust anonymization, and stores results in a structured, privacy-preserving format.

## Features

- Socket-based job reception and progress reporting (no HTTP polling)
- Modular, task-based architecture for independent processing
- Comprehensive GitLab API integration (REST & GraphQL)
- HMAC-based anonymization for PII (names, emails)
- Lookup database for reversible anonymization (can be fully disabled for maximum privacy; see below)
- Structured data storage (JSON Lines by origin path and item type)
- Robust error handling, rate limiting, and resume support

## Quickstart

### Requirements

- [Bun](https://bun.sh) runtime
- Node.js 18+ (for TypeScript support)

### Installation

```bash
# Install dependencies
bun install
```

### Configuration

Set environment variables as needed (defaults shown):

- `SOCKET_PATH`: Path to the Unix socket (default: `/home/bun/data/config/api.sock`)
- `DATA_DIR`: Directory for storing data (default: `/home/bun/data/archive`)
- `LOOKUP_DB_PATH`: Path to the lookup database (default: `/home/bun/data/archive/lookup.db`)
- `LOOKUP_DB_DISABLE_IO`: If set to a true-ish value (`1`, `true`, etc.), disables all lookup database storage and retention—no mapping information is stored or retained, not even in memory. All reverse lookups are disabled, maximizing privacy and data security.
  **Typical use cases:** privacy-sensitive runs, regulatory compliance, or scenarios where no mapping data must persist.
- `ANONYMIZATION_SECRET`: Secret for HMAC anonymization (default: `change-this-in-production`)

### Running

```bash
bun run src/index.ts
```

### Running with Docker

"Crawler" can be run in a containerized environment using Docker. This is the recommended way to ensure consistent dependencies and isolation.

#### Build the Docker Image

From the project root, build the image:

```bash
docker build -t crawler ./crawler
```

#### Run with Docker Compose

A `crawler` service is defined in [`docker-compose.yml`](../docker-compose.yml):

```yaml
services:
  crawler:
    build:
      context: ./crawler
    container_name: crawler
    volumes:
      - /etc/localtime:/etc/localtime:ro
      - ./data:/home/bun/data
      - ./data/config:/home/bun/data/config
      - ./crawler:/usr/src/app/
    environment:
      - LOG_LEVEL=debug
      - DEBUG=true
      - CRAWLER_MODE=socket
      - SOCKET_PATH=/home/bun/data/config/api.sock
      - CRAWLER_DATA_ROOT_DIR=/home/bun/data/archive
      - CRAWLER_ID_DATABASE_PATH=/home/bun/data/id_database.db
      - CRAWLER_MAX_CONCURRENT_TASKS=3
      - CRAWLER_IDLE_POLL_INTERVAL_SECONDS=20
      - CRAWLER_TASK_QUEUE_URL=unix:/home/bun/data/config/api.sock:/api/internal/jobs/open
      - CRAWLER_PROGRESS_API_ENDPOINT=unix:/home/bun/data/config/api.sock:/api/internal/jobs/progress
      - CRAWLER_TOKEN_REFRESH_API_ENDPOINT=unix:/home/bun/data/config/api.sock:/api/internal/refresh-token
      - CRAWLER_HASHING_SECRET_KEY=...
      - CRAWLER_HASHING_ALGORITHM=sha256
    entrypoint: ["./startup-debug.sh"]
```

To start the crawler service:

```bash
docker compose up crawler
```

#### Notes

- Data and configuration are persisted in the `./data` directory on the host.
- Environment variables control logging, socket path, concurrency, and anonymization.
- The container runs as the non-root `bun` user for security.
- For production, adjust secrets and volume paths as needed.

See [docs/configuration.md](./docs/configuration.md) for Docker environment variable details.


## Documentation

- [Architecture Overview](./docs/architecture.md)
- [Task Types & Mappings](./docs/task-types.md)
- [Socket Protocol](./docs/socket-protocol.md)
- [Anonymization & Privacy](./docs/anonymization.md)
- [Data Storage](./docs/storage.md)
- [Error Handling](./docs/error-handling.md)
- [Testing & Validation](./docs/testing.md)
- [Configuration Reference](./docs/configuration.md)

## License

MIT
