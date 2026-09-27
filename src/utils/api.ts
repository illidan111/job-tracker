export class RequestError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}
export async function api<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response
  try { response = await fetch(`/api${path}`, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) }) }
  catch { throw new RequestError(0, 'We couldn’t reach your workspace. Check your connection and try again.') }
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null
    throw new RequestError(response.status, data?.error ?? 'Something went wrong. Please try again.')
  }
  return response.status === 204 ? undefined as T : await response.json() as T
}
