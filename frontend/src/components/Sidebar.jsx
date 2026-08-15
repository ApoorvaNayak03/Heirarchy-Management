import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, GitBranch, Layers, Settings, Hammer, ShieldCheck, ChevronDown, LogOut,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const nav = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  {
    label: 'Hierarchy Management',
    icon: Layers,
    children: [
      { label: 'Hierarchy Types', to: '/hierarchy-types' },
      { label: 'Hierarchies', to: '/hierarchies' },
      { label: 'Versions', to: '/versions' },
      { label: 'Node Types', to: '/node-types' },
    ],
  },
  {
    label: 'Configuration',
    icon: Settings,
    children: [
      { label: 'Property Definitions', to: '/property-definitions' },
      { label: 'Structural Rules', to: '/structural-rules' },
    ],
  },
  {
    label: 'Workspace',
    icon: Hammer,
    children: [
      { label: 'Hierarchy Builder', to: '/builder' },
      { label: 'Validation', to: '/validation' },
      { label: 'Compare Versions', to: '/compare' },
    ],
  },
  {
    label: 'Governance',
    icon: ShieldCheck,
    children: [
      { label: 'Approval Requests', to: '/approvals' },
      { label: 'Audit Trail', to: '/audit' },
      { label: 'Lineage', to: '/lineage' },
    ],
  },
];

export default function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-2 text-blue-700">
          <GitBranch size={20} />
          <span className="font-semibold">SCM Hierarchy</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">Management Platform</p>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {nav.map((section) => (
          <div key={section.label} className="mb-4">
            <div className="mb-1 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {section.icon && <section.icon size={14} />}
              {section.label}
            </div>
            {(section.children || [{ label: section.label, to: section.to }]).map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`mb-0.5 block rounded-lg px-3 py-2 text-sm ${
                  location.pathname === item.to ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-4">
        <div className="text-sm font-medium text-slate-800">{user?.display_name}</div>
        <div className="text-xs text-slate-500">{user?.role}</div>
        <button type="button" onClick={logout} className="mt-2 flex items-center gap-1 text-xs text-slate-500 hover:text-red-600">
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </aside>
  );
}
