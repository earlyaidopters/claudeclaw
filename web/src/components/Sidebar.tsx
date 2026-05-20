import { Link, useLocation } from 'wouter-preact';
import { Search, ChevronDown, X } from 'lucide-preact';
import { ROUTES, SECTION_LABEL, type RouteSection } from '@/lib/routes';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { commandPaletteOpen } from '@/lib/command-palette';
import { chatUnread } from '@/lib/chat-stream';
import { useFetch } from '@/lib/useFetch';
import { sidebarOpen, closeSidebar } from '@/lib/sidebar';
import {
  collapsedSections,
  toggleSectionCollapsed,
  workspaceName,
  modKeyLabel,
} from '@/lib/personalization';

const SECTIONS: RouteSection[] = ['workspace', 'intelligence', 'collaborate', 'configure'];

export function Sidebar() {
  const [pathname] = useLocation();
  const collapsed = collapsedSections.value;
  const modLabel = modKeyLabel();
  const open = sidebarOpen.value;

  // Mobile: fixed drawer that slides in from the left. Desktop (>=md):
  // always-visible inline column. Tailwind's `md:` prefix flips between
  // the two without extra JS.
  const asideClass = [
    'flex flex-col h-screen w-[280px] bg-[var(--color-sidebar)] border-r border-[var(--color-border)]',
    'fixed inset-y-0 left-0 z-50 transform transition-transform duration-200',
    open ? 'translate-x-0' : '-translate-x-full',
    'md:static md:translate-x-0 md:w-[260px] md:shrink-0',
  ].join(' ');

  return (
    <aside class={asideClass}>
      <WorkspaceSwitcher />

      {/* Mobile-only close button. Inline-flex with absolute position so
       *  it doesn't disturb the existing header layout. */}
      <button
        type="button"
        onClick={closeSidebar}
        class="md:hidden absolute top-3 right-3 p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)] transition-colors"
        aria-label="Close menu"
      >
        <X size={16} />
      </button>

      <button
        type="button"
        onClick={() => { commandPaletteOpen.value = true; closeSidebar(); }}
        class="mx-3 mt-1 mb-2 flex items-center gap-2 px-3 py-2 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)] transition-colors text-[13px]"
      >
        <Search size={15} />
        <span>Search</span>
        <span class="ml-auto text-[10.5px] text-[var(--color-text-faint)]">{modLabel}K</span>
      </button>

      <nav class="flex-1 overflow-y-auto px-2 pb-3">
        {SECTIONS.map((section) => {
          const items = ROUTES.filter((r) => r.section === section);
          if (items.length === 0) return null;
          const isCollapsed = collapsed.has(section);
          return (
            <div key={section} class="mt-3 first:mt-1">
              <button
                type="button"
                onClick={() => toggleSectionCollapsed(section)}
                class="w-full flex items-center gap-1.5 px-2.5 py-1.5 section-label hover:text-[var(--color-text-muted)] transition-colors group"
                aria-expanded={!isCollapsed}
              >
                <ChevronDown
                  size={11}
                  class="text-[var(--color-text-faint)] transition-transform"
                  style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                />
                <span>{SECTION_LABEL[section]}</span>
              </button>
              {!isCollapsed && items.map((r) => {
                const active = pathname === r.path || (pathname === '/' && r.path === '/mission');
                const Icon = r.icon;
                const unread = r.path === '/chat' ? chatUnread.value : 0;
                return (
                  <Link
                    key={r.path}
                    href={r.path}
                    onClick={closeSidebar}
                    class={[
                      'flex items-center gap-2.5 px-3 py-2 rounded-md text-[14px] transition-colors',
                      active
                        ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)]',
                    ].join(' ')}
                  >
                    <Icon size={16} />
                    <span class="flex-1">{r.label}</span>
                    {unread > 0 && (
                      <span class="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10.5px] font-semibold tabular-nums bg-[var(--color-accent)] text-white">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <SidebarFooter />
    </aside>
  );
}

interface Health { killSwitches: Record<string, boolean>; }

function SidebarFooter() {
  const { data } = useFetch<Health>('/api/health', 30_000);
  const switches = data?.killSwitches || {};
  const off = Object.entries(switches).filter(([, on]) => !on);
  const anyOff = off.length > 0;
  const name = workspaceName.value;
  return (
    <Link
      href="/settings"
      class="px-3 py-3 border-t border-[var(--color-border)] text-[12px] text-[var(--color-text-faint)] hover:bg-[var(--color-elevated)] transition-colors"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="w-7 h-7 rounded-full flex items-center justify-center text-[var(--color-text-muted)]"
          style={{
            backgroundColor: anyOff
              ? 'color-mix(in srgb, var(--color-status-failed) 18%, transparent)'
              : 'var(--color-elevated)',
            color: anyOff ? 'var(--color-status-failed)' : 'var(--color-text-muted)',
          }}
        >
          ●
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-[var(--color-text)] text-[12.5px] font-medium truncate">{name}</div>
          <div class="truncate text-[11px]">
            {anyOff
              ? off.length + ' kill switch' + (off.length === 1 ? '' : 'es') + ' off'
              : 'All systems normal'}
          </div>
        </div>
      </div>
    </Link>
  );
}
