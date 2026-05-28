import { AppError, type ApiErrorResponse } from "@/lib/errors";

type RequestOptions = RequestInit & {
  url?: string;
};

export async function subhubApiClient<TResponse>(
  url: string,
  options: RequestOptions = {},
): Promise<TResponse> {
  const {
    url: overrideUrl,
    headers: requestHeaders,
    body,
    ...requestInit
  } = options;
  const headers = new Headers(requestHeaders);
  const method = (requestInit.method ?? "GET").toUpperCase();
  const cache =
    requestInit.cache ??
    (method === "GET" || method === "HEAD" ? "no-store" : undefined);

  if (
    body != null &&
    !headers.has("Content-Type") &&
    !(body instanceof Blob) &&
    !(body instanceof FormData) &&
    !(body instanceof URLSearchParams)
  ) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(overrideUrl ?? url, {
    credentials: "include",
    ...requestInit,
    cache,
    method,
    body,
    headers,
  });

  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => null)) as ApiErrorResponse | null;
    if (payload?.error) {
      throw new AppError(
        payload.error.code,
        payload.error.message,
        payload.error.target,
      );
    }
    throw new AppError("UPSTREAM_FAILED", `请求失败：${response.status}`);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}
