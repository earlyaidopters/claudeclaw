import { signal, effect } from '@preact/signals';
import { tokenizedSseUrl, dashboardToken } from './api';

// Global chat SSE state — opened once when the app mounts so the unread
// badge keeps tracking even when /chat isn't the active page.

export const chatUnread = signal(0);
export const chatStreamConnected = signal(false);

// In-memory broadcast for any page that wants to react to chat events
// (the Chat page subscribes; the sidebar just reads chatUnread).
type Listener = (eventName: string, data: any) => void;
const listeners = new Set<Listener>();

export function subscribeChatStream(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function resetUnread() { chatUnread.value = 0; }

let started = false;
export function startChatStream() {
  if (started || !dashboardToken) return;
  started = true;

  let es: EventSource | null = null;
  let activeRoute = window.location.pathname;

  function reactToRoute() { activeRoute = window.location.pathname; }
  window.addEventListener('popstate', reactToRoute);
  // Wouter pushes via history.pushState; patch to fire popstate.
  const origPush = history.pushState;
  history.pushState = function (...args: any[]) {
    const ret = origPush.apply(this as any, args as any);
    reactToRoute();
    return ret;
  };

  function open() {
    if (es) return;
    es = new EventSource(tokenizedSseUrl('/api/chat/stream'));
    es.onopen = () => { chatStreamConnected.value = true; };
    es.onerror = () => { chatStreamConnected.value = false; };

    const dispatch = (eventName: string) => (ev: MessageEvent) => {
      let data: any;
      try { data = JSON.parse(ev.data); } catch { return; }
      // Bump unread when an assistant message arrives and we're not on /chat.
      if (eventName === 'assistant_message' && !activeRoute.startsWith('/chat')) {
        chatUnread.value = chatUnread.value + 1;
      }
      for (const l of listeners) {
        try { l(eventName, data); } catch (err) { console.error('chat listener', err); }
      }
    };

    es.addEventListener('user_message', dispatch('user_message'));
    es.addEventListener('assistant_message', dispatch('assistant_message'));
    es.addEventListener('assistant_photo', dispatch('assistant_photo'));
    es.addEventListener('processing', dispatch('processing'));
    es.addEventListener('progress', dispatch('progress'));
    es.addEventListener('error', dispatch('error') as any);
  }

  open();
}

// When the user navigates onto /chat, clear the unread count.
effect(() => {
  if (typeof window === 'undefined') return;
  const onChat = () => {
    if (window.location.pathname.startsWith('/chat')) {
      resetUnread();
    }
  };
  window.addEventListener('popstate', onChat);
  // Initial check.
  onChat();
});
