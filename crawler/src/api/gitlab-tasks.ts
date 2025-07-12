/**
 * GitLab Task Types and Mappings
 *
 * This module defines the task types, descriptions, endpoint mappings, and conversion utilities
 * for GitLab API interactions. It provides a unified interface for translating between
 * internal task/entity types and the formats expected by the web application and GitLab API.
 */

/**
 * Enum of all supported GitLab task types.
 * Used for type safety and mapping to endpoints and descriptions.
 */
export const GitLabTaskTypeEnum = {
  // Discovery tasks
  DISCOVER_AREAS: 'discover_areas',

  // Project structure tasks
  FETCH_PROJECTS: 'fetch_projects',
  FETCH_GROUPS: 'fetch_groups',

  // Code activity tasks
  FETCH_COMMITS: 'fetch_commits',
  FETCH_BRANCHES: 'fetch_branches',
  FETCH_MERGE_REQUESTS: 'fetch_merge_requests',

  // Issue tracking tasks
  FETCH_ISSUES: 'fetch_issues',
  FETCH_ISSUE_NOTES: 'fetch_issue_notes',
  FETCH_EPICS: 'fetch_epics',

  // Planning tasks
  FETCH_ITERATIONS: 'fetch_iterations',
  FETCH_MILESTONES: 'fetch_milestones',

  // CI/CD tasks
  FETCH_PIPELINES: 'fetch_pipelines',
  FETCH_JOBS: 'fetch_jobs',
  FETCH_RELEASES: 'fetch_releases',

  // Activity and events
  FETCH_EVENTS: 'fetch_events',
  FETCH_ACTIVITY: 'fetch_activity',

  // For testing
  TEST_TYPE: 'test_type'
} as const satisfies Record<string, string>;

export type GitLabTaskType = (typeof GitLabTaskTypeEnum)[keyof typeof GitLabTaskTypeEnum]

/**
 * Human-readable descriptions for each GitLab task type.
 * Used for UI display and logging.
 */
export const GitLabTaskTypeDescriptions: Record<GitLabTaskType, string> = {
  [GitLabTaskTypeEnum.DISCOVER_AREAS]: 'Discover accessible projects, groups, and repositories',
  [GitLabTaskTypeEnum.FETCH_PROJECTS]: 'Fetch detailed information about projects',
  [GitLabTaskTypeEnum.FETCH_COMMITS]: 'Fetch commit history and metadata',
  [GitLabTaskTypeEnum.FETCH_BRANCHES]: 'Fetch branch information',
  [GitLabTaskTypeEnum.FETCH_MERGE_REQUESTS]: 'Fetch merge request data and activity',
  [GitLabTaskTypeEnum.FETCH_ISSUES]: 'Fetch issue data and activity',
  [GitLabTaskTypeEnum.FETCH_EPICS]: 'Fetch epic data and activity',
  [GitLabTaskTypeEnum.FETCH_MILESTONES]: 'Fetch milestone information',
  [GitLabTaskTypeEnum.FETCH_ITERATIONS]: 'Fetch iteration/sprint data',
  [GitLabTaskTypeEnum.FETCH_PIPELINES]: 'Fetch CI/CD pipeline information',
  [GitLabTaskTypeEnum.FETCH_JOBS]: 'Fetch CI/CD job information',
  [GitLabTaskTypeEnum.FETCH_RELEASES]: 'Fetch release information',
  [GitLabTaskTypeEnum.FETCH_EVENTS]: 'Fetch activity events',
  [GitLabTaskTypeEnum.FETCH_ISSUE_NOTES]: 'Fetch comments and discussion notes',
  [GitLabTaskTypeEnum.FETCH_GROUPS]: "Fetch detailed information about groups",
  [GitLabTaskTypeEnum.FETCH_ACTIVITY]: "Fetch information about activities",
  [GitLabTaskTypeEnum.TEST_TYPE]: "TESTING ONLY"
};

/**
 * Maps each GitLab task type to its corresponding REST API endpoints.
 * Used for dynamic endpoint resolution in processors.
 */
