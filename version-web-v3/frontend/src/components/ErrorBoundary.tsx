import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
          <h2 style={{ color: '#e74c3c', marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ fontSize: '.85rem' }}>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false }) }
            style={{ marginTop: 12, padding: '8px 20px', background: '#1a7a5a', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
