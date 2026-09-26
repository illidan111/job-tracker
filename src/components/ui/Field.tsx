import { useId } from 'react'
import type { ReactNode } from 'react'

export function Field({ label, error, hint, children, className = '' }: {
  label: string; error?: string; hint?: string; children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode; className?: string
}) {
  const id = useId()
  return <div className={`field ${className}`}>
    <label htmlFor={id}>{label}</label>
    {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': error || hint ? `${id}-help` : undefined })}
    {(error || hint) && <p id={`${id}-help`} className={error ? 'field-error' : 'field-hint'}>{error || hint}</p>}
  </div>
}
