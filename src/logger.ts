/**
 * Logger for the Automated Development Task Manager
 * 
 * Provides centralized logging functionality with different log levels and formatting
 */

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Current log level
 */
let currentLogLevel = LogLevel.INFO;

/**
 * Set the log level
 * @param level The log level to set
 */
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

/**
 * Get the current log level
 * @returns The current log level
 */
export function getLogLevel(): LogLevel {
  return currentLogLevel;
}

/**
 * Format a log message with timestamp
 * @param level The log level
 * @param message The message to log
 * @returns Formatted log message
 */
function formatLogMessage(level: string, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}`;
}

/**
 * Log a debug message
 * @param message The message to log
 * @param data Optional data to include in the log
 */
export function debug(message: string, data?: any): void {
  if (currentLogLevel <= LogLevel.DEBUG) {
    const formattedMessage = formatLogMessage('DEBUG', message);
    console.log(formattedMessage);
    if (data !== undefined) {
      console.log(data);
    }
  }
}

/**
 * Log an info message
 * @param message The message to log
 * @param data Optional data to include in the log
 */
export function info(message: string, data?: any): void {
  if (currentLogLevel <= LogLevel.INFO) {
    const formattedMessage = formatLogMessage('INFO', message);
    console.log(formattedMessage);
    if (data !== undefined) {
      console.log(data);
    }
  }
}

/**
 * Log a warning message
 * @param message The message to log
 * @param data Optional data to include in the log
 */
export function warn(message: string, data?: any): void {
  if (currentLogLevel <= LogLevel.WARN) {
    const formattedMessage = formatLogMessage('WARN', message);
    console.warn(formattedMessage);
    if (data !== undefined) {
      console.warn(data);
    }
  }
}

/**
 * Log an error message
 * @param message The message to log
 * @param error Optional error to include in the log
 */
export function error(message: string, error?: any): void {
  if (currentLogLevel <= LogLevel.ERROR) {
    const formattedMessage = formatLogMessage('ERROR', message);
    console.error(formattedMessage);
    if (error !== undefined) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
        if (error.stack) {
          console.error(`Stack: ${error.stack}`);
        }
      } else {
        console.error(error);
      }
    }
  }
}

/**
 * Create a logger for a specific component
 * @param component The component name
 * @returns Logger functions for the component
 */
export function createComponentLogger(component: string) {
  return {
    debug: (message: string, data?: any) => debug(`[${component}] ${message}`, data),
    info: (message: string, data?: any) => info(`[${component}] ${message}`, data),
    warn: (message: string, data?: any) => warn(`[${component}] ${message}`, data),
    error: (message: string, error?: any) => error(`[${component}] ${message}`, error),
  };
}
