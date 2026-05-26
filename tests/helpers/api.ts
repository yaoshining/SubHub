export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export function createApiRequest(
  path: string,
  init: RequestInit & { json?: JsonValue } = {}
) {
  const headers = new Headers(init.headers);
  let body = init.body;

  if (init.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  }

  return new Request(new URL(path, "http://localhost:3000"), {
    ...init,
    headers,
    body
  });
}

export async function readJsonResponse<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
