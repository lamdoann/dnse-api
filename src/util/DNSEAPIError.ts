/** Normalised error thrown when the DNSE API returns a non-2xx response. */
export class DNSEAPIError extends Error {
  /** HTTP status code, if the request reached the server. */
  public readonly status?: number;
  /** Parsed response body returned by the API. */
  public readonly body?: unknown;
  /** The request that triggered the error: `METHOD path`. */
  public readonly request?: string;

  constructor(
    message: string,
    opts: { status?: number; body?: unknown; request?: string } = {},
  ) {
    super(message);
    this.name = 'DNSEAPIError';
    this.status = opts.status;
    this.body = opts.body;
    this.request = opts.request;
    Object.setPrototypeOf(this, DNSEAPIError.prototype);
  }
}
