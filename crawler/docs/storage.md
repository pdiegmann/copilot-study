# Data Storage

"Crawler" stores all crawled and anonymized data in a structured, append-only format optimized for scientific analysis and privacy.

## Storage Structure

- **Base Directory**: Configurable via `DATA_DIR` (default: `/home/bun/data/archive`)
- **Origin Path**: Subdirectories based on group/project/repository paths
- **Item Type**: Each data type (e.g., issues, commits) is stored in its own file

### Example Layout

```
data/
├── group-1/
│   ├── issues.jsonl
│   ├── merge_requests.jsonl
│   └── events.jsonl
├── group-1/project-1/
│   ├── commits.jsonl
│   ├── branches.jsonl
│   └── pipelines.jsonl
└── group-2/
    └── epics.jsonl
```

## File Format

- **JSON Lines**: Each line is a valid JSON object representing a single item (e.g., one issue, one commit)
- **Append-Only**: New data is appended, preserving historical records

## Storage API

The `DataStorage` class provides methods for:

- Initializing storage directories
- Storing data items by origin path and item type
- Reading and checking for existing data

```typescript
const dataStorage = new DataStorage({
  baseDir: process.env.DATA_DIR,
  createDirIfNotExists: true
});
await dataStorage.initialize();
await dataStorage.storeData('group-1/project-1', 'commits', [commitObj]);
```

## Best Practices

- Ensure the data directory is writable and has sufficient space
- Use the lookup database for any reversible anonymization needs
- Regularly back up the storage directory for data integrity

See [anonymization.md](./anonymization.md) for privacy details and [architecture.md](./architecture.md) for component integration.