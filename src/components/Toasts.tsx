import { CheckCircle2, X } from 'lucide-react'
import { useUI } from '../state/useUI'
export function Toasts() {
  const toasts = useUI(state => state.toasts)
  const dismiss = useUI(state => state.dismissToast)
  return <div className="toast-region" role="status" aria-live="polite" aria-atomic="false">{toasts.map(toast => <div className="toast" key={toast.id}><CheckCircle2 size={19} /><span>{toast.message}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => dismiss(toast.id)}><X size={16} /></button></div>)}</div>
}
