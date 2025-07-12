/**
 * GitLab Task Types and Mappings
 * 
 * Defines the task types and API endpoints for GitLab data collection
 */

import type { EntityType } from './unified-types';

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
  TEST_TYPE = 'test_type'
}

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
  [GitLabTaskType.TEST_TYPE]: []
};

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
  [GitLabTaskType.TEST_TYPE]: 'test'
};

// Map EntityType to CrawlCommandName for compatibility
export function entityTypeToCrawlCommandName(entityType: string): string {
  const mapping: Record<string, string> = {
    'groups': 'group',
    'projects': 'project',
    'group_projects': 'project',
    'users': 'user',
    'issues': 'issues',
    'merge_requests': 'mergeRequests',
    'commits': 'commits',
    'branches': 'branches',
    'pipelines': 'pipelines',
    'releases': 'releases'
  };
  
  return mapping[entityType] || entityType;
}