export const GitLabRestEndpoints: Record<GitLabTaskType, string[]> = {
  [GitLabTaskTypeEnum.DISCOVER_AREAS]: [
    '/api/v4/groups',
    '/api/v4/projects'
  ],
  [GitLabTaskTypeEnum.FETCH_PROJECTS]: [
    '/api/v4/projects'
  ],
  [GitLabTaskTypeEnum.FETCH_GROUPS]: [
    '/api/v4/groups'
  ],
  [GitLabTaskTypeEnum.FETCH_COMMITS]: [
    '/api/v4/projects/:id/repository/commits'
  ],
  [GitLabTaskTypeEnum.FETCH_BRANCHES]: [
    '/api/v4/projects/:id/repository/branches'
  ],
  [GitLabTaskTypeEnum.FETCH_MERGE_REQUESTS]: [
    '/api/v4/projects/:id/merge_requests'
  ],
  [GitLabTaskTypeEnum.FETCH_ISSUES]: [
    '/api/v4/projects/:id/issues'
  ],
  [GitLabTaskTypeEnum.FETCH_ISSUE_NOTES]: [
    '/api/v4/projects/:id/issues/:issue_iid/notes'
  ],
  [GitLabTaskTypeEnum.FETCH_EPICS]: [
    '/api/v4/groups/:id/epics'
  ],
  [GitLabTaskTypeEnum.FETCH_ITERATIONS]: [
    '/api/v4/projects/:id/iterations',
    '/api/v4/groups/:id/iterations'
  ],
  [GitLabTaskTypeEnum.FETCH_MILESTONES]: [
    '/api/v4/projects/:id/milestones',
    '/api/v4/groups/:id/milestones'
  ],
  [GitLabTaskTypeEnum.FETCH_PIPELINES]: [
    '/api/v4/projects/:id/pipelines'
  ],
  [GitLabTaskTypeEnum.FETCH_JOBS]: [
    '/api/v4/projects/:id/pipelines/:pipeline_id/jobs'
  ],
  [GitLabTaskTypeEnum.FETCH_RELEASES]: [
    '/api/v4/projects/:id/releases'
  ],
  [GitLabTaskTypeEnum.FETCH_EVENTS]: [
    '/api/v4/projects/:id/events',
    '/api/v4/groups/:id/events'
  ],
  [GitLabTaskTypeEnum.FETCH_ACTIVITY]: [
    '/api/v4/projects/:id/activities',
    '/api/v4/users/:id/activities'
  ],
  [GitLabTaskTypeEnum.TEST_TYPE]: [
    '/api/v4/test'
  ]
};

/**
 * Maps each GitLab task type to its corresponding GraphQL query.
 * Used for GraphQL-based data collection (where supported).
 */
export const GitLabGraphQLQueries: Record<string, string> = {
  [GitLabTaskTypeEnum.DISCOVER_AREAS]: `
    query {
      groups {
        nodes {
          id
          fullPath
          name
          projects {
            nodes {
              id
              fullPath
              name
            }
          }
        }
      }
    }
  `,
  [GitLabTaskTypeEnum.FETCH_PROJECTS]: `
    query($fullPath: ID!) {
      project(fullPath: $fullPath) {
        id
        name
        fullPath
        description
        visibility
        createdAt
        lastActivityAt
      }
    }
  `,
  [GitLabTaskTypeEnum.FETCH_ISSUES]: `
    query($fullPath: ID!) {
      project(fullPath: $fullPath) {
        issues {
          nodes {
            id
            iid
            title
            description
            state
            createdAt
            updatedAt
            author {
              id
              name
              username
            }
            assignees {
              nodes {
                id
                name
                username
              }
            }
          }
        }
      }
    }
  `
};

/**
 * Maps each GitLab task type to its canonical entity type string.
 * Used for storage, reporting, and reverse mapping.
 */
export const GitLabEntityTypes: Record<GitLabTaskType, string> = {
  [GitLabTaskTypeEnum.DISCOVER_AREAS]: 'areas',
  [GitLabTaskTypeEnum.FETCH_PROJECTS]: 'projects',
  [GitLabTaskTypeEnum.FETCH_GROUPS]: 'groups',
  [GitLabTaskTypeEnum.FETCH_COMMITS]: 'commits',
  [GitLabTaskTypeEnum.FETCH_BRANCHES]: 'branches',
  [GitLabTaskTypeEnum.FETCH_MERGE_REQUESTS]: 'merge_requests',
  [GitLabTaskTypeEnum.FETCH_ISSUES]: 'issues',
  [GitLabTaskTypeEnum.FETCH_ISSUE_NOTES]: 'issue_notes',
  [GitLabTaskTypeEnum.FETCH_EPICS]: 'epics',
  [GitLabTaskTypeEnum.FETCH_ITERATIONS]: 'iterations',
  [GitLabTaskTypeEnum.FETCH_MILESTONES]: 'milestones',
  [GitLabTaskTypeEnum.FETCH_PIPELINES]: 'pipelines',
  [GitLabTaskTypeEnum.FETCH_JOBS]: 'jobs',
  [GitLabTaskTypeEnum.FETCH_RELEASES]: 'releases',
  [GitLabTaskTypeEnum.FETCH_EVENTS]: 'events',
  [GitLabTaskTypeEnum.FETCH_ACTIVITY]: 'activities',
  [GitLabTaskTypeEnum.TEST_TYPE]: 'test'
};

