const API_BASE = "http://localhost:3001";
export const TENANT_ID = "seed-tenant-001";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `API error ${res.status}`);
  }
  return res.json();
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    body: formData,
  });
}
