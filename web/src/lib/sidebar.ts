import { signal } from '@preact/signals';

/** Mobile sidebar open state. Desktop ignores this — the sidebar is
 *  always visible above the `md:` breakpoint via Tailwind classes. */
export const sidebarOpen = signal(false);

/** Convenience for callers that want to close the sidebar after a click
 *  (used by every nav link so tapping a route on mobile dismisses the
 *  drawer instead of leaving it stuck open over the new page). */
export function closeSidebar(): void {
  sidebarOpen.value = false;
}
