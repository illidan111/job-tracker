import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ConfirmDialog, Dialog } from './Dialog'

export function DraftDialog({ title, dirty, pending, onClose, children }: { title: string; dirty: boolean; pending: boolean; onClose: () => void; children: ReactNode | ((close: () => void) => ReactNode) }) {
  const [discard, setDiscard] = useState(false)
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  const close = () => { if (!pending) { if (dirty) setDiscard(true); else onClose() } }
  return <><Dialog title={title} className="application-dialog" onClose={close}>{typeof children === 'function' ? children(close) : children}</Dialog>{discard && <ConfirmDialog title="Discard your changes?" description="Your unsaved changes will be lost." confirmLabel="Discard changes" onClose={() => setDiscard(false)} onConfirm={onClose} />}</>
}
