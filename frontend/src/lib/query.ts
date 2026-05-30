type QueryValue = boolean | number | string | null | undefined;

export function buildQueryString(params: Record<string, QueryValue>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") {
      continue;
    }

    query.set(key, String(value));
  }

  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}
