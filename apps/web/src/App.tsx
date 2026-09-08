import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Eye, EyeOff, HelpCircle, Inbox, LayoutDashboard, LockKeyhole, Menu, Send, Settings2, Wallet, X, type LucideIcon } from 'lucide-react';
import { Logo } from './components/Logo';
import { StoreProvider, useStore, type Route } from './lib/store';
import { useSession } from './lib/session';
import { AccountProvider, useAccount } from './lib/account';
import { resolveRoute } from './lib/account-profile';
import { WalletConnection } from './components/WalletConnection';
import { SignIn, ChooseAccount } from './components/Onboarding';
import { Overview, Distributions } from './pages/Overview';
import { DistributionWizard } from './pages/DistributionWizard';
import { Treasury } from './pages/Treasury';
import { PrivateInbox, PrivateBalance } from './pages/Recipient';
import { Inspector, Protocol, Settings, About } from './pages/Workspace';

type NavItem = { route: Route; label: string; icon: LucideIcon };
const organizationNavigation: NavItem[] = [{ route: 'overview', label: 'Overview', icon: LayoutDashboard }, { route: 'distributions', label: 'Payments', icon: Send }, { route: 'treasury', label: 'Funds', icon: Wallet }];
const individualNavigation: NavItem[] = [{ route: 'inbox', label: 'Inbox', icon: Inbox }, { route: 'balance', label: 'Balance', icon: LockKeyhole }];
const extraTitles: Partial<Record<Route, string>> = { new: 'New payment', settings: 'Settings', about: 'Help', inspector: 'Advanced privacy details', protocol: 'Connection status' };

export function App() {
  const session = useSession();
  if (!session.ready || !session.authenticated || !session.userId) return <SignIn />;
  // Private state is created only after authentication and disposed on account change.
  return <AccountProvider key={session.userId} userId={session.userId}><StoreProvider><AccountFlow /></StoreProvider></AccountProvider>;
}
function AccountFlow() {
  const account = useAccount();
  return !account.profile || account.choosingType ? <ChooseAccount /> : <WorkspaceApp />;
}
function WorkspaceApp() {
  const { profile, storageWarning, changeAccountType } = useAccount(); const store = useStore();
  const [hash, setHash] = useState(window.location.hash); const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileViewport, setMobileViewport] = useState(() => !window.matchMedia('(min-width: 761px)').matches);
  const menuButton = useRef<HTMLButtonElement>(null); const sidebar = useRef<HTMLElement>(null);
  const type = profile!.type;
  const navigation = type === 'organization' ? organizationNavigation : individualNavigation;
  const route = resolveRoute(hash, type);
  const title = extraTitles[route] || navigation.find(item => item.route === route)?.label || 'Workspace';
  const home = type === 'organization' ? 'overview' : 'inbox';
  useEffect(() => {
    const onHash = () => { setHash(window.location.hash); setMobileOpen(false); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (window.location.hash !== `#/${route}`) window.history.replaceState(null, '', `#/${route}`);
    document.title = `${title} · NULL`; document.getElementById('main-content')?.focus({ preventScroll: true });
  }, [route, title, hash]);
  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    // Let the browser finish moving focus out of the newly inert workspace first.
    const focusFrame = requestAnimationFrame(() => sidebar.current?.querySelector<HTMLAnchorElement>('a')?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMobileOpen(false); menuButton.current?.focus(); }
      if (event.key === 'Tab') {
        const items = sidebar.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)');
        if (!items?.length) return;
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(focusFrame); document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKey); menuButton.current?.focus(); };
  }, [mobileOpen]);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 761px)');
    const closeOnDesktop = () => { setMobileViewport(!desktop.matches); if (desktop.matches) setMobileOpen(false); };
    desktop.addEventListener('change', closeOnDesktop); return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);
  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to content</a>
    {mobileOpen && <button className="nav-backdrop" onClick={() => { setMobileOpen(false); menuButton.current?.focus(); }} aria-label="Close navigation" />}
    <aside ref={sidebar} className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`} inert={mobileViewport && !mobileOpen || undefined} aria-label="Main navigation" id="workspace-navigation">
      <div className="sidebar-brand-row"><a className="brand" href={`#/${home}`} aria-label="NULL home"><Logo size={28} className="brand-logo" /><span>NULL</span></a><button className="icon-button mobile-menu" onClick={() => { setMobileOpen(false); menuButton.current?.focus(); }} aria-label="Close navigation"><X size={20} /></button></div>
      <button className="organization-switch" onClick={changeAccountType} aria-label="Change account type" title="Change account type"><span className="org-avatar">{type === 'organization' ? store.organization.slice(0, 1).toUpperCase() : <LockKeyhole size={15} />}</span><span><strong>{type === 'organization' ? store.organization : 'My workspace'}</strong><small>{type === 'organization' ? 'Organization' : 'Individual'} · Change type</small></span><ArrowLeftRight size={14} /></button>
      <nav className="primary-navigation">{navigation.map(item => <a key={item.route} href={`#/${item.route}`} className={`nav-item ${route === item.route || route === 'new' && item.route === 'distributions' ? 'active' : ''}`} aria-current={route === item.route || route === 'new' && item.route === 'distributions' ? 'page' : undefined}><item.icon size={18} strokeWidth={1.7} /><span>{item.label}</span></a>)}</nav>
      <div className="sidebar-bottom"><a href="#/settings" className={`nav-item ${route === 'settings' ? 'active' : ''}`} aria-current={route === 'settings' ? 'page' : undefined}><Settings2 size={18} strokeWidth={1.7} /><span>Settings</span></a><a href="#/about" className={`nav-item ${['about', 'inspector', 'protocol'].includes(route) ? 'active' : ''}`} aria-current={route === 'about' ? 'page' : undefined}><HelpCircle size={18} strokeWidth={1.7} /><span>Help</span></a><div className="sidebar-footer"><LockKeyhole size={12} /><span>Private payments</span></div></div>
    </aside>
    <div className="workspace" inert={mobileOpen || undefined}>
      <header className="topbar"><div className="topbar-left"><button ref={menuButton} className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="workspace-navigation"><Menu size={20} /></button><span>{title}</span></div><div className="topbar-actions"><button className="icon-button balance-toggle" onClick={() => store.setHideBalances(!store.hideBalances)} aria-pressed={store.hideBalances} title={store.hideBalances ? 'Show balances' : 'Hide balances'} aria-label={store.hideBalances ? 'Show balances' : 'Hide balances'}>{store.hideBalances ? <EyeOff size={17} /> : <Eye size={17} />}</button><WalletConnection /></div></header>
      <main id="main-content" className="main-content" tabIndex={-1}>
        {storageWarning && <p className="form-error" role="status">{storageWarning}</p>}
        {route === 'overview' && <Overview />}{route === 'distributions' && <Distributions />}{route === 'new' && <DistributionWizard key={`${store.editingId || 'new'}-${store.mode}`} />}{route === 'treasury' && <Treasury />}{route === 'inbox' && <PrivateInbox />}{route === 'balance' && <PrivateBalance />}{route === 'inspector' && <Inspector />}{route === 'protocol' && <Protocol />}{route === 'settings' && <Settings />}{route === 'about' && <About />}
        <footer className="content-footer"><span><Logo size={14} className="brand-logo footer-logo" />NULL</span><p>{store.mode === 'sandbox' ? 'Practice mode · No real money' : 'Early version · Test money only'}</p></footer>
      </main>
    </div>
  </div>;
}
