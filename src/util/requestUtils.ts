/**
 * Serialise a params object into a query string with stable key ordering.
 * `undefined` / `null` values are dropped. The result does NOT include a
 * leading `?`.
 */
export function serialiseParams(
  params?: Record<string, unknown>,
  sortKeys = false,
): string {
  if (!params) {
    return '';
  }

  let keys = Object.keys(params).filter((k) => {
    const v = params[k];
    return v !== undefined && v !== null && v !== '';
  });

  if (sortKeys) {
    keys = keys.sort();
  }

  return keys
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`)
    .join('&');
}

/** Append a serialised query string to a path, handling the `?` join. */
export function appendQuery(path: string, query: string): string {
  if (!query) {
    return path;
  }
  return path.includes('?') ? `${path}&${query}` : `${path}?${query}`;
}

/** Substitute `{name}` placeholders in a path template with URL-encoded values. */
export function fillPathParams(
  template: string,
  params: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined || value === null) {
      throw new Error(`Missing path parameter "${name}" for "${template}"`);
    }
    return encodeURIComponent(String(value));
  });
}
