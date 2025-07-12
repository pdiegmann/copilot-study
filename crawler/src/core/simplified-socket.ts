import { connect, type Socket } from 'net';
import { EventEmitter } from 'events';
import { getLogger } from '../utils/logging';
import type { 
  SocketMessage, 
  MessageType, 
  SimpleJob,
  HeartbeatData,
  ProgressData,
  CompletionData,
  FailureData,
  DiscoveryData,
  EntityType
} from '../types/unified-types';

export class SimplifiedSocketClient extends EventEmitter {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectTimer: Timer | null = null;
  private heartbeatTimer: Timer | null = null;
  private logger = getLogger(['simplified-socket']);
  private messageBuffer = '';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor(private socketPath: string) {
    super();
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;

    return new Promise((resolve, reject) => {
      this.logger.info(`Attempting to connect to socket: ${this.socketPath}`);
      this.socket = connect(this.socketPath);
      
      this.socket.on('connect', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.messageBuffer = '';
        this.startHeartbeat();
        this.logger.info('✅ Connected to backend socket successfully');
        this.emit('connected');
        resolve();
      });

      this.socket.on('data', (data) => {
        this.handleData(data);
      });

      this.socket.on('close', () => {
        this.isConnected = false;
        this.socket = null;
        this.stopHeartbeat();
        this.logger.warn('🔌 Disconnected from backend socket');
        this.emit('disconnected');
        this.scheduleReconnect();
      });

      this.socket.on('error', (error) => {
        this.logger.warn(`⚠️ Socket connection failed: ${error.message}`);
        // Don't reject immediately - start reconnection process instead
        if (this.reconnectAttempts === 0) {
          this.logger.info('🔄 Starting reconnection process...');
          this.scheduleReconnect();
          resolve(); // Resolve to prevent app crash, reconnection will handle connection
        }
      });
    });
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();

    if (this.socket) {
      this.socket.end();
      this.socket = null;
    }

