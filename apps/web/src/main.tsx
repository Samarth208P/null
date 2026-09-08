import { StrictMode, Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { WalletProvider } from './components/WalletConnection';
import { EntryLayout } from './components/EntryLayout';
import './styles.css';
import './soft-outline.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) { /* Deliberately no telemetry or secret-bearing error logs. */ }
  render() { return this.state.failed ? <EntryLayout><h1>We couldn’t open your workspace.</h1><p className="entry-description" role="alert">Reload to try again. Unsaved work will be lost. Any backup files you saved will stay on your device.</p><button className="button button-primary entry-continue" onClick={() => window.location.reload()}>Reload workspace</button></EntryLayout> : this.props.children; }
}
createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><WalletProvider><App /></WalletProvider></ErrorBoundary></StrictMode>);
