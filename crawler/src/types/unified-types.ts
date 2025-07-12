/**
 * Unified Types for Simplified Socket Communication System
 * 
 * Copy of backend unified types to ensure perfect compatibility
 * between crawler and backend systems.
 */

// Copy the EXACT same content from backend unified-types.ts
export interface TokenRefreshResponseData {
  accessToken: string;
  refreshSuccessful: boolean;
  expiresAt: string;
}

export interface SocketMessage {
  type: MessageType;
  timestamp: string;
  jobId?: string;
  data: 
    | any // Fallback for other message types
    | TokenRefreshResponseData;
}

export type MessageType =
  | 'heartbeat'
  | 'job_request'
  | 'job_response'
  | 'job_started'
  | 'job_progress'
  | 'job_completed'
  | 'job_failed'
  | 'discovery'
  | 'jobs_discovered'
  | 'token_refresh_request'
  | 'token_refresh_response';

export type EntityType = 
  | 'areas'      // Special type for GROUP_PROJECT_DISCOVERY (discovers both groups and projects)
  | 'project'
  | 'group'
  | 'user'
  | 'issue'
  | 'merge_request'
  | 'commit'
  | 'branch'
  | 'pipeline'
  | 'release';

export interface JobProgress {
  stage: 'discovering' | 'fetching' | 'completed' | 'failed';
  entityCounts: Record<string, {
    discovered: number;
    processed: number;
    total?: number;
  }>;
  resumeState?: {
    lastEntityId?: string;
    currentPage?: number;
    entityType?: string;
  };
  message?: string;
  error?: string;
  startTime?: string;
  endTime?: string;
}

export interface SimpleJob {
  id: string;
  entityType: EntityType;
  entityId: string;
  gitlabUrl: string;
  accessToken: string;
  resumeState?: JobProgress['resumeState'];
}

export interface HeartbeatData {
  activeJobs: number;
  totalProcessed: number;
  systemStatus: 'idle' | 'discovering' | 'processing' | 'error';
  memoryUsage?: any;
  uptime?: number;
}

export interface ProgressData {
  stage: JobProgress['stage'];
  entityType: EntityType;
  processed: number;
  total?: number;
  message?: string;
  resumeState?: JobProgress['resumeState'];
  // Enhanced progress data
  itemCounts?: Record<string, number>;
  currentPage?: number;
  processingRate?: number;
  estimatedTimeRemaining?: number;
}

export interface CompletionData {
  success: boolean;
  finalCounts: Record<string, number>;
  message?: string;
  outputFiles?: string[];
}

export interface FailureData {
  error: string;
  errorType?: string;
  isRecoverable: boolean;
  resumeState?: JobProgress['resumeState'];
  partialCounts?: Record<string, number>;
  stackTrace?: string;
  context?: Record<string, any>;
}

export interface DiscoveryData {
  entityType: EntityType;
  entities: Array<{
    id: string;
    name: string;
    path: string;
    parentId?: string;
  }>;
}
