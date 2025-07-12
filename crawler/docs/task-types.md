# Task Types & Mappings

Crawlz processes jobs from the web application by mapping them to internal task types, which define what data to collect from GitLab and how to process it.

## Task Type Categories

- **Discovery**
  - `DISCOVER_AREAS`: Finds accessible groups and projects.
- **Project Structure**
  - `FETCH_PROJECT_DETAILS`: Project metadata.
  - `FETCH_REPOSITORY_STRUCTURE`: Repository tree and files.
- **Code Activity**
  - `FETCH_COMMITS`: Commit history.
  - `FETCH_BRANCHES`: Branch information.
  - `FETCH_MERGE_REQUESTS`: Merge request data.
- **Issue Tracking**
  - `FETCH_ISSUES`: Issues and activity.
  - `FETCH_EPICS`: Epics.
  - `FETCH_MILESTONES`: Milestones.
- **Planning**
  - `FETCH_ITERATIONS`: Iterations/sprints.
- **CI/CD**
  - `FETCH_PIPELINES`: Pipelines.
  - `FETCH_JOBS`: CI/CD jobs.
  - `FETCH_RELEASES`: Releases.
- **Activity & Events**
  - `FETCH_EVENTS`: Activity events.
  - `FETCH_NOTES`: Comments and discussion notes.
- **Analytics**
  - `FETCH_PROJECT_ANALYTICS`: Project analytics.
  - `FETCH_GROUP_ANALYTICS`: Group analytics.

## Task Mapping Logic

Jobs received via socket are mapped to internal task types using a unified mapping system. This ensures compatibility with various command/entity formats from the web app.

### Example Mapping Functions

```typescript
// Maps web app commands to internal task types
crawlCommandToTaskType(crawlCommand: string): GitLabTaskType | null

// Maps entity types to task types
entityTypeToTaskType(entityType: string): GitLabTaskType

// Maps task types back to web app format
taskTypeToCrawlCommand(taskType: GitLabTaskType): string
```

## Task Format Example

```json
{
  "id": "unique-task-id",
  "type": "fetch_issues",
  "credentials": {
    "accessToken": "oauth2-token",
    "refreshToken": "refresh-token"
  },
  "apiEndpoint": "https://gitlab.com",
  "rateLimits": {
    "maxRequestsPerMinute": 60,
    "maxRequestsPerHour": 1000
  },
  "options": {
    "projectId": "12345"
  }
}
```

## Extending Task Types

To add a new task type:
1. Define the new type in the TypeScript enums/interfaces.
2. Add mapping logic in the unified mapping module.
3. Implement processing logic in the GitLab Task Processor.

See [architecture.md](./architecture.md) for component responsibilities.