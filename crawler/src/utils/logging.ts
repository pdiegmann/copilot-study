
/**
 * Logging utilities for the crawler
 *
 * Provides logger creation, log level parsing from environment, and logging configuration for console and file sinks.
 * Uses logtape for structured logging and supports rotating file logs.
 */

import path from "node:path";
import { mkdirSync } from "node:fs";
import { AsyncLocalStorage } from "node:async_hooks";
import {
  compareLogLevel,
  configure,
  getAnsiColorFormatter,
  getConsoleSink,
  getLogger as _getLogger,
  getTextFormatter,
  withFilter,
  type Logger,
  type LogRecord
} from "@logtape/logtape";
import { getRotatingFileSink } from "@logtape/file";

/**
 * Get a logger for the given category (or root if omitted).
 */
export function getLogger(category?: string | readonly string[]): Logger {
  return _getLogger(category)
}

/**
 * Parse log level from environment variables (LOG_LEVEL or DEBUG).
 */
export function getLogLevelFromEnv(): "info" | "debug" | "warning" | "error" | "fatal" | undefined {
  const envKeys = Object.keys(Bun.env);
  if (envKeys.includes("LOG_LEVEL")) {
    const val = Bun.env["LOG_LEVEL"];
    if (val && val.length > 0) {
      const possibleValues = ["info", "debug", "warning", "error", "fatal"];
      if (possibleValues.includes(val.toLowerCase()))
        return val as "info" | "debug" | "warning" | "error" | "fatal";
    }
    return undefined;
  }
  if (envKeys.includes("DEBUG")) {
    const val = Bun.env["DEBUG"];
    return val &&
      (val.toLowerCase() === "true" || val.toLowerCase() === "yes" || val.toLowerCase() === "1")
      ? "debug"
      : undefined;
  }
  return undefined;
}

/**
 * Formatter for logtape that includes all properties in the log output.
 */
const complexFormatter = (
  formatterFactory: (options?: object) => (record: any) => string,
  formatterFactoryOptions: any = {},
  allParams = true,
  spacer = "\n"
) => {
  formatterFactoryOptions = {
    timestamp: "date-time",
    value: (v: any) => (typeof v === "object" ? Bun.inspect(v) : v),
    ...formatterFactoryOptions
  };
  const formatter = formatterFactory(formatterFactoryOptions);
  return (record: LogRecord) => {
    if (!allParams || !record.properties || Object.keys(record.properties).length <= 0) {
      return formatter(record);
    }
    const props = record.properties;
    for (const prop in props) {
      if (record.rawMessage.includes(`{${prop}}`)) {
        delete props[prop];
      }
    }
    let message: unknown[] = Object.assign([], record.message);
    if (Object.keys(props).length > 0) {
      if (message.length <= 0) message = [`${record.rawMessage}${spacer}`];
      else if (message.length % 2 !== 0) message.push(`${message.pop()}${spacer}`);
      else message.push(spacer, spacer);
      message.push(props);
    }
    return formatter({
      ...record,
      message
    } as LogRecord);
  };
};

/**
 * Configure logging sinks and loggers for the crawler.
 * Supports console-only and rotating file logs, with color and plain text formatting.
 */
export async function configureLogging(CONFIG: any, envLogLevel: "error" | "warning" | "debug" | "info" | "fatal" | null | undefined) {
  let sinkNames = ["console", "logFile", "errorFile"];
  const colorFormatter = complexFormatter(getAnsiColorFormatter, {}, false);
  let sinks: any = {
    console: withFilter(getConsoleSink({ formatter: colorFormatter }), (log: any) => compareLogLevel(log.level, CONFIG.consoleLogLevel) >= 0),
  }
  let loggers: any[] = [
    { category: "crawler", sinks: sinkNames },
    { category: [], sinks: sinkNames, lowestLevel: envLogLevel || "info" }
  ]
  if (process.env.FORCE_CONSOLE_ONLY_LOGS) {
    sinkNames = ["console"]
  } else {
    const logDir = path.join(CONFIG.dataDir, 'logs');
    mkdirSync(logDir, { recursive: true });
    const plainFormatter = complexFormatter(getTextFormatter);
    const logfileOptions = {
      maxSize: 0x400 * 0x400, // 1 MiB
      maxFiles: 3,
      formatter: plainFormatter,
      lazy: true
    };
    sinks = {
      ...sinks,
      meta: getRotatingFileSink(path.join(CONFIG.dataDir, 'logs', `crawler.meta.log`), logfileOptions),
      logFile: withFilter(
        getRotatingFileSink(path.join(CONFIG.dataDir, 'logs', `crawler.log`), logfileOptions),
        (log: any) => compareLogLevel(log.level, CONFIG.fileLogLevel) >= 0
      ),
      errorFile: withFilter(
        getRotatingFileSink(path.join(CONFIG.dataDir, 'logs', `crawler.error.log`), logfileOptions),
        (log: any) => compareLogLevel(log.level, "error") >= 0
      ),
    }
    loggers.push({
      category: ["logtape", "meta"],
      sinks: ["meta"],
      lowestLevel: "warning"
    })
  }
  await configure({
    reset: true,
    contextLocalStorage: new AsyncLocalStorage(),
    sinks,
    loggers
  });
}