import { Route, Switch, Redirect } from 'wouter-preact';
import { Menu } from 'lucide-preact';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';
import { ToastStack } from '@/components/ToastStack';
import { sidebarOpen, closeSidebar } from '@/lib/sidebar';
import { Placeholder } from '@/pages/Placeholder';
import { MissionControl } from '@/pages/MissionControl';
import { Memories } from '@/pages/Memories';
import { HiveMind } from '@/pages/HiveMind';
import { Agents } from '@/pages/Agents';
import { Scheduled } from '@/pages/Scheduled';
import { Audit } from '@/pages/Audit';
import { Usage } from '@/pages/Usage';
import { Settings } from '@/pages/Settings';
import { Voices } from '@/pages/Voices';
import { Chat } from '@/pages/Chat';
import { WarRoom } from '@/pages/WarRoom';
import { AgentFiles } from '@/pages/AgentFiles';
import { DEFAULT_ROUTE } from '@/lib/routes';

export function App() {
  const open = sidebarOpen.value;
  return (
    <div class="flex h-screen h-[100dvh] bg-[var(--color-bg)] text-[var(--color-text)]">
      {/* Mobile-only hamburger. Hidden on >=md where the sidebar is
       *  always inline. */}
      <button
        type="button"
        onClick={() => { sidebarOpen.value = true; }}
        class="md:hidden fixed top-3 left-3 z-50 p-2 rounded-md bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-text)] shadow-md"
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>

      {/* Backdrop when the mobile drawer is open. Tapping it closes. */}
      {open && (
        <div
          class="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={closeSidebar}
        />
      )}

      <Sidebar />
      <main class="flex-1 min-w-0 overflow-hidden pl-12 md:pl-0">
        <Switch>
          <Route path="/mission"><MissionControl /></Route>
          <Route path="/scheduled"><Scheduled /></Route>
          <Route path="/agents"><Agents /></Route>
          <Route path="/agents/:id/files"><AgentFiles /></Route>
          <Route path="/chat"><Chat /></Route>
          <Route path="/memories"><Memories /></Route>
          <Route path="/hive"><HiveMind /></Route>
          <Route path="/usage"><Usage /></Route>
          <Route path="/audit"><Audit /></Route>
          <Route path="/warroom"><WarRoom /></Route>
          <Route path="/voices"><Voices /></Route>
          <Route path="/settings"><Settings /></Route>

          {/* Common alt slugs that used to point at placeholder pages */}
          <Route path="/hive-mind"><Redirect to="/hive" /></Route>
          <Route path="/hivemind"><Redirect to="/hive" /></Route>
          <Route path="/memory"><Redirect to="/memories" /></Route>

          <Route path="/"><Redirect to={DEFAULT_ROUTE} /></Route>
          <Route>
            <Placeholder
              title="Not found"
              description="This page does not exist. Use ⌘K to jump somewhere."
              hideRoadmapNote
            />
          </Route>
        </Switch>
      </main>
      <CommandPalette />
      <ToastStack />
    </div>
  );
}
