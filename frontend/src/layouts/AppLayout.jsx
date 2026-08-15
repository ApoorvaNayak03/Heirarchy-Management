import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/ui/Button';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isWorkspace = location.pathname.startsWith('/hierarchies/');
  const isFullBleed = isWorkspace || location.pathname === '/new';

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <header className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className={`flex h-12 items-center justify-between px-4 ${isFullBleed ? '' : 'mx-auto max-w-6xl'}`}>
          <div className="flex items-center gap-6">
            <Link to="/" className="text-sm font-semibold tracking-tight text-[var(--color-text)]">
              SCM Hierarchy
            </Link>
            {!isFullBleed && (
              <nav className="hidden text-[13px] text-[var(--color-text-secondary)] sm:block">
                Master Data Governance
              </nav>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-[13px] text-[var(--color-text-secondary)] sm:inline">
              {user?.display_name}
              <span className="mx-1.5 text-[var(--color-text-muted)]">·</span>
              {user?.role}
            </span>
            <Button variant="ghost" size="sm" onClick={logout}>Sign out</Button>
          </div>
        </div>
      </header>

      <main className={`flex-1 ${isFullBleed ? '' : 'mx-auto w-full max-w-6xl px-4 py-6'}`}>
        <Outlet />
      </main>
    </div>
  );
}