/**
 * Reverse mapping from entity types to CrawlCommandName format.
 * Converts internal entity types to the command names expected by the web application.
 * Includes plural, singular, camelCase, and snake_case variants for compatibility.
 */
export const EntityTypesToCrawlCommandName: Record<string, string> = {
  // Standard snake_case plural formats (our internal format)
  'areas': 'GROUP_PROJECT_DISCOVERY',
  'projects': 'FETCH_PROJECTS',
  'groups': 'FETCH_GROUPS',
  'commits': 'FETCH_COMMITS',
  'branches': 'FETCH_BRANCHES',
  'merge_requests': 'FETCH_MERGE_REQUESTS',
  'issues': 'FETCH_ISSUES',
  'issue_notes': 'FETCH_ISSUE_NOTES',
  'epics': 'FETCH_EPICS',
  'iterations': 'FETCH_ITERATIONS',
  'milestones': 'FETCH_MILESTONES',
  'pipelines': 'FETCH_PIPELINES',
  'jobs': 'FETCH_JOBS',
  'releases': 'FETCH_RELEASES',
  'events': 'FETCH_EVENTS',
  'activities': 'FETCH_ACTIVITY',
  'test': 'TEST_TYPE',
  
  // Server-side camelCase variants (what the server actually sends)
  'mergeRequests': 'FETCH_MERGE_REQUESTS',
  'issueNotes': 'FETCH_ISSUE_NOTES',
  
  // Server-side singular variants (what the server actually sends)
  'project': 'FETCH_PROJECTS',
  'group': 'FETCH_GROUPS',
  'commit': 'FETCH_COMMITS',
  'branch': 'FETCH_BRANCHES',
  'issue': 'FETCH_ISSUES',
  'epic': 'FETCH_EPICS',
  'iteration': 'FETCH_ITERATIONS',
  'milestone': 'FETCH_MILESTONES',
  'pipeline': 'FETCH_PIPELINES',
  'job': 'FETCH_JOBS',
  'release': 'FETCH_RELEASES',
  'event': 'FETCH_EVENTS',
  'activity': 'FETCH_ACTIVITY'
};

/**
 * Maps GitLabTaskType to CrawlCommandName format.
 * Used for direct conversion from internal task types to web app command names.
 */
export const GitLabTaskTypeToCrawlCommandName: Record<GitLabTaskType, string> = {
  [GitLabTaskTypeEnum.DISCOVER_AREAS]: 'GROUP_PROJECT_DISCOVERY',
  [GitLabTaskTypeEnum.FETCH_PROJECTS]: 'FETCH_PROJECTS',
  [GitLabTaskTypeEnum.FETCH_GROUPS]: 'FETCH_GROUPS',
  [GitLabTaskTypeEnum.FETCH_COMMITS]: 'FETCH_COMMITS',
  [GitLabTaskTypeEnum.FETCH_BRANCHES]: 'FETCH_BRANCHES',
  [GitLabTaskTypeEnum.FETCH_MERGE_REQUESTS]: 'FETCH_MERGE_REQUESTS',
  [GitLabTaskTypeEnum.FETCH_ISSUES]: 'FETCH_ISSUES',
  [GitLabTaskTypeEnum.FETCH_ISSUE_NOTES]: 'FETCH_ISSUE_NOTES',
  [GitLabTaskTypeEnum.FETCH_EPICS]: 'FETCH_EPICS',
  [GitLabTaskTypeEnum.FETCH_ITERATIONS]: 'FETCH_ITERATIONS',
  [GitLabTaskTypeEnum.FETCH_MILESTONES]: 'FETCH_MILESTONES',
  [GitLabTaskTypeEnum.FETCH_PIPELINES]: 'FETCH_PIPELINES',
  [GitLabTaskTypeEnum.FETCH_JOBS]: 'FETCH_JOBS',
  [GitLabTaskTypeEnum.FETCH_RELEASES]: 'FETCH_RELEASES',
  [GitLabTaskTypeEnum.FETCH_EVENTS]: 'FETCH_EVENTS',
  [GitLabTaskTypeEnum.FETCH_ACTIVITY]: 'FETCH_ACTIVITY',
  [GitLabTaskTypeEnum.TEST_TYPE]: 'TEST_TYPE'
};

/**
 * Reverse mapping from CrawlCommandName format to GitLabTaskType.
 * Converts web app commands to internal task types for processing.
 */
