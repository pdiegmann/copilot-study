/**
 * Task Types for GitLabTaskProcessor Compatibility
 * 
 * These types bridge the gap between the simplified socket system
 * and the existing GitLabTaskProcessor implementation.
 */

import type { EntityType } from './unified-types';

export interface Task {
  id: string;
  type: string;
  apiEndpoint: string;
  credentials: {
    accessToken: string;
  };
  options?: {
    resourceType?: EntityType;
    resourceId?: string;
    fullPath?: string;
    [key: string]: any;
  };
  rateLimits?: {
    maxRequestsPerMinute?: number;
    maxRequestsPerHour?: number;
  };
  resumeState?: TaskResumeState;
}

export interface TaskResumeState {
  currentPage?: number;
  lastProcessedId?: string;
  lastProcessedPage?: number;
  resourceType?: string;
  processedItems?: number;
  url?: string;
  hasMore?: boolean;
}

export enum UpdateType {
  HEARTBEAT = 'heartbeat',
  PROGRESS = 'progress',
  COMPLETION = 'completion',
  FAILURE = 'failure',
  NEW_AREA = 'new_area',
  TIMEOUT = 'timeout',
  TOKEN_REFRESH_REQUEST = 'token_refresh_request'
}

export interface TaskUpdate {
  taskId: string;
  type: UpdateType;
  data?: any;
  error?: string;
}

export interface TokenRefreshRequest {
  taskId: string;
  refreshToken: string;
}

export interface TokenRefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

