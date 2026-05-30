import { appConfig } from "./env";

type ApiRequestOptions = RequestInit & {
  token?: string;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiRequest<TResponse>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<TResponse> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `Erro na requisicao: ${response.status}`;

    try {
      const data = (await response.json()) as { detail?: unknown };

      if (typeof data.detail === "string") {
        message = data.detail;
      }
    } catch {
      // Keep the status-based fallback when the server does not return JSON.
    }

    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return response.json() as Promise<TResponse>;
}
