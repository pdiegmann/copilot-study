import { SimplifiedSocketClient } from './simplified-socket';
import { GitLabTaskProcessor } from '../api/gitlab-processor';
import { getLogger } from '../utils/logging';
import type { Task } from '../types/task';
import type { 
  SimpleJob, 
  EntityType, 
  ProgressData,
  FailureData,
} from '../types/unified-types';
import { crawlCommandToTaskType, entityTypeToTaskType } from '../types/gitlab-task-unified';

/**
 * SimplifiedJobProcessor
 *
 * Orchestrates job processing for the GitLab Crawler using a socket-based job queue.
 *
 * Responsibilities:
 * - Polls for jobs from the socket server
 * - Converts jobs to internal Task format
 * - Reports progress and completion
 * - Handles errors and token refresh logic
 * - Integrates with the GitLabTaskProcessor for execution
 */

/**
 * Main class for orchestrating job processing via a socket-based queue.
 * Handles job polling, conversion, progress reporting, error handling, and integration with GitLabTaskProcessor.
 */
export class SimplifiedJobProcessor {
  private socketClient: SimplifiedSocketClient;
  private gitlabProcessor: GitLabTaskProcessor;
  private logger = getLogger(['simplified-processor']);
  private activeJobs = new Map<string, SimpleJob>();
  private pollingTimer: Timer | null = null;
  private isProcessing = false;

  /**
   * Construct a new SimplifiedJobProcessor and set up socket event handlers.
   * @param socketPath - Path to the socket server
   * @param gitlabProcessor - Instance of GitLabTaskProcessor
   */
  constructor(socketPath: string, gitlabProcessor: GitLabTaskProcessor) {
    this.socketClient = new SimplifiedSocketClient(socketPath);
    this.gitlabProcessor = gitlabProcessor;
    
    // Register event handlers for job and connection events
    this.socketClient.on('jobs', (jobs: SimpleJob[]) => {
      this.handleNewJobs(jobs);
    });

    this.socketClient.on('connected', () => {
      this.startJobPolling();
    });

    this.socketClient.on('disconnected', () => {
      this.stopJobPolling();
    });
  }

  /**
   * Start the job processor and connect to the socket server.
   */
  async start(): Promise<void> {
    await this.socketClient.connect();
    this.logger.info('Simplified job processor started');
  }

  /**
   * Stop the job processor and disconnect from the socket server.
   */
  async stop(): Promise<void> {
    this.stopJobPolling();
    this.socketClient.disconnect();
    this.logger.info('Simplified job processor stopped');
  }

  /**
   * Begin polling for jobs from the socket server at a fixed interval.
   * Only requests jobs if not already processing and fewer than 3 jobs are active.
   */
  private startJobPolling(): void {
    if (this.pollingTimer) return;

    this.logger.info('🔄 Requesting jobs immediately after connection...');
    const success = this.socketClient.requestJobs();
    if (!success) {
      this.logger.warn('⚠️ Initial job request failed - socket not connected');
    }

    let pollingAttemptCounter = 0;
    this.pollingTimer = setInterval(() => {
      try {
        pollingAttemptCounter++;
        if (!this.isProcessing && this.activeJobs.size < 3) {
          this.logger.info(`📡 Polling attempt #${pollingAttemptCounter} - requesting jobs (active: ${this.activeJobs.size}, processing: ${this.isProcessing})`);
          const success = this.socketClient.requestJobs();
          if (!success) {
            this.logger.warn(`⚠️ Polling attempt #${pollingAttemptCounter} failed - socket not connected`);
          } else {
            this.logger.info(`✅ Polling attempt #${pollingAttemptCounter} - job request sent successfully`);
          }
        }
      } catch (error) {
        this.logger.error(`❌ Error during polling attempt #${pollingAttemptCounter}:`, { error });
      }
    }, 5000);

    this.logger.info('✅ Job polling started (every 5 seconds)');
  }