export const CrawlCommandNameToGitLabTaskType: Record<string, GitLabTaskType> = {
  'GROUP_PROJECT_DISCOVERY': GitLabTaskTypeEnum.DISCOVER_AREAS,
  'FETCH_PROJECTS': GitLabTaskTypeEnum.FETCH_PROJECTS,
  'FETCH_GROUPS': GitLabTaskTypeEnum.FETCH_GROUPS,
  'FETCH_COMMITS': GitLabTaskTypeEnum.FETCH_COMMITS,
  'FETCH_BRANCHES': GitLabTaskTypeEnum.FETCH_BRANCHES,
  'FETCH_MERGE_REQUESTS': GitLabTaskTypeEnum.FETCH_MERGE_REQUESTS,
  'FETCH_ISSUES': GitLabTaskTypeEnum.FETCH_ISSUES,
  'FETCH_ISSUE_NOTES': GitLabTaskTypeEnum.FETCH_ISSUE_NOTES,
  'FETCH_EPICS': GitLabTaskTypeEnum.FETCH_EPICS,
  'FETCH_ITERATIONS': GitLabTaskTypeEnum.FETCH_ITERATIONS,
  'FETCH_MILESTONES': GitLabTaskTypeEnum.FETCH_MILESTONES,
  'FETCH_PIPELINES': GitLabTaskTypeEnum.FETCH_PIPELINES,
  'FETCH_JOBS': GitLabTaskTypeEnum.FETCH_JOBS,
  'FETCH_RELEASES': GitLabTaskTypeEnum.FETCH_RELEASES,
  'FETCH_EVENTS': GitLabTaskTypeEnum.FETCH_EVENTS,
  'FETCH_ACTIVITY': GitLabTaskTypeEnum.FETCH_ACTIVITY,
  'TEST_TYPE': GitLabTaskTypeEnum.TEST_TYPE,
  
  // Direct command mappings (what the web app actually sends)
  'branches': GitLabTaskTypeEnum.FETCH_BRANCHES,
  'commits': GitLabTaskTypeEnum.FETCH_COMMITS,
  'issues': GitLabTaskTypeEnum.FETCH_ISSUES,
  'mergeRequests': GitLabTaskTypeEnum.FETCH_MERGE_REQUESTS,
  'merge_requests': GitLabTaskTypeEnum.FETCH_MERGE_REQUESTS,
  'pipelines': GitLabTaskTypeEnum.FETCH_PIPELINES,
  'jobs': GitLabTaskTypeEnum.FETCH_JOBS,
  'releases': GitLabTaskTypeEnum.FETCH_RELEASES,
  'events': GitLabTaskTypeEnum.FETCH_EVENTS,
  'projects': GitLabTaskTypeEnum.FETCH_PROJECTS,
  'groups': GitLabTaskTypeEnum.FETCH_GROUPS,
  'epics': GitLabTaskTypeEnum.FETCH_EPICS,
  'milestones': GitLabTaskTypeEnum.FETCH_MILESTONES,
  'iterations': GitLabTaskTypeEnum.FETCH_ITERATIONS
};

/**
 * Convert an entity type string to its corresponding CrawlCommandName.
 *
 * @param entityType - The entity type (e.g., 'pipelines', 'issues')
 * @returns The corresponding CrawlCommandName (e.g., 'FETCH_PIPELINES', 'FETCH_ISSUES')
 * @throws Error if the entity type is unknown
 */
export function entityTypeToCrawlCommandName(entityType: string): string {
  const commandName = EntityTypesToCrawlCommandName[entityType];
  if (!commandName) {
    throw new Error(`Unknown entity type: ${entityType}`);
  }
  return commandName;
}

/**
 * Convert a GitLabTaskType enum value to its corresponding CrawlCommandName.
 *
 * @param taskType - The GitLabTaskType enum value
 * @returns The corresponding CrawlCommandName (e.g., 'FETCH_PIPELINES', 'FETCH_ISSUES')
 */
export function taskTypeToCrawlCommandName(taskType: GitLabTaskType): string {
  return GitLabTaskTypeToCrawlCommandName[taskType];
}

/**
 * Convert a CrawlCommandName string to its corresponding GitLabTaskType enum value.
 *
 * @param commandName - The CrawlCommandName (e.g., 'FETCH_PIPELINES', 'FETCH_ISSUES')
 * @returns The corresponding GitLabTaskType enum value
 * @throws Error if the command name is unknown
 */
export function crawlCommandNameToTaskType(commandName: string): GitLabTaskType {
  const taskType = CrawlCommandNameToGitLabTaskType[commandName];
  if (!taskType) {
    throw new Error(`Unknown command name: ${commandName}`);
  }
  return taskType;
}
