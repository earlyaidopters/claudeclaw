import {
  LayoutGrid, ListTodo, Users, MessageSquare,
  Brain, Network, Activity, ShieldCheck,
  Swords,
  Settings,
  TrendingUp,
  Send,
  Presentation,
  Store,
  Wallet,
  Crown,
} from 'lucide-preact';
import type { ComponentChildren } from 'preact';

export type RouteSection = 'workspace' | 'intelligence' | 'collaborate' | 'configure';

export interface RouteDef {
  path: string;
  label: string;
  section: RouteSection;
  icon: typeof LayoutGrid;
  shortcut?: string;
}

// Single source of truth for the sidebar, command palette, and router.
// Voices used to be a top-level item; it now lives under War Room as the
// "Voice config" sub-tab and is reachable via /warroom?mode=voices.
export const ROUTES: RouteDef[] = [
  { path: '/founder',    label: 'Founder Dashboard',section: 'workspace',   icon: Crown,         shortcut: 'g f' },
  { path: '/mission',    label: 'Mission Control', section: 'workspace',    icon: LayoutGrid,    shortcut: 'g m' },
  { path: '/scheduled',  label: 'Scheduled',       section: 'workspace',    icon: ListTodo,      shortcut: 'g s' },
  { path: '/agents',     label: 'Agents',          section: 'workspace',    icon: Users,         shortcut: 'g a' },
  { path: '/pipeline',   label: 'Sales Pipeline',  section: 'workspace',    icon: TrendingUp,    shortcut: 'g p' },
  { path: '/outreach',   label: 'Outreach Tracker',section: 'workspace',    icon: Send,          shortcut: 'g o' },
  { path: '/webinars',   label: 'Webinars',        section: 'workspace',    icon: Presentation,  shortcut: 'g b' },
  { path: '/members',    label: 'BID Members',     section: 'workspace',    icon: Store,         shortcut: 'g n' },
  { path: '/cash',       label: 'Cash',            section: 'workspace',    icon: Wallet,        shortcut: 'g $' },
  { path: '/chat',       label: 'Chat',            section: 'workspace',    icon: MessageSquare, shortcut: 'g c' },

  { path: '/memories',   label: 'Memories',        section: 'intelligence', icon: Brain,         shortcut: 'g e' },
  { path: '/hive',       label: 'Hive Mind',       section: 'intelligence', icon: Network,       shortcut: 'g h' },
  { path: '/usage',      label: 'Usage',           section: 'intelligence', icon: Activity,      shortcut: 'g u' },
  { path: '/audit',      label: 'Audit',           section: 'intelligence', icon: ShieldCheck                   },

  { path: '/warroom',    label: 'War Room',        section: 'collaborate',  icon: Swords,        shortcut: 'g w' },

  { path: '/settings',   label: 'Settings',        section: 'configure',    icon: Settings                  },
];

export const SECTION_LABEL: Record<RouteSection, string> = {
  workspace:    'Workspace',
  intelligence: 'Intelligence',
  collaborate:  'Collaborate',
  configure:    'Configure',
};

export const DEFAULT_ROUTE = '/founder';

// Lightly typed children helper for placeholder pages.
export type PageProps = { children?: ComponentChildren };
