/**
 * Unified GitLab Task Types - Consolidated from both api/gitlab-tasks.ts and types/gitlab-tasks.ts
 * 
 * This file replaces both scattered task definition files with a single, consistent source of truth.
 */

import type { EntityType } from './unified-types';

// Core task types enum - using the simpler enum approach from types/gitlab-tasks.ts
export enum GitLabTaskType {
  DISCOVER_AREAS = 'discover_areas',
  FETCH_PROJECTS = 'fetch_projects', 
  FETCH_GROUPS = 'fetch_groups',
  FETCH_USERS = 'fetch_users',
  FETCH_ISSUES = 'fetch_issues',
  FETCH_MERGE_REQUESTS = 'fetch_merge_requests',
  FETCH_COMMITS = 'fetch_commits',
  FETCH_BRANCHES = 'fetch_branches',
  FETCH_PIPELINES = 'fetch_pipelines',
  FETCH_RELEASES = 'fetch_releases',
  FETCH_MILESTONES = 'fetch_milestones',
  FETCH_EPICS = 'fetch_epics',
  FETCH_JOBS = 'fetch_jobs',
  FETCH_EVENTS = 'fetch_events',
  FETCH_ISSUE_NOTES = 'fetch_issue_notes',
  TEST_TYPE = 'test_type'
}

// REST API endpoints for each task type
export const GitLabRestEndpoints: Record<GitLabTaskType, string[]> = {
  [GitLabTaskType.DISCOVER_AREAS]: ['/api/v4/groups', '/api/v4/projects'],
  [GitLabTaskType.FETCH_PROJECTS]: ['/api/v4/projects'],
  [GitLabTaskType.FETCH_GROUPS]: ['/api/v4/groups'],
  [GitLabTaskType.FETCH_USERS]: ['/api/v4/users'],
  [GitLabTaskType.FETCH_ISSUES]: ['/api/v4/projects/:id/issues'],
  [GitLabTaskType.FETCH_MERGE_REQUESTS]: ['/api/v4/projects/:id/merge_requests'],
  [GitLabTaskType.FETCH_COMMITS]: ['/api/v4/projects/:id/repository/commits'],
  [GitLabTaskType.FETCH_BRANCHES]: ['/api/v4/projects/:id/repository/branches'],
  [GitLabTaskType.FETCH_PIPELINES]: ['/api/v4/projects/:id/pipelines'],
  [GitLabTaskType.FETCH_RELEASES]: ['/api/v4/projects/:id/releases'],
  [GitLabTaskType.FETCH_MILESTONES]: ['/api/v4/projects/:id/milestones', '/api/v4/groups/:id/milestones'],
  [GitLabTaskType.FETCH_EPICS]: ['/api/v4/groups/:id/epics'],
  [GitLabTaskType.FETCH_JOBS]: ['/api/v4/projects/:id/pipelines/:pipeline_id/jobs'],
  [GitLabTaskType.FETCH_EVENTS]: ['/api/v4/projects/:id/events', '/api/v4/groups/:id/events'],
  [GitLabTaskType.FETCH_ISSUE_NOTES]: ['/api/v4/projects/:id/issues/:issue_iid/notes'],
  [GitLabTaskType.TEST_TYPE]: []
};

// Entity types for data storage
export const GitLabEntityTypes: Record<GitLabTaskType, string> = {
  [GitLabTaskType.DISCOVER_AREAS]: 'areas',
  [GitLabTaskType.FETCH_PROJECTS]: 'projects',
  [GitLabTaskType.FETCH_GROUPS]: 'groups',
  [GitLabTaskType.FETCH_USERS]: 'users',
  [GitLabTaskType.FETCH_ISSUES]: 'issues',
  [GitLabTaskType.FETCH_MERGE_REQUESTS]: 'merge_requests',
  [GitLabTaskType.FETCH_COMMITS]: 'commits',
  [GitLabTaskType.FETCH_BRANCHES]: 'branches',
  [GitLabTaskType.FETCH_PIPELINES]: 'pipelines',
  [GitLabTaskType.FETCH_RELEASES]: 'releases',
  [GitLabTaskType.FETCH_MILESTONES]: 'milestones',
  [GitLabTaskType.FETCH_EPICS]: 'epics',
  [GitLabTaskType.FETCH_JOBS]: 'jobs',
  [GitLabTaskType.FETCH_EVENTS]: 'events',
  [GitLabTaskType.FETCH_ISSUE_NOTES]: 'issue_notes',
  [GitLabTaskType.TEST_TYPE]: 'test'
};

