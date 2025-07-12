/**
 * Entry point for the Simplified GitLab Crawler application.
 *
 * This script initializes and orchestrates all core components:
 * - Logging system
 * - Lookup database
 * - Anonymizer
 * - Data storage
 * - GitLab task processor
 * - Job processor (socket-based)
 *
 * Handles startup, graceful shutdown, and error reporting.
 */

import { SimplifiedJobProcessor } from './core/simplified-processor';
import { GitLabTaskProcessor } from './api/gitlab-processor';
import { Anonymizer } from './utils/anonymizer';
import { LookupDatabase } from './utils/lookup-db';
import { DataStorage } from './storage/data-storage';
import { getLogger, configureLogging, getLogLevelFromEnv } from './utils/logging';

/**
 * Application configuration, loaded from environment variables with sensible defaults.
 */
const envLogLevel = getLogLevelFromEnv();

const CONFIG = {
  socketPath: process.env.SOCKET_PATH || '/home/bun/data/config/api.sock',
  dataDir: process.env.DATA_DIR || process.env.DATADIR || '/home/bun/data/archive',
  lookupDbPath: process.env.LOOKUP_DB_PATH || '/home/bun/data/archive/lookup.db',
  anonymizationSecret: process.env.ANONYMIZATION_SECRET || 'change-this-in-production',
  consoleLogLevel: envLogLevel || 'info',
  fileLogLevel: envLogLevel || 'info'
};

/**
 * Main application logic.
 * Initializes all core components, starts the job processor, and handles graceful shutdown.
 */
async function main() {
  // Use console.log initially since logging isn't configured yet
  console.log('🚀 Starting Simplified GitLab Crawler...');
  console.log('📋 Configuration:', {
    socketPath: CONFIG.socketPath,
    dataDir: CONFIG.dataDir,
    lookupDbPath: CONFIG.lookupDbPath
  });

  try {
    // Step 1: Configure logging
    console.log('🔧 Configuring logging system...');
    await configureLogging(CONFIG, envLogLevel);

    // Step 2: Use logger from here on
    const logger = getLogger(["app"]);
    logger.info('✅ Logging system configured successfully');

    // Step 3: Initialize lookup database (for anonymization and task mapping)
    logger.info('🔍 Initializing lookup database...');
    const lookupDb = new LookupDatabase(CONFIG.lookupDbPath);
    await lookupDb.initialize();
    logger.info('✅ Lookup database initialized');

    // Step 4: Initialize anonymizer (for privacy-preserving data handling)
    logger.info('🔒 Initializing anonymizer...');
    const anonymizer = new Anonymizer({
      secret: CONFIG.anonymizationSecret,
      lookupDb,
      algorithm: 'sha256',
      separator: '|'
    });
    logger.info('✅ Anonymizer initialized');

    // Step 5: Initialize persistent data storage
    logger.info('💾 Initializing data storage...');
    const dataStorage = new DataStorage({
      baseDir: CONFIG.dataDir,
      createDirIfNotExists: true
    });
    await dataStorage.initialize();
    logger.info('✅ Data storage initialized');

    // Step 6: Initialize GitLab task processor (handles GitLab-specific logic)
    logger.info('🔧 Initializing GitLab processor...');
    const gitlabProcessor = new GitLabTaskProcessor({
      anonymizer,
      lookupDb,
      dataStorage
    });
    logger.info('✅ GitLab processor initialized');

    // Step 7: Create and start the job processor (socket-based job queue)
    logger.info('⚙️ Creating job processor...');
    const jobProcessor = new SimplifiedJobProcessor(CONFIG.socketPath, gitlabProcessor);
    logger.info('✅ Job processor created');

    logger.info('🔌 Starting job processor (connecting to socket)...');
    try {
      await jobProcessor.start();
      logger.info('🎉 Simplified GitLab Crawler started successfully!');
      logger.info('🔗 Connected to socket:', { socketPath: CONFIG.socketPath });
    } catch (error) {
      logger.warn('⚠️ Initial socket connection failed, but continuing with reconnection attempts...');
      logger.info('🔄 The crawler will keep trying to connect every 5 seconds');
    }

    // Step 8: Setup graceful shutdown handlers
    const shutdown = async () => {
      logger.info('🛑 Shutting down...');
      try {
        await jobProcessor.stop();
        logger.info('✅ Shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('❌ Error during shutdown:', { error });
        process.exit(1);
      }
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Step 9: Keep the process alive
    logger.info('🏃 Crawler is running. Press Ctrl+C to stop.');

  } catch (error) {
    // Log initialization errors to console for visibility
    console.error('❌ Failed to initialize crawler:', { error });
    if (error instanceof Error) {
      console.error('Stack trace:', { stack: error.stack });
    }
    throw error;
  }
}

/**
 * Application bootstrap.
 * Starts the main logic and handles top-level errors.
 */
console.log('🎬 Starting GitLab Crawler application...');
main().catch(error => {
  console.error('💥 Application failed to start:', error);
  if (error instanceof Error) {
    console.error('Stack trace:', error.stack);
  }
  process.exit(1);
});