  /**
   * Stop polling for jobs and clear the polling timer.
   */
  private stopJobPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.logger.info('Job polling stopped');
  }

  /**
   * Handle new jobs received from the socket server.
   * Adds unseen jobs to the active set and triggers asynchronous processing.
   * @param jobs - Array of SimpleJob objects
   */
  private async handleNewJobs(jobs: SimpleJob[]): Promise<void> {
    this.logger.info(`Received ${jobs.length} jobs`);
    for (const job of jobs) {
      if (!this.activeJobs.has(job.id)) {
        this.activeJobs.set(job.id, job);
        // Process job asynchronously; errors are logged and handled per job
        this.processJob(job).catch(error => {
          this.logger.error(`Error processing job ${job.id}:`, error);
          this.handleJobError(job.id, error);
        });
      }
    }
  }

  /**
   * Process a single job: handles progress, completion, error logic, and token refresh.
   * @param job - The SimpleJob to process
   */
  private async processJob(job: SimpleJob): Promise<void> {
    this.logger.info(`Starting job: ${job.id} (${job.entityType})`);
    this.isProcessing = true;

    try {
      // Ensure socket is connected before sending job started event
      if (!this.socketClient.isSocketConnected()) {
        this.logger.error(`❌ Cannot send job started event - socket not connected for job: ${job.id}`);
        // Continue processing, but skip sending started event
      } else {
        // Notify server that job has started
        const startedSent = this.socketClient.sendJobStarted(job.id, {
          entityType: job.entityType,
          entityId: job.entityId
        });
        if (startedSent) {
          this.logger.info(`✅ Job started event sent for job: ${job.id}`);
        } else {
          this.logger.warn(`⚠️ Failed to send job started event for job: ${job.id} - socket send failed`);
        }
      }

      // Convert SimpleJob to Task format for GitLabTaskProcessor
      const task = this.convertToTask(job);

      // Progress callback for reporting and jobs_discovered events
      let lastProgressTime = Date.now();
      const progressCallback = (progress: any) => {
        this.logger.debug(`[SimplifiedProcessor] Received progress update:`, progress);
        // Forward jobs_discovered events to the socket server
        if (progress && progress.type === 'jobs_discovered') {
          this.logger.info(`Detected jobs_discovered in progress callback for job: ${job.id}`);
          this.logger.debug(`[SimplifiedProcessor] Sending jobs_discovered message for job: ${job.id} with data:`, { discovered_jobs: progress.data?.discovered_jobs, discovery_summary: progress.data?.discovery_summary });
          this.socketClient.sendJobsDiscovered(
            job.id,
            {
              discovered_jobs: progress.data?.discovered_jobs || [],
              ...(progress.data?.discovery_summary && { discovery_summary: progress.data.discovery_summary })
            }
          );
          this.logger.info(`jobs_discovered message emitted for job: ${job.id}`);
        }
        const now = Date.now();
        // Throttle progress updates to at most every 5 seconds
        if (now - lastProgressTime > 5000) {
          this.sendProgress(job.id, job.entityType, progress);
          lastProgressTime = now;
        }
      };

      // Execute the job using the GitLab processor
      let result = await this.gitlabProcessor.processTask(task, progressCallback);

      if (result.success) {
        // Notify completion
        this.socketClient.sendJobCompleted(job.id, {
          success: true,
          finalCounts: result.itemsCollected || {},
          message: 'Job completed successfully'
        });
        this.logger.info(`Completed job: ${job.id}`);
      } else if (
        result.error &&
        (result.error.includes('401') || result.error.toLowerCase().includes('unauthorized'))
      ) {
        // Handle authentication errors by requesting a token refresh and retrying
        this.logger.warn(`Received 401 Unauthorized for job ${job.id}. Initiating token refresh...`);
        const emitResult = this.socketClient.requestTokenRefresh(job.id);
        if (emitResult) {
          this.logger.info(`token_refresh_request sent for job ${job.id}, waiting for token_refresh_response...`);
        } else {
          this.logger.error(`Failed to emit token_refresh_request for job ${job.id}`);
        }

        // Await token refresh response (with timeout)
        const refreshedToken = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            this.logger.error(`Timeout waiting for token_refresh_response for job ${job.id}`);
            reject(new Error('Timeout waiting for token refresh'));
          }, 15000); // 15s timeout

          const handler = (refreshJobId: string, accessToken: string, expiresAt: string) => {
            if (refreshJobId === job.id) {
              clearTimeout(timeout);
              this.socketClient.off('tokenRefresh', handler);
              if (!accessToken || !expiresAt) {
                this.logger.error(`token_refresh_response for job ${job.id} had missing accessToken or expiresAt`);
                reject(new Error('token_refresh_response payload was incomplete'));
                return;
              }
              resolve({ accessToken, expiresAt, refreshSuccessful: true });
            }
          };
          this.socketClient.on('tokenRefresh', handler);
        });

        // Log the token refresh response for traceability
        this.logger.info(
          `Full token_refresh_response payload for job ${job.id}: ${JSON.stringify(refreshedToken)}`
        );

        const tokenData = refreshedToken as { accessToken: string; refreshSuccessful: boolean; expiresAt: string };

        if (tokenData.refreshSuccessful && tokenData.accessToken) {
          job.accessToken = tokenData.accessToken;
          task.credentials.accessToken = tokenData.accessToken;
          // Retry the job with the refreshed token
          result = await this.gitlabProcessor.processTask(task, progressCallback);

          if (result.success) {
            this.socketClient.sendJobCompleted(job.id, {
              success: true,
              finalCounts: result.itemsCollected || {},
              message: 'Job completed successfully after token refresh'
            });
            this.logger.info(`Completed job: ${job.id} after token refresh`);
          } else {
            // Retry failed after token refresh
            const error = new Error(result.error || 'Unknown error');
            if (result.stackTrace) {
              error.stack = result.stackTrace;
            }
            if (result.fullError) {
              (error as any).fullError = result.fullError;
            }
            this.logger.error(`Job ${job.id} failed after token refresh attempt.`);
            this.handleJobError(job.id, error);
          }
        } else {
          // Token refresh failed or returned invalid data
          this.logger.error(
            `Token refresh failed or invalid response for job ${job.id}. Payload: ${JSON.stringify(tokenData)}`
          );
          const error = new Error('Token refresh failed or invalid response');
          this.handleJobError(job.id, error);
        }
      } else {
        // General failure: propagate error details from GitLab processor
        const error = new Error(result.error || 'Unknown error');
        if (result.stackTrace) {
          error.stack = result.stackTrace;
        }
        if (result.fullError) {
          (error as any).fullError = result.fullError;
        }
        this.handleJobError(job.id, error);
      }

    } catch (error) {
      // Catch-all for unexpected errors during job processing
      this.handleJobError(job.id, error);
    } finally {
      // Always remove job from active set and update processing state
      this.activeJobs.delete(job.id);
      this.isProcessing = this.activeJobs.size > 0;
    }
  }

  /**
   * Send a progress update for a job to the socket server.
   * For 'project' and 'group' jobs, includes the actual items in the update.
   * @param jobId - The job ID
   * @param entityType - The entity type of the job
   * @param progress - Progress data object
   */
  private sendProgress(jobId: string, entityType: EntityType, progress: any): void {
    const isArea = entityType === 'project' || entityType === 'group';
    const progressData: ProgressData = {
      stage: progress.stage || 'fetching',
      entityType,
      processed: progress.processedItems || 0,
      total: progress.totalItems,
      message: progress.message,
      resumeState: progress.resumeState ? {
        lastEntityId: progress.resumeState.lastProcessedId,
        currentPage: progress.resumeState.currentPage,
        entityType
      } : undefined,
      itemCounts: progress.itemCounts || {},
      currentPage: progress.resumeState?.currentPage,
      processingRate: progress.processingRate,
      estimatedTimeRemaining: progress.estimatedTime.estimatedTimeRemaining
    };

    if (isArea && Array.isArray(progress.items)) {
      (progressData as any).items = progress.items;
    }

    this.socketClient.sendJobProgress(jobId, progressData);
    this.logger.debug(`📊 Sent progress update for job ${jobId}: ${progressData.processed} items processed`);
  }

  /**
   * Handle job failure: extract error context, build FailureData, and notify the socket server.
   * @param jobId - The job ID
   * @param error - The error object or value
   */
  private handleJobError(jobId: string, error: any): void {
    const stackTrace = this.extractStackTrace(error);
    const context = this.extractErrorContext(error, jobId);

    const failureData: FailureData = {
      error: error.message || 'Unknown error',
      errorType: error.name || 'Error',
      isRecoverable: !error.message?.includes('unauthorized') && !error.message?.includes('forbidden'),
      resumeState: this.extractResumeState(error),
      partialCounts: this.extractPartialCounts(error),
      stackTrace,
      context
    };

    this.socketClient.sendJobFailed(jobId, failureData);
    this.logger.error(`Job failed: ${jobId} - ${failureData.error}`, {
      jobId,
      errorType: failureData.errorType,
      stackTrace: failureData.stackTrace,
      context: failureData.context
    });
  }

  /**
   * Convert a SimpleJob to the Task format expected by GitLabTaskProcessor.
   * Ensures correct mapping for group/project discovery jobs.
   * @param job - The SimpleJob to convert
   * @returns Task object
   */
  private convertToTask(job: SimpleJob): Task {
    const taskType = entityTypeToTaskType(job.entityType);
    return {
      id: job.id,
      type: taskType, // Converts 'group' entity from GROUP_PROJECT_DISCOVERY to DISCOVER_AREAS
      apiEndpoint: job.gitlabUrl,
      credentials: {
        accessToken: job.accessToken
      },
      options: {
        resourceType: job.entityType,
        resourceId: job.entityId,
        fullPath: job.entityId // Use entityId as fullPath for now
      },
      resumeState: job.resumeState ? {
        currentPage: job.resumeState.currentPage,
        lastProcessedId: job.resumeState.lastEntityId,
        resourceType: job.entityType
      } : undefined
    };
  }

  // --- Error extraction and status reporting utilities ---


  /**
   * Extract resume state from error context if available.
   */
  private extractResumeState(error: any): any {
    return error.resumeState || undefined;
  }

  /**
   * Extract partial progress counts from error context if available.
   */
  private extractPartialCounts(error: any): Record<string, number> | undefined {
    return error.partialCounts || undefined;
  }

  /**
   * Extract stack trace from error object, supporting various error shapes.
   */
  private extractStackTrace(error: any): string | undefined {
    if (error instanceof Error && error.stack) {
      return error.stack;
    }
    if (error && typeof error === 'object' && error.stack) {
      return error.stack;
    }
    if (error && typeof error === 'object' && error.stackTrace) {
      return error.stackTrace;
    }
    return undefined;
  }

  /**
   * Extracts detailed error context for reporting, including job and HTTP info.
   * Returns undefined if only minimal context is available.
   */
  private extractErrorContext(error: any, jobId: string): Record<string, any> | undefined {
    const context: Record<string, any> = {
      jobId,
      timestamp: new Date().toISOString()
    };

    // Add active job information if available
    const activeJob = this.activeJobs.get(jobId);
    if (activeJob) {
      context.entityType = activeJob.entityType;
      context.entityId = activeJob.entityId;
      context.gitlabUrl = activeJob.gitlabUrl;
    }

    // Extract additional error context
    if (error && typeof error === 'object') {
      if (error.code) context.errorCode = error.code;
      if (error.status) context.httpStatus = error.status;
      if (error.statusText) context.httpStatusText = error.statusText;
      if (error.url) context.requestUrl = error.url;
      if (error.method) context.requestMethod = error.method;
      if (error.context) context.errorContext = error.context;
      if (error.fullError) context.fullError = error.fullError;
      if (error.cause) context.cause = error.cause;
    }

    // Add processing state snapshot
    context.processingState = {
      activeJobs: this.activeJobs.size,
      isProcessing: this.isProcessing,
      isConnected: this.socketClient.isSocketConnected()
    };

    // Only return if more than jobId/timestamp is present
    return Object.keys(context).length > 2 ? context : undefined;
  }

  // --- Public status reporting methods ---

  /**
   * Get the number of currently active jobs.
   */
  public getActiveJobCount(): number {
    return this.activeJobs.size;
  }

  /**
   * Returns true if the socket client is connected.
   */
  public isConnected(): boolean {
    return this.socketClient.isSocketConnected();
  }

  /**
   * Returns the current processor status: 'idle', 'discovering', 'processing', or 'error'.
   */
  public getStatus(): 'idle' | 'discovering' | 'processing' | 'error' {
    if (!this.socketClient.isSocketConnected()) return 'error';
    if (this.activeJobs.size === 0) return 'idle';

    // If any job is a discovery job, report 'discovering'
    const hasDiscoveryJob = Array.from(this.activeJobs.values())
      .some(job => job.entityType === 'group' || job.entityType === 'project');

    return hasDiscoveryJob ? 'discovering' : 'processing';
  }
}