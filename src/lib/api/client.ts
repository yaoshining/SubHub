import { AppError, type ApiErrorResponse } from "@/lib/errors";

type RequestOptions = RequestInit & {
  url?: string;
};

export async function subhubApiClient<TResponse>(
  url: string,
  options: RequestOptions = {},
): Promise<TResponse> {
  const response = await fetch(options.url ?? url, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
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