// Human-readable descriptions
export const GitLabTaskTypeDescriptions: Record<GitLabTaskType, string> = {
  [GitLabTaskType.DISCOVER_AREAS]: 'Discover accessible projects, groups, and repositories',
  [GitLabTaskType.FETCH_PROJECTS]: 'Fetch detailed information about projects',
  [GitLabTaskType.FETCH_GROUPS]: 'Fetch detailed information about groups',
  [GitLabTaskType.FETCH_USERS]: 'Fetch user information',
  [GitLabTaskType.FETCH_ISSUES]: 'Fetch issue data and activity',
  [GitLabTaskType.FETCH_MERGE_REQUESTS]: 'Fetch merge request data and activity',
  [GitLabTaskType.FETCH_COMMITS]: 'Fetch commit history and metadata',
  [GitLabTaskType.FETCH_BRANCHES]: 'Fetch branch information',
  [GitLabTaskType.FETCH_PIPELINES]: 'Fetch CI/CD pipeline information',
  [GitLabTaskType.FETCH_RELEASES]: 'Fetch release information',
  [GitLabTaskType.FETCH_MILESTONES]: 'Fetch milestone information',
  [GitLabTaskType.FETCH_EPICS]: 'Fetch epic data and activity',
  [GitLabTaskType.FETCH_JOBS]: 'Fetch CI/CD job information',
  [GitLabTaskType.FETCH_EVENTS]: 'Fetch activity events',
  [GitLabTaskType.FETCH_ISSUE_NOTES]: 'Fetch comments and discussion notes',
  [GitLabTaskType.TEST_TYPE]: 'TESTING ONLY'
};

/**
 * CORE MAPPING FUNCTIONS
 * These provide the critical mapping between web app commands and crawler task types
 */

/**
 * Maps web application CrawlCommand to crawler GitLabTaskType
 * This is the PRIMARY mapping function that fixes the GROUP_PROJECT_DISCOVERY issue
 */
export function crawlCommandToTaskType(crawlCommand: string): GitLabTaskType | null {
  const mapping: Record<string, GitLabTaskType> = {
    // PRIMARY FIX: GROUP_PROJECT_DISCOVERY should map to DISCOVER_AREAS, not fetch_groups
    'GROUP_PROJECT_DISCOVERY': GitLabTaskType.DISCOVER_AREAS,
    
    // Standard mappings
    'FETCH_PROJECTS': GitLabTaskType.FETCH_PROJECTS,
    'FETCH_GROUPS': GitLabTaskType.FETCH_GROUPS,
    'FETCH_USERS': GitLabTaskType.FETCH_USERS,
    'FETCH_ISSUES': GitLabTaskType.FETCH_ISSUES,
    'FETCH_MERGE_REQUESTS': GitLabTaskType.FETCH_MERGE_REQUESTS,
    'FETCH_COMMITS': GitLabTaskType.FETCH_COMMITS,
    'FETCH_BRANCHES': GitLabTaskType.FETCH_BRANCHES,
    'FETCH_PIPELINES': GitLabTaskType.FETCH_PIPELINES,
    'FETCH_RELEASES': GitLabTaskType.FETCH_RELEASES,
    'FETCH_MILESTONES': GitLabTaskType.FETCH_MILESTONES,
    'FETCH_EPICS': GitLabTaskType.FETCH_EPICS,
    'FETCH_JOBS': GitLabTaskType.FETCH_JOBS,
    'FETCH_EVENTS': GitLabTaskType.FETCH_EVENTS,
    'FETCH_ISSUE_NOTES': GitLabTaskType.FETCH_ISSUE_NOTES,
    'TEST_TYPE': GitLabTaskType.TEST_TYPE,
    
    // Alternative command formats from web app
    'branches': GitLabTaskType.FETCH_BRANCHES,
    'commits': GitLabTaskType.FETCH_COMMITS,
    'issues': GitLabTaskType.FETCH_ISSUES,
    'mergeRequests': GitLabTaskType.FETCH_MERGE_REQUESTS,
    'merge_requests': GitLabTaskType.FETCH_MERGE_REQUESTS,
    'pipelines': GitLabTaskType.FETCH_PIPELINES,
    'jobs': GitLabTaskType.FETCH_JOBS,
    'releases': GitLabTaskType.FETCH_RELEASES,
    'events': GitLabTaskType.FETCH_EVENTS,
    'projects': GitLabTaskType.FETCH_PROJECTS,
    'groups': GitLabTaskType.FETCH_GROUPS,
    'epics': GitLabTaskType.FETCH_EPICS,
    'milestones': GitLabTaskType.FETCH_MILESTONES,
    'users': GitLabTaskType.FETCH_USERS
  };
  
  return mapping[crawlCommand] || null;
}

