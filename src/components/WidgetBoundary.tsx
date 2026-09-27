import { Component, type ReactNode } from 'react'
export class WidgetBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { console.error('A Waypoint chart could not be rendered') }
  render() { return this.state.failed ? <p role="alert">This chart could not be displayed. <button className="text-link" onClick={() => this.setState({ failed: false })}>Try again</button></p> : this.props.children }
}