    this.isConnected = false;
  }

  private handleData(data: Buffer): void {
    this.messageBuffer += data.toString();
    
    // Parse complete JSON messages
    let startIndex = 0;
    while (true) {
      const messageStart = this.messageBuffer.indexOf('{', startIndex);
      if (messageStart === -1) break;
      
      let braceCount = 0;
      let messageEnd = -1;
      
      for (let i = messageStart; i < this.messageBuffer.length; i++) {
        if (this.messageBuffer[i] === '{') braceCount++;
        if (this.messageBuffer[i] === '}') braceCount--;
        
        if (braceCount === 0) {
          messageEnd = i + 1;
          break;
        }
      }
      
      if (messageEnd === -1) break;
      
      const messageStr = this.messageBuffer.substring(messageStart, messageEnd);
      try {
        const message: SocketMessage = JSON.parse(messageStr);
        this.handleMessage(message);
      } catch (error) {
        this.logger.error('Failed to parse message:', {error});
      }
      
      startIndex = messageEnd;
    }
    
    this.messageBuffer = this.messageBuffer.substring(startIndex);
  }

  private handleMessage(message: SocketMessage): void {
    this.logger.debug(`📥 Received ${message.type}`, { jobId: message.jobId });
    
    switch (message.type) {
      case 'job_response':
        const jobs = message.data.jobs as SimpleJob[];
        this.logger.info(`📋 Received job response with ${jobs?.length || 0} jobs`);
        if (jobs && jobs.length > 0) {
          this.logger.debug('Job details:', {
            jobs: jobs.map(job => ({
              id: job.id,
              entityType: job.entityType,
              entityId: job.entityId
            }))
          });
        }
        this.emit('jobs', jobs);
        break;
      // Log every incoming message
      this.logger.debug(`[SOCKET] Incoming message: ${JSON.stringify(message)}`);

      case 'token_refresh_response':
        this.logger.debug(`🔑 Received token refresh response for job: ${message.jobId} | Full message: ${JSON.stringify(message)}`);
        if (typeof message.data === 'undefined' || !message.data.accessToken || !message.data.expiresAt) {
          this.logger.warn(`[SOCKET] token_refresh_response missing expected fields (accessToken, expiresAt): ${JSON.stringify(message)}`);
          this.emit('tokenRefresh', message.jobId, null); // Emit null or an error indicator
        } else {
          this.emit('tokenRefresh', message.jobId, message.data.accessToken, message.data.expiresAt);
        }
        break;
      default:
        this.logger.debug(`❓ Unknown message type: ${message.type}`);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error(`❌ Max reconnect attempts reached (${this.maxReconnectAttempts}). Stopping reconnection attempts.`);
      return;
    }

    // Use fixed 5-second delay as required
    const delay = 5000;
    this.reconnectAttempts++;

    this.logger.info(`🔄 Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`);

    this.reconnectTimer = setTimeout(() => {
      this.logger.info(`🔌 Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} - trying to connect...`);
      this.connect().catch((error) => {
        this.logger.warn(`⚠️ Reconnect attempt ${this.reconnectAttempts} failed: ${error.message}`);
        // Error will trigger another reconnect via the error handler
      });
    }, delay);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat({
        activeJobs: 0, // Will be updated by job processor
        totalProcessed: 0,
        systemStatus: 'idle',
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      });
    }, 5000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // Public API methods
  public sendMessage(message: SocketMessage): boolean {
    if (!this.isConnected || !this.socket) {
      this.logger.warn(`📤 Cannot send ${message.type} message - not connected`);
      return false;
    }

    try {
      const messageStr = JSON.stringify(message);
      this.socket.write(messageStr);
      this.logger.debug(`📤 Sent ${message.type} message:`, {
        type: message.type,
        jobId: message.jobId,
        dataSize: messageStr.length
      });
      return true;
    } catch (error) {
      this.logger.error(`❌ Failed to send ${message.type} message:`, {error});
      return false;
    }
  }

  public requestJobs(): boolean {
    this.logger.info('📨 Sending job request to backend...');
    const message = {
      type: 'job_request' as const,
      timestamp: new Date().toISOString(),
      data: {}
    };
    
    const success = this.sendMessage(message);
    
    if (success) {
      this.logger.info('✅ Job request sent successfully');
    } else {
      this.logger.warn('❌ Failed to send job request - not connected');
    }
    
    return success;
  }

  public sendHeartbeat(data: HeartbeatData): boolean {
    return this.sendMessage({
      type: 'heartbeat',
      timestamp: new Date().toISOString(),
      data
    });
  }

  public sendJobStarted(jobId: string, data?: any): boolean {
    this.logger.info(`📤 Attempting to send job_started message for job: ${jobId}`);
    const success = this.sendMessage({
      type: 'job_started',
      timestamp: new Date().toISOString(),
      jobId,
      data: data || {}
    });
    
    if (success) {
      this.logger.info(`✅ Successfully sent job_started message for job: ${jobId}`);
    } else {
      this.logger.warn(`❌ Failed to send job_started message for job: ${jobId} - not connected`);
    }
    
    return success;
  }

  public sendJobProgress(jobId: string, data: ProgressData): boolean {
    return this.sendMessage({
      type: 'job_progress',
      timestamp: new Date().toISOString(),
      jobId,
      data
    });
  }

  /**
   * Emits a jobs_discovered message over the socket.
   * @param jobId The job id for which jobs were discovered.
   * @param data The discovered_jobs array and discovery_summary object.
   */
  public sendJobsDiscovered(
    jobId: string,
    data: { discovered_jobs: any[]; discovery_summary: any }
  ): boolean {
    this.logger.info(`📤 Attempting to send jobs_discovered message for job: ${jobId}`);
    const message = {
      type: 'jobs_discovered' as const,
      timestamp: new Date().toISOString(),
      jobId: jobId, // Explicitly set jobId
      data
    };
    const success = this.sendMessage(message);
    if (success) {
      this.logger.info(`✅ Successfully sent jobs_discovered message for job: ${jobId}`);
    } else {
      this.logger.warn(`❌ Failed to send jobs_discovered message for job: ${jobId} - not connected`);
    }
    return success;
  }

  public sendJobCompleted(jobId: string, data: CompletionData): boolean {
    return this.sendMessage({
      type: 'job_completed',
      timestamp: new Date().toISOString(),
      jobId,
      data
    });
  }

  public sendJobFailed(jobId: string, data: FailureData): boolean {
    return this.sendMessage({
      type: 'job_failed',
      timestamp: new Date().toISOString(),
      jobId,
      data
    });
  }

  public sendDiscovery(data: DiscoveryData): boolean {
    return this.sendMessage({
      type: 'discovery',
      timestamp: new Date().toISOString(),
      data
    });
  }

  public requestTokenRefresh(jobId: string): boolean {
    this.logger.info(`[EMIT] Sending token_refresh_request for job ${jobId}`);
    const success = this.sendMessage({
      type: 'token_refresh_request',
      timestamp: new Date().toISOString(),
      jobId,
      data: {}
    });
    if (success) {
      this.logger.info(`[EMIT] token_refresh_request sent successfully for job ${jobId}`);
    } else {
      this.logger.error(`[EMIT] Failed to send token_refresh_request for job ${jobId}`);
    }
    return success;
  }

  /**
   * Check if the socket is currently connected.
   * @returns true if connected, false otherwise
   */
  public isSocketConnected(): boolean {
    return this.isConnected;
  }
}