/**
 * Maps crawler EntityType to GitLabTaskType for job processing
 * This handles the conversion from SimpleJob.entityType to task type
 */
export function entityTypeToTaskType(entityType: EntityType): GitLabTaskType {
  const mapping: Record<EntityType, GitLabTaskType> = {
    'areas': GitLabTaskType.DISCOVER_AREAS,      // FIXED: areas -> DISCOVER_AREAS (not fetch_groups)
    'project': GitLabTaskType.FETCH_PROJECTS,
    'group': GitLabTaskType.FETCH_GROUPS,
    'user': GitLabTaskType.FETCH_USERS,
    'issue': GitLabTaskType.FETCH_ISSUES,
    'merge_request': GitLabTaskType.FETCH_MERGE_REQUESTS,
    'commit': GitLabTaskType.FETCH_COMMITS,
    'branch': GitLabTaskType.FETCH_BRANCHES,
    'pipeline': GitLabTaskType.FETCH_PIPELINES,
    'release': GitLabTaskType.FETCH_RELEASES
  };
  
  return mapping[entityType] || GitLabTaskType.FETCH_PROJECTS;
}

/**
 * Maps GitLabTaskType back to CrawlCommand format for compatibility
 */
export function taskTypeToCrawlCommand(taskType: GitLabTaskType): string {
  const mapping: Record<GitLabTaskType, string> = {
    [GitLabTaskType.DISCOVER_AREAS]: 'GROUP_PROJECT_DISCOVERY',
    [GitLabTaskType.FETCH_PROJECTS]: 'FETCH_PROJECTS',
    [GitLabTaskType.FETCH_GROUPS]: 'FETCH_GROUPS',
    [GitLabTaskType.FETCH_USERS]: 'FETCH_USERS',
    [GitLabTaskType.FETCH_ISSUES]: 'FETCH_ISSUES',
    [GitLabTaskType.FETCH_MERGE_REQUESTS]: 'FETCH_MERGE_REQUESTS',
    [GitLabTaskType.FETCH_COMMITS]: 'FETCH_COMMITS',
    [GitLabTaskType.FETCH_BRANCHES]: 'FETCH_BRANCHES',
    [GitLabTaskType.FETCH_PIPELINES]: 'FETCH_PIPELINES',
    [GitLabTaskType.FETCH_RELEASES]: 'FETCH_RELEASES',
    [GitLabTaskType.FETCH_MILESTONES]: 'FETCH_MILESTONES',
    [GitLabTaskType.FETCH_EPICS]: 'FETCH_EPICS',
    [GitLabTaskType.FETCH_JOBS]: 'FETCH_JOBS',
    [GitLabTaskType.FETCH_EVENTS]: 'FETCH_EVENTS',
    [GitLabTaskType.FETCH_ISSUE_NOTES]: 'FETCH_ISSUE_NOTES',
    [GitLabTaskType.TEST_TYPE]: 'TEST_TYPE'
  };
  
  return mapping[taskType] || 'UNKNOWN';
}

/**
 * Checks if a task type requires path parameters (like project ID)
 */
export function requiresPathParameters(taskType: GitLabTaskType): boolean {
  const endpoints = GitLabRestEndpoints[taskType];
  return endpoints.some(endpoint => endpoint.includes(':'));
}

/**
 * Extracts required path parameters from a task type
 */
export function getRequiredParameters(taskType: GitLabTaskType): string[] {
  const endpoints = GitLabRestEndpoints[taskType];
  const params = new Set<string>();
  
  endpoints.forEach(endpoint => {
    const matches = endpoint.match(/:([a-zA-Z_]+)/g);
    if (matches) {
      matches.forEach(match => params.add(match.substring(1)));
    }
  });
  
  return Array.from(params);
}
