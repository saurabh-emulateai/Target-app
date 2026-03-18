import { getEnv } from "./env";
import { useAuthStore } from "../stores/authStore";

function resolveApiBaseUrl() {
  const configured = getEnv("VITE_API_BASE_URL");
  if (configured) return configured.replace(/\/$/, "");

  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:8000";
    }
    // Fallback for IP-based or other hostname access
    return `${window.location.protocol}//${hostname}:8000`;
  }

  throw new Error("Missing VITE_API_BASE_URL");
}

const API_BASE_URL = resolveApiBaseUrl();

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function parseJsonSafe(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getErrorDetail(body: unknown) {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = body.detail;
    return typeof detail === "string" ? detail : null;
  }
  return null;
}

export async function api<T>(
  path: string,
  opts: { method?: HttpMethod; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const token = useAuthStore.getState().token;
  const method = opts.method ?? "GET";

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.auth !== false && token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });

  if (!res.ok) {
    const body = await parseJsonSafe(res);
    const detail = getErrorDetail(body);
    throw new ApiError(detail || `Request failed (${res.status})`, res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
