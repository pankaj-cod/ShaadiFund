/**
 * Structured JSON logging. One line per event so hosted log search works.
 * Sensitive keys are redacted before anything is written.
 */

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const REDACTED_KEYS =
  /^(authorization|cookie|password|secret|token|signature|email|guestemail|key_secret|card|vpa)$/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[truncated]";
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        REDACTED_KEYS.test(key) ? "[redacted]" : redact(inner, depth + 1),
      ]),
    );
  }
  return value;
}

function write(level: Level, message: string, fields?: Fields): void {
  const line = JSON.stringify({
    level,
    message,
    time: new Date().toISOString(),
    ...(fields ? (redact(fields) as Fields) : {}),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, fields?: Fields) => write("debug", message, fields),
  info: (message: string, fields?: Fields) => write("info", message, fields),
  warn: (message: string, fields?: Fields) => write("warn", message, fields),
  error: (message: string, fields?: Fields) => write("error", message, fields),
};
