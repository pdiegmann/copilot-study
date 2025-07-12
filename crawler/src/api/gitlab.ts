/**
 * GitLab API Client
 *
 * Provides a robust client for interacting with the GitLab API, supporting:
 * - Pagination (cursor and offset)
 * - Rate limiting (minute/hour)
 * - Token refresh via Unix socket
 * - Data discovery (groups, projects, repositories)
 * - Data anonymization and reporting
 */

import type { UnixSocketManager } from '../core/crawler-socket';
import { type Task, type TokenRefreshRequest, type TokenRefreshResponse, UpdateType } from '../types/task';
import { Anonymizer } from '../utils/anonymizer';
import { LookupDatabase } from '../utils/lookup-db';
import { getLogger } from "@logtape/logtape";
const logger = getLogger(["api"]);

// Rate limiting configuration
interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  requestDelay: number; // Minimum delay between requests in ms
}

// Pagination options
interface PaginationOptions {
  type: 'cursor' | 'offset';
  pageSize: number;
  maxPages?: number; // Optional limit to total pages fetched
}

/* ---------------------------------------------------------------------------
 * GitLabApiClient: Main API client class for GitLab integration
 * ------------------------------------------------------------------------- */
export class GitLabApiClient {
  private task: Task;
  private socketManager: UnixSocketManager;
  private anonymizer: Anonymizer;
  private lookupDb: LookupDatabase;
  private accessToken: string;
  private refreshToken?: string;
  private apiEndpoint: string;
  private rateLimits: RateLimitConfig;
  private requestsThisMinute: number = 0;
  private requestsThisHour: number = 0;
  private lastRequestTime: number = 0;
  private minuteResetTimeout?: Timer;
  private hourResetTimeout?: Timer;

  /**
   * Construct a new GitLabApiClient.
   *
   * @param task - The task context for this client
   * @param socketManager - UnixSocketManager for communication
   * @param anonymizer - Anonymizer for privacy-preserving operations
   * @param lookupDb - LookupDatabase for ID mapping
   */
  constructor(
    task: Task,
    socketManager: UnixSocketManager,
    anonymizer: Anonymizer,
    lookupDb: LookupDatabase
  ) {
    this.task = task;
    this.socketManager = socketManager;
    this.anonymizer = anonymizer;
    this.lookupDb = lookupDb;
    this.accessToken = task.credentials.accessToken;
 //    this.refreshToken = task.credentials.refreshToken;
    this.apiEndpoint = task.apiEndpoint;
    
    // Set up rate limits with defaults if not provided
    this.rateLimits = {
      maxRequestsPerMinute: task.rateLimits?.maxRequestsPerMinute || 60,
      maxRequestsPerHour: task.rateLimits?.maxRequestsPerHour || 1000,
      requestDelay: 1000 // Default 1 second between requests
    };
    
    // Set up rate limit reset timers
    this.setupRateLimitResets();
  }

  /* -------------------------------------------------------------------------
   * Rate limiting logic
   * ----------------------------------------------------------------------- */
  /**
   * Set up timers to reset rate limit counters.
   */
  private setupRateLimitResets(): void {
    // Reset minute counter every minute
    this.minuteResetTimeout = setInterval(() => {
      this.requestsThisMinute = 0;
    }, 60 * 1000);
    
    // Reset hour counter every hour
    this.hourResetTimeout = setInterval(() => {
      this.requestsThisHour = 0;
    }, 60 * 60 * 1000);
  }

  /**
   * Clean up timers and resources.
   */
  public cleanup(): void {
    if (this.minuteResetTimeout) {
      clearInterval(this.minuteResetTimeout);
    }
    if (this.hourResetTimeout) {
      clearInterval(this.hourResetTimeout);
    }
  }

  /**
   * Check if we're within rate limits and wait if necessary.
   *
   * @returns True if within limits, otherwise waits and rechecks.
   */
  private async checkRateLimits(): Promise<boolean> {
    // Check if we've exceeded rate limits
    if (this.requestsThisMinute >= this.rateLimits.maxRequestsPerMinute) {
      logger.info('Minute rate limit reached, waiting...');
      this.socketManager.sendUpdate({
        taskId: this.task.id,
        type: UpdateType.TIMEOUT,
        data: { completionPercentage: -1 }
      });
      
      // Wait until the minute counter resets
      await new Promise(resolve => {
        const timeout = setTimeout(() => {
          resolve(true);
          clearTimeout(timeout);
        }, 60 * 1000 - (Date.now() % (60 * 1000)));
      });
      
      return this.checkRateLimits(); // Recheck after waiting
    }
    
    if (this.requestsThisHour >= this.rateLimits.maxRequestsPerHour) {
      logger.info('Hour rate limit reached, waiting...');
      this.socketManager.sendUpdate({
        taskId: this.task.id,
        type: UpdateType.TIMEOUT,
        data: { completionPercentage: -1 }
      });
      
      // Wait until the hour counter resets
      await new Promise(resolve => {
        const timeout = setTimeout(() => {
          resolve(true);
          clearTimeout(timeout);
        }, 60 * 60 * 1000 - (Date.now() % (60 * 60 * 1000)));
      });
      
      return this.checkRateLimits(); // Recheck after waiting
    }
    
    // Ensure minimum delay between requests
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimits.requestDelay) {
      await new Promise(resolve => {
        setTimeout(resolve, this.rateLimits.requestDelay - timeSinceLastRequest);
      });
    }
    
