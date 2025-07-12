/**
 * GitLabTaskProcessor
 *
 * Main processor for GitLab-related tasks in the crawler system.
 *
 * Responsibilities:
 * - Area discovery (groups/projects)
 * - Generic data collection (issues, commits, etc.)
 * - Progress reporting via callback (for socket compatibility)
 * - Endpoint normalization and parameter validation
 * - Pagination, error handling, and data anonymization
 *
 * This class is designed for extensibility and robust error handling.
 */

import type { Task, TaskResumeState, TaskUpdate, UpdateType } from '../types/task';
import { 
  GitLabTaskType, 
  GitLabRestEndpoints, 
  GitLabEntityTypes, 
  crawlCommandToTaskType,
  requiresPathParameters,
  getRequiredParameters
} from '../types/gitlab-task-unified';
import { Anonymizer } from '../utils/anonymizer';
import { LookupDatabase } from '../utils/lookup-db';
import { DataStorage } from '../storage/data-storage';
import { getLogger } from '../utils/logging';

const logger = getLogger(["gitlab-processor"]);
const diagLogger = getLogger(["gitlab-processor", "DIAG"]);

export interface GitLabProcessorOptions {
  anonymizer: Anonymizer;
  lookupDb: LookupDatabase;
  dataStorage: DataStorage;
}

export interface ProcessingResult {
  success: boolean;
  itemsCollected?: Record<string, number>;
  error?: string;
  stackTrace?: string;
  fullError?: any;
}

/**
 * Processes GitLab tasks, manages dependencies, and maintains state for the current task.
 */
export class GitLabTaskProcessor {
  private anonymizer: Anonymizer;
  private lookupDb: LookupDatabase;
  private dataStorage: DataStorage;
  private currentTask: Task | null = null;
  private progressCallback?: (progress: any) => void;
  private allAreas: any[] = [];

  /**
   * Construct a new GitLabTaskProcessor.
   * @param options - Required dependencies for anonymization, lookup, and storage
   */
  constructor(options: GitLabProcessorOptions) {
    this.anonymizer = options.anonymizer;
    this.lookupDb = options.lookupDb;
    this.dataStorage = options.dataStorage;
    this.allAreas = [];
  }

  /**
   * Normalize GitLab API endpoint to base URL for REST API calls.
   * Removes /api/graphql or /api/v4 suffixes if present and ensures proper base URL.
   * Handles malformed URLs gracefully.
   *
   * @param apiEndpoint - The raw API endpoint string (may include suffixes)
   * @returns The normalized base URL as a string
   */
  private normalizeApiEndpoint(apiEndpoint: string): string {
    try {
      const url = new URL(apiEndpoint);
      // Remove /api/graphql suffix if present
      if (url.pathname.endsWith('/api/graphql')) {
        url.pathname = url.pathname.replace('/api/graphql', '');
      }
      // Remove any /api/* suffixes to get clean base URL
      url.pathname = url.pathname.replace(/\/api\/.*$/, '');
      // Ensure no trailing slash
      return url.toString().replace(/\/$/, '');
    } catch (error) {
      logger.warn(`Failed to parse API endpoint URL: ${apiEndpoint}, using as-is`);
      // Fallback: remove known problematic suffixes
      return apiEndpoint
        .replace(/\/api\/graphql$/, '')
        .replace(/\/api\/v4.*$/, '')
        .replace(/\/$/, '');
    }
  }

