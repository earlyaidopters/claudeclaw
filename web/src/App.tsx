import { Route, Switch, Redirect } from 'wouter-preact';
import { lazy, Suspense } from 'preact/compat';
import { Menu } from 'lucide-preact';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';
import { ToastStack } from '@/components/ToastStack';
import { sidebarOpen, closeSidebar } from '@/lib/sidebar';
import { Placeholder } from '@/pages/Placeholder';
import { DEFAULT_ROUTE } from '@/lib/routes';

// Lazy-load every page so the initial bundle stays small. Each page
// becomes its own chunk and is fetched on first navigation.
const MissionControl = lazy(() => import('@/pages/MissionControl').then(m => ({ default: m.MissionControl })));
const Memories       = lazy(() => import('@/pages/Memories').then(m => ({ default: m.Memories })));
const HiveMind       = lazy(() => import('@/pages/HiveMind').then(m => ({ default: m.HiveMind })));
const Agents         = lazy(() => import('@/pages/Agents').then(m => ({ default: m.Agents })));
const Pipeline       = lazy(() => import('@/pages/Pipeline').then(m => ({ default: m.Pipeline })));
const Outreach       = lazy(() => import('@/pages/Outreach').then(m => ({ default: m.Outreach })));
const Webinars       = lazy(() => import('@/pages/Webinars').then(m => ({ default: m.Webinars })));
const Members        = lazy(() => import('@/pages/Members').then(m => ({ default: m.Members })));
const Cash           = lazy(() => import('@/pages/Cash').then(m => ({ default: m.Cash })));
const Founder        = lazy(() => import('@/pages/Founder').then(m => ({ default: m.Founder })));
const Scheduled      = lazy(() => import('@/pages/Scheduled').then(m => ({ default: m.Scheduled })));
const Audit          = lazy(() => import('@/pages/Audit').then(m => ({ default: m.Audit })));
const Usage          = lazy(() => import('@/pages/Usage').then(m => ({ default: m.Usage })));
const Settings       = lazy(() => import('@/pages/Settings').then(m => ({ default: m.Settings })));
const Voices         = lazy(() => import('@/pages/Voices').then(m => ({ default: m.Voices })));
const Chat           = lazy(() => import('@/pages/Chat').then(m => ({ default: m.Chat })));
const WarRoom        = lazy(() => import('@/pages/WarRoom').then(m => ({ default: m.WarRoom })));
const AgentFiles     = lazy(() => import('@/pages/AgentFiles').then(m => ({ default: m.AgentFiles })));

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
        <Suspense fallback={null}>
        <Switch>
          <Route path="/founder"><Founder /></Route>
          <Route path="/mission"><MissionControl /></Route>
          <Route path="/scheduled"><Scheduled /></Route>
          <Route path="/agents"><Agents /></Route>
          <Route path="/agents/:id/files"><AgentFiles /></Route>
          <Route path="/pipeline"><Pipeline /></Route>
          <Route path="/outreach"><Outreach /></Route>
          <Route path="/webinars"><Webinars /></Route>
          <Route path="/members"><Members /></Route>
          <Route path="/cash"><Cash /></Route>
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
        </Suspense>
      </main>
      <CommandPalette />
      <ToastStack />
    </div>
  );
}
