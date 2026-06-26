/**
 * A minimal, pluggable logger interface — mirrors the tiagosiebler `DefaultLogger`
 * pattern so consumers can inject their own logger (pino, winston, console, ...).
 */
export interface DefaultLogger {
  /** Verbose/trace level — wire-level request/response detail. */
  trace: (...params: unknown[]) => void;
  info: (...params: unknown[]) => void;
  error: (...params: unknown[]) => void;
  warning: (...params: unknown[]) => void;
}

/**
 * Default logger that writes to the console. `trace` is silenced unless the
 * `DNSE_TRACE` environment variable is set, to avoid leaking signing material
 * into logs by default.
 */
export const DefaultLogger: DefaultLogger = {
  trace: (...params) => {
    if (typeof process !== 'undefined' && process.env?.DNSE_TRACE === 'true') {
      console.log('[dnse:trace]', ...params);
    }
  },
  info: (...params) => console.info('[dnse:info]', ...params),
  warning: (...params) => console.warn('[dnse:warn]', ...params),
  error: (...params) => console.error('[dnse:error]', ...params),
};
