import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, BookOpen, ChevronDown, Code2, Eye, EyeOff, HelpCircle, Inbox, LayoutDashboard, LockKeyhole, Menu, Plus, Send, Settings2, Shield, ShieldCheck, Wallet, X, type LucideIcon } from 'lucide-react';
import { useStore, type Route } from './lib/store';
import { Badge, Button } from './components/ui';
import { WalletConnection } from './components/WalletConnection';
import { Overview, Distributions } from './pages/Overview';
import { DistributionWizard } from './pages/DistributionWizard';
import { Treasury } from './pages/Treasury';
import { PrivateInbox, PrivateBalance } from './pages/Recipient';
import { Inspector, Protocol, Settings, About } from './pages/Workspace';

const navigation: { section: string; items: { route: Route; label: string; icon: LucideIcon }[] }[] = [
  { section: 'Workspace', items: [{ route: 'overview', label: 'Overview', icon: LayoutDashboard }, { route: 'treasury', label: 'Treasury', icon: Wallet }, { route: 'distributions', label: 'Distributions', icon: Send }] },
  { section: 'Personal', items: [{ route: 'inbox', label: 'Private inbox', icon: Inbox }, { route: 'balance', label: 'Private balance', icon: LockKeyhole }] },
  { section: 'Explore', items: [{ route: 'inspector', label: 'Privacy inspector', icon: ShieldCheck }, { route: 'protocol', label: 'Protocol', icon: Code2 }] },
];
const validRoutes = ['overview', 'distributions', 'new', 'treasury', 'inbox', 'balance', 'inspector', 'protocol', 'settings', 'about'];
function routeFromHash(): Route { const value = window.location.hash.replace(/^#\/?/, '').split('?')[0]; return (validRoutes.includes(value) ? value : 'overview') as Route; }

export function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [mobileOpen, setMobileOpen] = useState(false);
  const store = useStore();
  useEffect(() => { const onHash = () => { setRoute(routeFromHash()); setMobileOpen(false); window.scrollTo(0, 0); }; window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash); }, []);
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileOpen(false); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []);
  const title = route === 'new' ? 'New distribution' : route === 'about' ? 'About NULL' : route === 'settings' ? 'Settings' : navigation.flatMap(group => group.items).find(item => item.route === route)?.label;
  useEffect(() => { document.title = `${title} · NULL`; }, [title]);
  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to content</a>
    {mobileOpen && <button className="nav-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`} aria-label="Main navigation">
      <a className="brand" href="#/overview" aria-label="NULL overview"><span className="brand-symbol" /><span>NULL</span><span className="brand-version">beta</span></a>
      <button className="organization-switch" onClick={() => store.navigate('settings')}><span className="org-avatar">{store.organization.slice(0, 1).toUpperCase()}</span><span><strong>{store.organization}</strong><small>Organization workspace</small></span><ChevronDown size={14} /></button>
      <nav>{navigation.map(group => <div className="nav-group" key={group.section}><p>{group.section}</p>{group.items.map(item => <a key={item.route} href={`#/${item.route}`} className={`nav-item ${route === item.route || (route === 'new' && item.route === 'distributions') ? 'active' : ''}`} aria-current={route === item.route ? 'page' : undefined}><item.icon size={18} strokeWidth={1.7} /><span>{item.label}</span>{item.route === 'inbox' && store.distributions.some(item => item.status === 'Published locally') && <span className="nav-indicator" />}</a>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="private-space"><Shield size={17} /><div><strong>Private by design</strong><p>Your keys stay with you.</p></div></div><a href="#/settings" className={`nav-item ${route === 'settings' ? 'active' : ''}`}><Settings2 size={18} strokeWidth={1.7} /><span>Settings</span></a><a href="#/about" className="nav-item"><HelpCircle size={18} strokeWidth={1.7} /><span>About & help</span><ArrowUpRight size={13} /></a><div className="sidebar-footer"><span className="status-dot" />Local session<span>v0.1</span></div></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Open navigation" aria-expanded={mobileOpen}>{mobileOpen ? <X size={20} /> : <Menu size={20} />}</button><span className="topbar-workspace">Workspace</span><span className="topbar-slash">/</span><span>{title}</span></div><div className="topbar-actions"><label className="environment-select"><span className={`status-dot ${store.mode === 'sandbox' ? 'dot-amber' : 'dot-purple'}`} /><select value={store.mode} onChange={event => store.setMode(event.target.value as 'sandbox' | 'testnet')} aria-label="Workspace environment"><option value="sandbox">Local sandbox</option><option value="testnet">Sepolia</option></select><ChevronDown size={12} /></label><span className="topbar-divider" /><button className="icon-button balance-toggle" onClick={() => store.setHideBalances(!store.hideBalances)} aria-label={store.hideBalances ? 'Show private balances' : 'Hide private balances'}>{store.hideBalances ? <EyeOff size={17} /> : <Eye size={17} />}</button><WalletConnection /></div></header>
      <main id="main-content" className="main-content" tabIndex={-1}>
        {route === 'overview' && <Overview />}{route === 'distributions' && <Distributions />}{route === 'new' && <DistributionWizard key={`${store.editingId || 'new'}-${store.mode}`} />}{route === 'treasury' && <Treasury />}{route === 'inbox' && <PrivateInbox />}{route === 'balance' && <PrivateBalance />}{route === 'inspector' && <Inspector />}{route === 'protocol' && <Protocol />}{route === 'settings' && <Settings />}{route === 'about' && <About />}
        <footer className="content-footer"><span><span className="brand-symbol small" />NULL protocol</span><p>{store.mode === 'sandbox' ? 'Local sandbox · Sample funds · No onchain transactions' : 'Sepolia testnet · Hackathon prototype · Unaudited'}</p><a href="#/inspector">Privacy boundaries<ArrowUpRight size={12} /></a></footer>
      </main>
    </div>
  </div>;
}
