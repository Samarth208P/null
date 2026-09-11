import { StrictMode, Component, lazy, Suspense, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Developers } from './pages/Developers';
import { EntryLayout } from './components/EntryLayout';
import './styles.css';
import './soft-outline.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) { /* Deliberately no telemetry or secret-bearing error logs. */ }
  render() { return this.state.failed ? <EntryLayout><h1>We couldn’t open your workspace.</h1><p className="entry-description" role="alert">Reload to try again. Unsaved work will be lost. Any backup files you saved will stay on your device.</p><button className="button button-primary entry-continue" onClick={() => window.location.reload()}>Reload workspace</button></EntryLayout> : this.props.children; }
}
const ReferenceApp = lazy(() => import('./ReferenceApp'));
function Root() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => { const onHash = () => setHash(window.location.hash); window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash); }, []);
  if (['', '#/', '#/developers'].includes(hash)) return <Developers />;
  return <Suspense fallback={<EntryLayout><h1>Opening the reference app</h1><p role="status">Loading the payment integration…</p></EntryLayout>}><ReferenceApp /></Suspense>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><Root /></ErrorBoundary></StrictMode>);
