import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, Sprout } from 'lucide-react'
import { useWorkspace } from '../state/useWorkspace'
import { useAppearance } from '../hooks/useAppearance'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'

export default function Auth({ signup = false }: { signup?: boolean }) {
  useAppearance()
  const location = useLocation()
  const pending = useWorkspace(state => state.pending), error = useWorkspace(state => state.authError)
  const authenticate = useWorkspace(state => state.authenticate)
  const [visible, setVisible] = useState(false)
  useEffect(() => { document.title = `${signup ? 'Create account' : 'Sign in'} — Waypoint` }, [signup])
  return <main className="auth-shell">
    <section className="auth-story"><Link to="/login" className="brand" aria-label="Waypoint home"><span className="brand-mark"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="m10 12 5 17 5-11 5 11 5-17" /></svg></span><span>waypoint<span className="brand-dot">.</span></span></Link><div><span className="auth-eyebrow">A LITTLE PROGRESS, EVERY DAY</span><h1>Your next chapter<br />starts with a step.</h1><p>A calm place for every opportunity, conversation, and possibility along the way.</p><div className="auth-journey" aria-hidden="true"><span><i />Find your next possibility</span><span><i />Keep the conversation moving</span><span><i />Make your next move</span></div></div><p className="auth-footnote"><Sprout size={18} />Made for your next chapter.</p></section>
    <section className="auth-form-section"><div className="auth-form-wrap"><span className="eyebrow">YOUR PERSONAL WORKSPACE</span><h2>{signup ? 'Make room for what’s next.' : 'Welcome back.'}</h2><p>{signup ? 'Create an account to start tracking your next opportunity.' : 'A fresh perspective on your next opportunity awaits.'}</p>
      <form key={signup ? 'signup' : 'login'} onSubmit={async event => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        await authenticate(signup ? 'signup' : 'login', { email: String(data.get('email')).trim(), password: String(data.get('password')), ...(signup ? { name: String(data.get('name')).trim() } : {}) })
      }}>
        {signup && <Field label="Full name">{props => <input {...props} name="name" autoComplete="name" required maxLength={80} autoFocus />}</Field>}
        <Field label="Email address">{props => <input {...props} name="email" type="email" autoComplete="email" required maxLength={254} autoFocus={!signup} />}</Field>
        <Field label="Password" hint={signup ? 'Use at least 12 characters. A few memorable words work well.' : undefined}>{props => <div className="password-field"><input {...props} name="password" type={visible ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? 12 : 1} maxLength={128} /><button type="button" className="icon-button" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>}</Field>
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" disabled={pending}>{pending ? 'One moment…' : signup ? 'Create your account' : 'Sign in'}{!pending && <ArrowRight size={17} />}</Button>
      </form>
      <p className="auth-switch">{signup ? 'Already have a workspace?' : 'New to Waypoint?'} <Link to={signup ? '/login' : '/signup'} state={location.state} onClick={() => useWorkspace.setState({ authError: null })}>{signup ? 'Sign in' : 'Create an account'}</Link></p>
      <p className="auth-note">Your applications, saved to your account.<br />Pick up where you left off.</p>
    </div></section>
  </main>
}
