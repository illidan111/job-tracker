import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'

export function Dialog({ title, description, children, onClose, className = '' }: {
  title: string; description?: string; children: ReactNode; onClose: () => void; className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  useEffect(() => {
    const dialog = ref.current
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog?.showModal()
    return () => { dialog?.close(); previousFocus?.focus() }
  }, [])
  return <dialog ref={ref} className={`dialog ${className}`} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="dialog-inner">
      <div className="dialog-heading">
        <div><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button>
      </div>
      {children}
    </div>
  </dialog>
}

export function ConfirmDialog({ title, description, confirmLabel, onConfirm, onClose, danger = true, error }: {
  title: string; description: string; confirmLabel: string; onConfirm: () => void | Promise<void>; onClose: () => void; danger?: boolean; error?: string | null
}) {
  const [busy, setBusy] = useState(false)
  return <Dialog title={title} description={description} onClose={() => { if (!busy) onClose() }} className="confirm-dialog">
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="dialog-actions"><Button variant="secondary" onClick={onClose} disabled={busy} autoFocus>Cancel</Button><Button disabled={busy} variant={danger ? 'danger' : 'primary'} onClick={async () => { setBusy(true); try { await onConfirm() } finally { setBusy(false) } }}>{busy ? 'Saving…' : confirmLabel}</Button></div>
  </Dialog>
}