  /**
   * Process a GitLab task with progress callback.
   * Handles both area discovery and generic data collection tasks.
   *
   * @param task - Task to process (must conform to Task interface)
   * @param progressCallback - Callback for progress updates (receives progress object)
   * @param socket - Optional socket for jobs_discovered emission (legacy support)
   * @returns ProcessingResult indicating success, collected items, and error info if any
   */
  public async processTask(
    task: Task,
    progressCallback: (progress: any) => void,
    socket?: { emit: (event: string, data: any) => void }
  ): Promise<ProcessingResult> {
    logger.info(`Processing GitLab task: ${task.id} of type ${task.type}`);
    
    // Store current task and progress callback
    this.currentTask = task;
    this.progressCallback = progressCallback;
    
    try {
      // Send initial progress
      this.sendProgress({
        stage: 'discovering',
        processedItems: 0,
        message: `Starting ${task.type} task`
      });
      
      // Task type dispatch
      if (task.type === GitLabTaskType.DISCOVER_AREAS || task.type === 'discover_areas') {
        // Area discovery logic
        // @ts-expect-error: Allow passing socket for jobs_discovered emission
        const result = await this.processDiscoverAreas(task, socket);
        return { success: true, itemsCollected: result };
      } else if (task.type === GitLabTaskType.TEST_TYPE || task.type === 'test_type') {
        // Special case for tests
        this.sendProgress({
          stage: 'fetching',
          processedItems: 1,
          message: 'Processing test task'
        });
        
        // Store some test data
        await this.dataStorage.storeData('test-path', 'test-type', [{ id: 1, name: 'Test' }]);
        
        return { success: true, itemsCollected: { test: 1 } };
      } else {
        // Try to convert string task type to GitLabTaskType enum
        const mappedTaskType = crawlCommandToTaskType(task.type);
        if (mappedTaskType) {
          const result = await this.processGenericTask(task, mappedTaskType);
          return { success: true, itemsCollected: result };
        } else {
          throw new Error(`Unknown task type: ${task.type}`);
        }
      }
    } catch (error) {
      logger.error(`Error processing task ${task.id}:`, { error });
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      const stackTrace = error instanceof Error ? error.stack : undefined;
      
      // Enhanced progress callback with full error details
      this.sendProgress({
        stage: 'failed',
        error: errorMessage,
        message: `Task failed: ${errorMessage}`,
        stackTrace,
        fullError: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
          cause: error.cause
        } : { error: String(error) }
      });
      
      return {
        success: false,
        error: errorMessage,
        stackTrace,
        fullError: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
          cause: error.cause
        } : { error: String(error) }
      };
    }
  }

  /**
   * Convert TaskUpdate to progress format expected by SimplifiedJobProcessor and invoke callback.
   */
  private handleProgressUpdate(update: TaskUpdate): void {
    if (this.progressCallback) {
      const progress = {
        stage: update.type === 'completion' ? 'completed' : 'fetching',
        processedItems: update.data?.processedItems || 0,
        totalItems: update.data?.totalItems,
        message: update.data?.message,
        resumeState: update.data?.resumeState
      };
      this.progressCallback(progress);
    }
  }

  /**
   * Send progress update to callback.
   */
  private sendProgress(progress: any): void {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }

  /**
   * Discover all accessible areas (groups and projects) for the given task.
   * Stores discovered areas and emits jobs_discovered messages via callback.
   *
   * @param task - Task object for area discovery (must include apiEndpoint)
   * @returns Record with area counts (groups, projects)
   */
  private async processDiscoverAreas(task: Task): Promise<Record<string, number>> {
    logger.info(`🔍 Starting area discovery for task ${task.id}`);
    
    this.allAreas = []; // Clear the array for each new discovery task
    let discovery_summary: any = {}; // Initialize discovery_summary here

    // Fetch groups
    try {
      logger.info(`📡 Fetching groups for task ${task.id}`);
      const baseUrl = this.normalizeApiEndpoint(task.apiEndpoint);
      const groupsUrl = `${baseUrl}/api/v4/groups`;
      
      const groups = await this.fetchWithPagination(groupsUrl, this.getCurrentToken(), {
          all_available: true,
          order_by: 'path'
        });
        logger.info(`✅ Fetched ${groups.length} groups`);
        logger.debug(`[GitLabProcessor] Fetched groups:`, { groups });
        
        // Process groups
        for (let i = 0; i < groups.length; i++) {
          const group = groups[i];
          logger.debug(`[GitLabProcessor] Processing group object before push:`, group);
          const newGroupArea = {
            id: group.id,
            name: group.name,
            path: group.full_path,
            type: 'group'
          };
          logger.debug(`[GitLabProcessor] Attempting to push group area:`, newGroupArea);
          this.allAreas.push(newGroupArea);
          logger.debug(`[GitLabProcessor] allAreas after group push:`, { allAreas: this.allAreas });
          diagLogger.info(`[DIAG] Group area pushed: ${JSON.stringify(newGroupArea)}`);
          diagLogger.info(`[DIAG] allAreas after group push: ${JSON.stringify(this.allAreas)}`);
        }

      // Fetch projects for each group
      const allProjects: any[] = [];
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const groupProjects = await this.fetchWithPagination(
          `${baseUrl}/api/v4/groups/${group.id}/projects`,
          this.getCurrentToken()
        );
        allProjects.push(...groupProjects);
      }
      
      // Fetch standalone projects
      const baseUrl2 = this.normalizeApiEndpoint(task.apiEndpoint);
      const standaloneProjects = await this.fetchWithPagination(
        `${baseUrl2}/api/v4/projects`,
        this.getCurrentToken()
      );
      
      logger.info(`✅ Fetched ${standaloneProjects.length} standalone projects`);
      
      // Combine all projects and filter out duplicates
      const uniqueProjects = standaloneProjects.filter(project => 
        !allProjects.some(gp => gp.id === project.id)
      );
      allProjects.push(...uniqueProjects);

      // Store areas (groups and projects)
      for (let i = 0; i < allProjects.length; i++) {
        const project = allProjects[i];
        if (!this.allAreas.some(area => area.type === 'project' && area.id === project.id)) {
          logger.debug(`Processing project object before push:`, project);
          const projectArea = {
            id: project.id,
            name: project.name,
            path: project.path_with_namespace,
            type: 'project',
            parentId: project.namespace?.id,
            parentPath: project.namespace?.full_path
          };
          logger.debug(`Attempting to push project area:`, projectArea);
          this.allAreas.push(projectArea);
          logger.debug(`allAreas after project push:`, { allAreas: this.allAreas });
          diagLogger.info(`[DIAG] Project area pushed: ${JSON.stringify(projectArea)}`);
          diagLogger.info(`[DIAG] allAreas after project push: ${JSON.stringify(this.allAreas)}`);
        }
      }

      await this.dataStorage.storeData('areas', 'areas', this.allAreas);

      // Emit jobs_discovered message via progressCallback if available
      if (this.progressCallback) {
        logger.debug(`[GitLabProcessor] allAreas array right before map for discovered_jobs:`, { allAreas: this.allAreas });
        diagLogger.info(`[DIAG] Final allAreas before discovered_jobs mapping: ${JSON.stringify(this.allAreas)}`);
        // Map areas to DiscoveredJob format, filtering out invalid areas
        const discovered_jobs = this.allAreas
          .filter(area => area && area.id && area.name && area.path)
          .map(area => {
            logger.debug(`[GitLabProcessor] Mapping area:`, area);
            const job = {
              job_type:
                area.type === 'group'
                  ? 'crawl_group'
                  : area.type === 'project'
                  ? 'crawl_project'
                  : 'discover_namespaces',
              entity_id: area.id?.toString?.() ?? '',
              namespace_path: area.path ?? '',
              entity_name: area.name ?? '',
              priority: 1
            };
            logger.debug(`[GitLabProcessor] Mapped job:`, job);
            return job;
          });

        logger.debug(`[GitLabProcessor] Final discovered_jobs array before sending:`, { discovered_jobs });
        logger.debug(`[GitLabProcessor] Final discovery_summary before sending:`, discovery_summary);

        // Compose discovery summary
        logger.debug(`[GitLabProcessor] Composing discovery_summary. allAreas:`, { allAreas: this.allAreas });
        logger.debug(`[GitLabProcessor] Composing discovery_summary. allAreas:`, { allAreas: this.allAreas });
        discovery_summary = {
          total_groups: this.allAreas.filter(a => a.type === 'group').length,
          total_projects: this.allAreas.filter(a => a.type === 'project').length
        };
        logger.debug(`[GitLabProcessor] Composed discovery_summary:`, discovery_summary);
        logger.debug(`[GitLabProcessor] Composed discovery_summary:`, discovery_summary);

        const jobsDiscoveredMessage = {
          type: 'jobs_discovered',
          timestamp: new Date().toISOString(),
          jobId: task.id,
          data: {
            discovered_jobs,
            discovery_summary
          }
        };
diagLogger.info(`[DIAG] Emitting jobs_discovered message (JSON): ${JSON.stringify(jobsDiscoveredMessage)}`);
        logger.debug(`[GitLabProcessor] Emitting jobs_discovered message:`, jobsDiscoveredMessage);
        this.progressCallback(jobsDiscoveredMessage);
      }

      // Send progress update
      this.sendProgress({
        stage: 'completed',
        processedItems: this.allAreas.length,
        message: `Discovered ${this.allAreas.length} areas`,
        itemCounts: {
          groups: this.allAreas.filter(a => a.type === 'group').length,
          projects: this.allAreas.filter(a => a.type === 'project').length,
          total: this.allAreas.length
        }
      });
      
      return { areas: this.allAreas.length };
    } catch (error) {
      logger.error(`Error discovering areas:`, { error });
      throw error;
    }
  }

  /**
   * Process a generic task
   */
  /**
   * Process a generic GitLab data collection task (e.g., issues, commits).
   * Handles endpoint resolution, parameter checks, pagination, anonymization, and storage.
   *
   * @param task - Task object for data collection
   * @param taskType - The GitLabTaskType enum value for this task
   * @returns Record with entity type and item count
   */
  private async processGenericTask(task: Task, taskType: GitLabTaskType): Promise<Record<string, number>> {
    logger.info(`Processing ${taskType} for task ${task.id}`);
    
    const endpoints = GitLabRestEndpoints[taskType];
    const entityType = GitLabEntityTypes[taskType];
    const originPath = this.getOriginPathFromTask(task, taskType);
    
    // Check if this task type requires path parameters that we don't have
    const requiredParams = getRequiredParameters(taskType);
    const missingParams = this.checkMissingParameters(requiredParams, task.options || {});
    
    if (missingParams.length > 0) {
      const warningMessage = `Cannot process ${taskType} task: missing required parameters [${missingParams.join(', ')}]`;
      logger.warn(`⚠️ ${warningMessage}`);
      
      this.sendProgress({
        stage: 'completed',
        processedItems: 0,
        message: warningMessage
      });
      
      return { [entityType]: 0 };
    }
    
    const allItems: any[] = [];
    
    // Process each endpoint for the task type
    for (const endpoint of endpoints) {
      try {
        // Replace path parameters
        const resolvedEndpoint = this.replacePathParameters(endpoint, task.options || {});
        
        // Fetch data with pagination
        const baseUrl3 = this.normalizeApiEndpoint(task.apiEndpoint);
        const items = await this.fetchWithPagination(
          `${baseUrl3}${resolvedEndpoint}`,
          this.getCurrentToken()
        );
        
        // Anonymize items
        const anonymizedItems = await Promise.all(
          items.map(item => this.anonymizer.anonymizeObject(item))
        );
        
        // Add to collection
        allItems.push(...anonymizedItems);
        
        // Send progress update
        this.sendProgress({
          stage: 'fetching',
          processedItems: allItems.length,
          message: `Processed ${allItems.length} ${entityType}`
        });
      } catch (error) {
        logger.error(`Failed to process endpoint ${endpoint}:`, { error });
        // Continue with other endpoints instead of failing completely
      }
    }
    
    // Store data
    await this.dataStorage.storeData(originPath, entityType, allItems);
    
    // Send final progress
    this.sendProgress({
      stage: 'completed',
      processedItems: allItems.length,
      message: `Completed ${entityType} collection`
    });
    
    return { [entityType]: allItems.length };
  }

  /**
   * Fetch data with pagination using native fetch
   */
  /**
   * Fetch data from a paginated GitLab API endpoint.
   * Handles rate limiting, error recovery, and malformed JSON.
   *
   * @param url - The API endpoint URL (string)
   * @param token - Bearer token for authentication
   * @param params - Query parameters for the request (optional)
   * @param perPage - Number of items per page (default: 100)
   * @returns Array of fetched items (parsed and possibly fixed)
   */
  private async fetchWithPagination(url: string, token: string, params: Record<string, string|number|boolean> = {}, perPage = 100): Promise<any[]> {
    logger.info(`📡 Starting paginated fetch for URL: ${url}`);
    
    const items: any[] = [];
    let page = this.currentTask?.resumeState?.currentPage || 1;
    let hasMore = true;
    
    while (hasMore) {
      // Add pagination parameters
      const separator = url.includes('?') ? '&' : '?';
      const urlParams = new URLSearchParams({
        ...params,
        per_page: perPage.toString(),
        page: page.toString()
      });
      const paginatedUrl = `${url}${separator}${urlParams}`;
      
      logger.debug(`📡 Making API request to: ${paginatedUrl} (page ${page})`);
      
      // Make the request
      const response = await globalThis.fetch(paginatedUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
      });
      
      logger.debug(`📡 Received response with status: ${response.status} for page ${page}`);
      
      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
        logger.info(`Rate limited, waiting for ${retryAfter} seconds`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      
      // Check for errors
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
      }
      
      // Parse response
      const rawText = await response.text();
      let data;
      try {
        // Attempt to parse as JSON directly
        data = JSON.parse(rawText);
        logger.debug(`Successfully parsed JSON directly. Data type: ${typeof data}, isArray: ${Array.isArray(data)}, length: ${Array.isArray(data) ? data.length : 'N/A'}`);
        logger.debug(`Parsed data:`, data);
      } catch (e) {
        // If direct parsing fails, attempt to fix malformed JSON
        logger.warn(`Failed to parse JSON directly, attempting to fix malformed JSON: ${rawText.substring(0, 200)}...`);
        // Basic attempt to fix malformed JSON: add missing array brackets if needed
        let fixedText = rawText.trim();
        if (!fixedText.startsWith('[') && !fixedText.endsWith(']')) {
          fixedText = `[${fixedText}]`;
        }
        // Attempt to fix unquoted keys/values (very basic, might need more robust solution)
        fixedText = fixedText.replace(/([a-zA-Z_]+):/g, '"$1":'); // Quote keys
        fixedText = fixedText.replace(/:(true|false|null|\d+)([,\}\]])/g, ':$1$2'); // Handle unquoted booleans/numbers
        fixedText = fixedText.replace(/([\{,])(\s*)([a-zA-Z_]+)(\s*):/g, '$1"$3":'); // Quote keys
        fixedText = fixedText.replace(/:\s*([a-zA-Z_]+)([,\}\]])/g, ':"$1"$2'); // Quote values

        try {
          data = JSON.parse(fixedText);
          logger.info(`Successfully parsed fixed JSON.`);
          logger.debug(`Parsed fixed data (first 200 chars): ${JSON.stringify(data).substring(0, 200)}...`);
        } catch (fixError) {
          logger.error(`Failed to parse fixed JSON: ${fixError}. Original raw text: ${rawText}`);
          if (fixError instanceof Error) {
            throw new Error(`Failed to parse API response after fixing: ${fixError.message}`);
          } else {
            throw new Error(`Failed to parse API response after fixing: ${JSON.stringify(fixError)}`);
          }
        }
      }
      logger.debug(`📊 Parsed ${Array.isArray(data) ? data.length : 1} items from page ${page}`);
      
      // Add items to collection
      let justFetched: any[] = [];
      if (Array.isArray(data)) {
        items.push(...data);
        justFetched = data;
        hasMore = data.length === perPage;
      } else {
        items.push(data);
        justFetched = [data];
        hasMore = false;
      }
      
      // Send progress update (existing reporting preserved)
      this.sendProgress({
        stage: 'fetching',
        processedItems: items.length,
        message: `Fetched ${items.length} items`,
        itemCounts: {
          [url.includes('/groups') ? 'groups' : 'projects']: items.length
        },
        page: page,
        justFetched: justFetched
      });
      
      page++;
    }
    
    logger.info(`✅ Completed pagination, total items: ${items.length}`);
    return items;
  }

  /**
   * Get current token from task
   */
  /**
   * Get the current access token for API requests.
   */
  private getCurrentToken(): string {
    return this.currentTask?.credentials?.accessToken || '';
  }

  /**
   * Replace path parameters in endpoint
   */
  /**
   * Replace path parameters in an endpoint string with values from options.
   * Throws if required parameters are missing.
   */
  private replacePathParameters(endpoint: string, options: Record<string, any>): string {
    return endpoint.replace(/:([a-zA-Z_]+)/g, (match, paramName) => {
      let paramValue = options[paramName];
      
      // Special handling for common path parameters
      if (!paramValue) {
        switch (paramName) {
          case 'id':
            paramValue = options.resourceId || options.id;
            break;
          case 'project_id':
            paramValue = options.resourceId || options.projectId || options.project_id;
            break;
          case 'group_id':
            paramValue = options.resourceId || options.groupId || options.group_id;
            break;
        }
      }
      
      if (!paramValue) {
        throw new Error(`Missing required path parameter: ${paramName}`);
      }
      
      return paramValue;
    });
  }

  /**
   * Check which required parameters are missing from options
   */
  /**
   * Check which required parameters are missing from options.
   */
  private checkMissingParameters(requiredParams: string[], options: Record<string, any>): string[] {
    const missing: string[] = [];
    
    for (const param of requiredParams) {
      let hasParam = !!options[param];
      
      if (!hasParam) {
        // Check alternative mappings
        switch (param) {
          case 'id':
            hasParam = !!(options.resourceId || options.id);
            break;
          case 'project_id':
            hasParam = !!(options.resourceId || options.projectId || options.project_id);
            break;
          case 'group_id':
            hasParam = !!(options.resourceId || options.groupId || options.group_id);
            break;
        }
      }
      
      if (!hasParam) {
        missing.push(param);
      }
    }
    
    return missing;
  }

  /**
   * Get origin path from task
   */
  /**
   * Get the origin path for data storage based on the task and type.
   */
  private getOriginPathFromTask(task: Task, taskType: GitLabTaskType): string {
    if (task.options?.fullPath) {
      return task.options.fullPath;
    }
    
    const entityType = GitLabEntityTypes[taskType];
    if (task.options?.id) {
      return `${entityType}/${task.options.id}`;
    }
    
    return entityType;
  }
}
