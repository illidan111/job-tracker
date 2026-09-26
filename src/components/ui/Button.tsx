import type { ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}
export function Button({ variant = 'primary', size = 'md', className = '', ...props }: Props) {
  return <button className={`button button-${variant} button-${size} ${className}`} {...props} />
}