    return true;
  }

  /**
   * Refresh the access token using the unix socket.
   *
   * @returns True if refresh succeeded, false otherwise.
   */
  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) {
      return false;
    }

    try {
      // Send token_refresh_request via socket
      const request: TokenRefreshRequest = {
        taskId: this.task.id,
        refreshToken: this.refreshToken
      };

      // Send the request
      this.socketManager.sendUpdate({
        type: UpdateType.TOKEN_REFRESH_REQUEST,
        taskId: this.task.id,
        data: request
      });

      // Wait for token_refresh_response for this task
      const response: TokenRefreshResponse = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for token_refresh_response'));
        }, 10000);

        const handler = (msg: any) => {
          try {
            if (
              msg &&
              msg.type === 'token_refresh_response' &&
              msg.data &&
              msg.data.taskId === this.task.id
            ) {
              clearTimeout(timeout);
              this.socketManager.offMessage(handler);
              resolve(msg.data);
            }
          } catch (e) {
            // ignore
          }
        };

        this.socketManager.onMessage(handler);
      });

      // Update tokens
      this.accessToken = response.accessToken;
      if (response.refreshToken) {
        this.refreshToken = response.refreshToken;
      }

      return true;
    } catch (error) {
      logger.error('Failed to refresh token:', { error });
      return false;
    }
  }

  /**
   * Make a request to the GitLab API with rate limiting and token refresh.
   *
   * @param path - API path (relative or absolute)
   * @param options - RequestInit options for fetch
   * @returns Parsed JSON response
   */
  private async makeRequest(path: string, options: RequestInit = {}): Promise<any> {
    // Check rate limits before making request
    await this.checkRateLimits();
    
    // Prepare URL and headers
    const url = new URL(path, this.apiEndpoint).toString();
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers
    };
    
    try {
      // Make the request
      this.lastRequestTime = Date.now();
      this.requestsThisMinute++;
      this.requestsThisHour++;
      
      const response = await fetch(url, {
        ...options,
        headers
      });
      
      // Check for rate limit headers from GitLab
      const rateLimit = {
        limit: parseInt(response.headers.get('RateLimit-Limit') || '0'),
        remaining: parseInt(response.headers.get('RateLimit-Remaining') || '0'),
        reset: parseInt(response.headers.get('RateLimit-Reset') || '0')
      };
      
      // Adjust our rate limits if needed
      if (rateLimit.limit > 0 && rateLimit.remaining > 0) {
        this.rateLimits.maxRequestsPerMinute = Math.min(
          this.rateLimits.maxRequestsPerMinute,
          rateLimit.remaining
        );
      }
      
      // Handle unauthorized (token expired)
      if (response.status === 401) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          // Retry with new token
          return this.makeRequest(path, options);
        } else {
          throw new Error('Failed to refresh token');
        }
      }
      
      // Handle other error responses
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      logger.error('API request error:', {error});
      throw error;
    }
  }

  /* -------------------------------------------------------------------------
   * Pagination logic
   * ----------------------------------------------------------------------- */
  /**
   * Fetch data with pagination, calling processPage for each page of results.
   *
   * @param path - API path to fetch
   * @param options - Pagination options (type, pageSize, maxPages)
   * @param processPage - Callback to process each page of items
   */
  public async fetchWithPagination<T>(
    path: string,
    options: PaginationOptions,
    processPage: (items: T[]) => Promise<void>
  ): Promise<void> {
    let hasMorePages = true;
    let currentPage = 1;
    let cursor: string | null = null;
    
    while (hasMorePages) {
      // Check if we've reached the max pages limit
      if (options.maxPages && currentPage > options.maxPages) {
        break;
      }
      
      // Build query parameters based on pagination type
      let queryParams: string;
      if (options.type === 'cursor' && cursor) {
        queryParams = `?per_page=${options.pageSize}&pagination=keyset&cursor=${encodeURIComponent(cursor)}`;
      } else {
        queryParams = `?per_page=${options.pageSize}&page=${currentPage}`;
      }
      
      // Make the request
      const response = await this.makeRequest(`${path}${queryParams}`);
      
      // Process the page
      if (response && Array.isArray(response)) {
        await processPage(response);

        // --- Begin job_progress reporting ---
        logger.info(`[job_progress] Sending job_progress for task ${this.task.id}, page ${currentPage}, items: ${response.length}`);
        this.socketManager.sendUpdate({
          taskId: this.task.id,
          type: UpdateType.PROGRESS,
          data: {
            page: currentPage,
            pageSize: options.pageSize,
            items: response,
            totalFetched: response.length,
            paginationType: options.type
          }
        });
        logger.info(`[job_progress] Sent job_progress for task ${this.task.id}, page ${currentPage}`);
        // --- End job_progress reporting ---

        // Check if we have more pages
        hasMorePages = response.length === options.pageSize;
        
        // Update cursor or page number
        if (options.type === 'cursor') {
          // Extract cursor from Link header or response
          cursor = response.length > 0 ? response[response.length - 1].id : null;
          if (!cursor) {
            hasMorePages = false;
          }
        } else {
          currentPage++;
        }
      } else {
        hasMorePages = false;
      }
    }
  }

  /* -------------------------------------------------------------------------
   * Data discovery methods
   * ----------------------------------------------------------------------- */
  /**
   * Discover all accessible areas (groups, projects, repositories).
   * Reports each discovered area via the socketManager.
   */
  public async discoverAreas(): Promise<void> {
    // First discover groups
    await this.fetchWithPagination<any>(
      '/api/v4/groups',
      { type: 'cursor', pageSize: 20 },
      async (groups) => {
        for (const group of groups) {
          // Report new area
          this.socketManager.sendUpdate({
            taskId: this.task.id,
            type: UpdateType.NEW_AREA,
            data: {
              newArea: {
                id: group.id.toString(),
                path: group.full_path,
                type: 'group'
              }
            }
          });
          
          // Discover projects in this group
          await this.discoverProjectsInGroup(group.id);
        }
      }
    );
    
    // Then discover projects the user has access to
    await this.fetchWithPagination<any>(
      '/api/v4/projects',
      { type: 'cursor', pageSize: 20 },
      async (projects) => {
        for (const project of projects) {
          // Report new area
          this.socketManager.sendUpdate({
            taskId: this.task.id,
            type: UpdateType.NEW_AREA,
            data: {
              newArea: {
                id: project.id.toString(),
                path: project.path_with_namespace,
                type: 'project',
                parentPath: project.namespace.full_path
              }
            }
          });
          
          // Discover repositories in this project
          await this.discoverRepositoriesInProject(project.id);
        }
      }
    );
  }

  /**
   * Discover projects in a group and report them.
   *
   * @param groupId - The group ID to fetch projects for
   */
  private async discoverProjectsInGroup(groupId: number): Promise<void> {
    await this.fetchWithPagination<any>(
      `/api/v4/groups/${groupId}/projects`,
      { type: 'cursor', pageSize: 20 },
      async (projects) => {
        for (const project of projects) {
          // Report new area
          this.socketManager.sendUpdate({
            taskId: this.task.id,
            type: UpdateType.NEW_AREA,
            data: {
              newArea: {
                id: project.id.toString(),
                path: project.path_with_namespace,
                type: 'project',
                parentPath: project.namespace.full_path
              }
            }
          });
          
          // Discover repositories in this project
          await this.discoverRepositoriesInProject(project.id);
        }
      }
    );
  }

  /**
   * Discover repositories in a project and report them.
   *
   * @param projectId - The project ID to fetch repositories for
   */
  private async discoverRepositoriesInProject(projectId: number): Promise<void> {
    // In GitLab, a project typically has one repository
    // But we can check branches, tags, etc.
    await this.fetchWithPagination<any>(
      `/api/v4/projects/${projectId}/repository/branches`,
      { type: 'cursor', pageSize: 20 },
      async (branches) => {
        if (branches.length > 0) {
          // Report new repository area
          this.socketManager.sendUpdate({
            taskId: this.task.id,
            type: UpdateType.NEW_AREA,
            data: {
              newArea: {
                id: `${projectId}-repo`,
                path: `${projectId}/repository`,
                type: 'repository',
                parentPath: `${projectId}`
              }
            }
          });
        }
      }
    );
  }

  /**
   * Fetch and anonymize data from an area (group, project, or repository).
   *
   * @param areaType - The type of area ('group', 'project', 'repository')
   * @param areaId - The ID of the area
   * @param areaPath - The path of the area
   * @returns Array of anonymized data items
   */
  public async fetchAndAnonymizeData(areaType: string, areaId: string, areaPath: string): Promise<any[]> {
    let endpoint: string;
    let dataType: string;
    
    switch (areaType) {
      case 'group':
        endpoint = `/api/v4/groups/${areaId}/members`;
        dataType = 'members';
        break;
      case 'project':
        endpoint = `/api/v4/projects/${areaId}/members`;
        dataType = 'members';
        break;
      case 'repository':
        // Extract project ID from repository ID
        const projectId = areaId.split('-')[0];
        endpoint = `/api/v4/projects/${projectId}/repository/commits`;
        dataType = 'commits';
        break;
      default:
        throw new Error(`Unknown area type: ${areaType}`);
    }
    
    const anonymizedData: any[] = [];
    
    await this.fetchWithPagination<any>(
      endpoint,
      { type: 'cursor', pageSize: 20 },
      async (items) => {
        for (const item of items) {
          // Anonymize the data
          const anonymized = this.anonymizer.anonymizeObject(item);
          
          // Store in lookup database for reversibility
          // This would be more complex in a real implementation
          // to handle all the different fields and relationships
          
          // Add to result
          anonymizedData.push(anonymized);
        }
      }
    );
    
    return anonymizedData;
  }
}
