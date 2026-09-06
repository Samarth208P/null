import { StrictMode, Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './lib/store';
import { WalletProvider } from './components/WalletConnection';
import './styles.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) { /* Deliberately no telemetry or secret-bearing error logs. */ }
  render() { return this.state.failed ? <main className="fatal-error"><span className="wordmark">NULL</span><h1>This workspace could not open.</h1><p>Reload to start a new local session. Your encrypted recovery files remain on your device.</p><button className="button button-primary" onClick={() => window.location.reload()}>Reload workspace</button></main> : this.props.children; }
}
createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><WalletProvider><StoreProvider><App /></StoreProvider></WalletProvider></ErrorBoundary></StrictMode>);
