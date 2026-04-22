type LogMethod = (...args: unknown[]) => void;

const noop: LogMethod = () => {};

const shouldEnableDebug =
  process.env.NODE_ENV !== "production" || process.env.WEIXIN_DEBUG === "1";

const safeLog =
  (fn: LogMethod): LogMethod =>
  (...args) => {
    try {
      fn(...args);
    } catch {
      // Avoid logger implementation affecting main flow
    }
  };

export const logger = {
  debug: shouldEnableDebug ? safeLog(console.debug.bind(console)) : noop,
  info: safeLog(console.info.bind(console)),
  warn: safeLog(console.warn.bind(console)),
  error: safeLog(console.error.bind(console)),
};
