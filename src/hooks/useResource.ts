import { useEffect, useRef, useState } from 'react'
import { api, RequestError } from '../utils/api'
import { useWorkspace } from '../state/useWorkspace'
import { useQueryRevision } from '../state/queryRevision'

export function useDebounced<T>(value: T, delay = 250) {
  const [settled, setSettled] = useState(value)
  useEffect(() => { const timer = setTimeout(() => setSettled(value), delay); return () => clearTimeout(timer) }, [value, delay])
  return settled
}

export function useResource<T>(path: string | null) {
  const owner = useWorkspace(state => state.user?.id)
  const revision = useQueryRevision(state => state.revision)
  const key = `${owner}:${path}`
  const [result, setResult] = useState<{ key: string; data?: T; error?: string }>({ key: '' })
  useEffect(() => {
    if (!owner || !path) return
    const controller = new AbortController()
    void api<T>(path, 'GET', undefined, controller.signal).then(data => {
      if (!controller.signal.aborted && useWorkspace.getState().user?.id === owner) setResult({ key, data })
    }).catch((error: unknown) => {
      if (controller.signal.aborted || useWorkspace.getState().user?.id !== owner) return
      if (error instanceof RequestError && error.status === 401) useWorkspace.getState().sessionExpired(error.message)
      setResult({ key, error: error instanceof Error ? error.message : 'Unable to load this view. Try again.' })
    })
    return () => controller.abort()
  }, [owner, path, key, revision])
  const current = result.key === key ? result : undefined
  return { data: current?.data, error: current?.error, loading: Boolean(path && !current), retry: useQueryRevision.getState().invalidate }
}

export function useMutation() {
  const saving = useRef(false)
  const [pending, setPending] = useState(false), [error, setError] = useState('')
  const save = async <T,>(path: string, method: string, input?: unknown, applicationId?: string): Promise<T | undefined> => {
    if (saving.current) return undefined
    saving.current = true
    const owner = useWorkspace.getState().user?.id
    setPending(true); setError('')
    try {
      const data = await api<T>(path, method, input)
      if (owner !== useWorkspace.getState().user?.id) return undefined
      if (applicationId) await useWorkspace.getState().loadApplication(applicationId)
      useQueryRevision.getState().invalidate()
      return (data ?? true) as T
    } catch (failure) {
      if (owner !== useWorkspace.getState().user?.id) return undefined
      if (failure instanceof RequestError && failure.status === 401) useWorkspace.getState().sessionExpired(failure.message)
      setError(failure instanceof Error ? failure.message : 'Your change could not be saved. Try again.')
      return undefined
    } finally { saving.current = false; setPending(false) }
  }
  return { save, pending, error }
}
