/**
 * UnixSocketManager
 *
 * Provides unix socket server functionality for communicating with external systems (e.g., backend job queue).
 * Handles client management, message parsing, task queueing, and update broadcasting.
 *
 * Responsibilities:
 * - Start/stop unix socket server
 * - Manage connected clients
 * - Queue and dispatch tasks
 * - Broadcast updates and handle incoming messages
 */

import type { ServerWebSocket, UnixServeOptions } from 'bun';
import type { Task, TaskUpdate } from '../types/task';
import { getLogger } from '../utils/logging';
const logger = getLogger(["core"]);

/* ---------------------------------------------------------------------------
 * UnixSocketManager: Main class for unix socket server and task queue
 * ------------------------------------------------------------------------- */
export class UnixSocketManager {
  private socketPath: string;
  private server: Bun.Server | null = null;
  private clients: Set<Bun.ServerWebSocket> = new Set();
  private taskQueue: Task[] = [];
  private taskCallbacks: ((task: Task) => void)[] = [];
  private messageHandlers: ((msg: any) => void)[] = [];

  /**
   * Construct a new UnixSocketManager.
   * @param socketPath Path to the unix socket file
   */
  constructor(socketPath: string) {
    this.socketPath = socketPath;
  }

  /* -------------------------------------------------------------------------
   * Server lifecycle management
   * ----------------------------------------------------------------------- */
  /**
   * Start the unix socket server and listen for client connections and messages.
   */
  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create server using Bun's native server
        this.server = Bun.serve({
          unix: this.socketPath,
          websocket: {
            open: (ws: ServerWebSocket) => {
              this.clients.add(ws);
            },
            message: (_ws: ServerWebSocket, message: string | Buffer<ArrayBufferLike>) => {
              try {
                const data = typeof message === 'string' ? message : new TextDecoder().decode(message);
                const parsedMessage = JSON.parse(data);
                // Notify all message handlers
                this.messageHandlers.forEach(handler => {
                  try { handler(parsedMessage); } catch {}
                });
                if (parsedMessage.type === 'task') {
                  const task = parsedMessage.data as Task;
                  this.taskQueue.push(task);
                  // Notify task listeners
                  this.taskCallbacks.forEach(callback => callback(task));
                }
              } catch (error) {
                logger.error('Error parsing message:', {error});
              }
            },
            close: (ws: ServerWebSocket) => {
              this.clients.delete(ws);
            },
          },
          fetch: () => new Response("GitLab Crawler Socket Server")
        } as UnixServeOptions);
        logger.info(`Unix socket server listening on ${this.socketPath}`);
        resolve();
      } catch (error) {
        logger.error('Failed to start unix socket server:', {error});
        reject(error);
      }
    });
  }

  /**
   * Stop the unix socket server and disconnect all clients.
   */
  public async stop(): Promise<void> {
    if (this.server) {
      this.server.stop();
      this.server = null;
      this.clients.clear();
    }
    return Promise.resolve();
  }

  /* -------------------------------------------------------------------------
   * Task queue management
   * ----------------------------------------------------------------------- */
  /**
   * Add a task to the queue and notify listeners.
   * @param task - The Task to add to the queue
   */
  public addTask(task: Task): void {
    this.taskQueue.push(task);
    this.taskCallbacks.forEach(callback => callback(task));
  }

  /**
   * Register a callback for new tasks added to the queue.
   * @param callback - Function to call when a new Task is added
   */
  public onTask(callback: (task: Task) => void): void {
    this.taskCallbacks.push(callback);
  }

  /**
   * Poll for a task from the queue (FIFO).
   * @returns The next Task in the queue, or null if empty
   */
  public async pollTask(): Promise<Task | null> {
    return this.taskQueue.shift() || null;
  }

  /* -------------------------------------------------------------------------
   * Client communication and update broadcasting
   * ----------------------------------------------------------------------- */
  /**
   * Send a task update to all connected clients.
   * @param update - The TaskUpdate to broadcast
   * @returns true if all sends succeed or if no clients are connected
   */
  public sendUpdate(update: TaskUpdate): boolean {
    if (this.clients.size === 0) {
      // For testing purposes, still return true even if no clients
      return true;
    }
    const message = JSON.stringify({
      type: 'update',
      data: update
    });
    let success = true;
    for (const client of this.clients) {
      try {
        client.send(message);
      } catch (error) {
        logger.error('Failed to send update:', {error});
        success = false;
      }
    }
    return success;
  }

  /* -------------------------------------------------------------------------
   * Message handler registration
   * ----------------------------------------------------------------------- */
  /**
   * Register a handler for all incoming messages (raw JSON parsed).
   * @param handler - Function to handle incoming messages
   */
  public onMessage(handler: (msg: any) => void): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Unregister a handler for incoming messages.
   * @param handler - The handler function to remove
   */
  public offMessage(handler: (msg: any) => void): void {
    this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
  }
}
