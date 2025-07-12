import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { createClient, type Client } from "@libsql/client";
import * as schema from "./schema";
import AppSettings from "../settings"; // Import the class itself
import path from "node:path";
import { getLogger } from "@logtape/logtape";

const logger = getLogger(["server", "db"]);

let client: Client | null = null;
let dbInstance: LibSQLDatabase<typeof schema> | null = null;

function getDbClient(): Client {
  if (!client) {
    // Get settings *inside* this function, ensuring AppSettings is initialized
    let dbUrl = AppSettings().paths.database;
    if (!dbUrl) {
      throw new Error("Database path is not defined in settings.");
    }
    logger.info(`Initializing database client`, { dbUrl });
    if (dbUrl.indexOf("://") < 0) {
      dbUrl = `file://${path.resolve(dbUrl)}`;
      logger.debug(`Fixed database URL`, { dbUrl });
    }
    client = createClient({ url: dbUrl });
  }
  return client;
}

// Export a function to get the initialized drizzle instance
export function getDb(): LibSQLDatabase<typeof schema> {
  if (!dbInstance) {
    const dbClient = getDbClient(); // Ensure client is initialized
    
    // Enable foreign key constraints synchronously during initialization
    try {
      dbClient.execute("PRAGMA foreign_keys = ON");
      logger.debug("Foreign key constraints enabled successfully");
    } catch (error) {
      logger.error("Failed to enable foreign key constraints:", { error });
      throw new Error("Database initialization failed: Could not enable foreign key constraints");
    }
    
    dbInstance = drizzle(dbClient, { schema });
  }
  return dbInstance;
}

// Ensure the db instance is accessible for other potential top-level needs if any
// (Though ideally, consumers should call getDb())
export const db = getDb();

// Handle graceful shutdown
process.on("SIGINT", function () {
  logger.info("Received SIGINT, closing database client...");
  // Check if client was initialized before trying to close
  if (client) {
    client.close();
    logger.info("Database client closed.");
  } else {
    logger.debug("Database client was not initialized, nothing to close.");
  }
  process.exit(0);
});

// Optional: Export client getter if direct client access is needed elsewhere
// export { getDbClient };

/**
 * Safely converts a timestamp value to a Date object for Drizzle timestamp fields.
 * Handles null, undefined, invalid dates, and ensures proper Date object creation.
 *
 * @param timestamp - The timestamp value (string, number, Date, or null/undefined)
 * @param fallbackToCurrent - Whether to fallback to current time if invalid (default: true)
 * @returns Date object or null
 */
export function safeTimestamp(timestamp: any, fallbackToCurrent: boolean = true): Date | null {
  // Handle null/undefined cases
  if (timestamp === null || timestamp === undefined) {
    return fallbackToCurrent ? new Date() : null;
  }

  // If already a Date object, validate it
  if (timestamp instanceof Date) {
    return isNaN(timestamp.getTime()) ? (fallbackToCurrent ? new Date() : null) : timestamp;
  }

  // Try to create a Date from the timestamp
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      logger.warn("Invalid timestamp value, using fallback", { timestamp, fallbackToCurrent });
      return fallbackToCurrent ? new Date() : null;
    }
    return date;
  } catch (error) {
    logger.error("Error creating Date from timestamp", { timestamp, error });
    return fallbackToCurrent ? new Date() : null;
  }
}
