import { getCorrelationIdFromHeaders } from "@/src/infrastructure/observability/correlation";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  correlationId?: string;
  component?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  correlationId?: string;
  component?: string;
  meta?: Record<string, unknown>;
}

function writeLog(entry: LogEntry): void {
  const payload = JSON.stringify(entry);

  switch (entry.level) {
    case "error":
      console.error(payload);
      break;
    case "warn":
      console.warn(payload);
      break;
    default:
      console.log(payload);
  }
}

export function createLogger(baseContext: LogContext = {}) {
  const log = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    writeLog({
      level,
      message,
      timestamp: new Date().toISOString(),
      correlationId: baseContext.correlationId,
      component: baseContext.component,
      meta: meta && Object.keys(meta).length > 0 ? meta : undefined,
    });
  };

  return {
    debug: (message: string, meta?: Record<string, unknown>) => log("debug", message, meta),
    info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
    error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
    child: (context: LogContext) =>
      createLogger({
        ...baseContext,
        ...context,
      }),
  };
}

export function createRequestLogger(headers: Headers, component: string) {
  const correlationId = getCorrelationIdFromHeaders(headers);

  return createLogger({
    correlationId,
    component,
  });
}

export type Logger = ReturnType<typeof createLogger>;
