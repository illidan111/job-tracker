import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Waypoint encountered an error', error, info.componentStack) }
  render() {
    return this.state.failed ? <main className="fatal-error"><h1>Let’s get you back on track.</h1><p>Something unexpected happened. Your saved applications are still saved to your account.</p><button className="button button-primary" onClick={() => window.location.reload()}>Reload workspace</button></main> : this.props.children
  }
}
