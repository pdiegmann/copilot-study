# Architecture Overview

"Crawler" is a modular GitLab crawler designed for scientific data collection, privacy, and reliability. It is built with Bun and TypeScript, and communicates with an external web application via Unix socket.

## Core Components

- **Socket Manager**: Handles all communication with the web application (job polling, progress updates, token refresh).
- **Job Processor**: Receives jobs from the socket, converts them to tasks, and manages their lifecycle.
- **GitLab Task Processor**: Executes tasks by interacting with the GitLab API, handling pagination, rate limiting, and error recovery.
- **Anonymizer**: Applies HMAC-based anonymization to PII fields (names, emails) with support for reversible lookup.
- **Lookup Database**: Stores mappings between original and anonymized values for reversibility.
- **Data Storage**: Persists crawled and anonymized data as JSON Lines, organized by origin path and item type.

## Data Flow

1. **Job Reception**: Jobs are received from the web application via Unix socket.
2. **Task Processing**: Each job is converted to one or more tasks, which are processed independently.
3. **API Crawling**: The GitLab Task Processor fetches data from GitLab, handling pagination and rate limits.
4. **Anonymization**: All PII is anonymized before storage.
5. **Data Storage**: Results are stored in a structured, append-only format.
6. **Progress Updates**: Real-time progress and status updates are sent back to the web application via socket.

## Directory Structure

```
crawler/
├── src/
│   ├── api/          # GitLab API integration and processors
│   ├── core/         # Socket manager and job processor
│   ├── storage/      # Data storage logic
│   ├── types/        # TypeScript type definitions and mappings
│   ├── utils/        # Anonymizer, lookup-db, logging
│   └── index.ts      # Application entry point
├── docs/             # Documentation
└── README.md         # High-level overview
```

## Design Principles

- **Modularity**: Each component is independently testable and replaceable.
- **Privacy by Design**: All sensitive data is anonymized before storage.
- **Resilience**: Robust error handling, resume support, and real-time feedback.
- **Extensibility**: Easy to add new task types, endpoints, or anonymization strategies.

For details on each component, see the other documentation files in this directory.