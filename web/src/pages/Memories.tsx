import { useEffect, useMemo, useState } from 'preact/hooks';
import { ChevronRight, Search, Pin, Sparkles, X } from 'lucide-preact';
import { PageHeader, Tab } from '@/components/PageHeader';
import { PageState } from '@/components/PageState';
import { Drawer } from '@/components/Modal';
import { PrivacyToggle } from '@/components/PrivacyToggle';
import { useFetch } from '@/lib/useFetch';
import { useDebouncedValue } from '@/lib/useDebounce';
import { formatRelativeTime, safeJsonArray } from '@/lib/format';
import { chatId, apiGet } from '@/lib/api';
import { privacyBlur } from '@/lib/privacy';

type SortMode = 'importance' | 'salience' | 'recent';

interface Memory {
  id: number;
  source: string;
  agent_id: string;
  raw_text: string;
  summary: string;
  entities: string;
  topics: string;
  connections: string;
  importance: number;
  salience: number;
  consolidated: number;
  pinned: number;
  created_at: number;
  accessed_at: number;
}

interface Consolidation { id: number; insight: string; summary: string; created_at: number; }

const PAGE_SIZE = 30;

export function Memories() {
  const [sort, setSort] = useState<SortMode>('importance');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<Memory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);

  const dq = useDebouncedValue(query, 200);

  // Reset list when sort changes.
  useEffect(() => {
    setItems([]); setOffset(0); setLoading(true); setExpanded(new Set());
    void loadPage(0, true);
  }, [sort]);

  async function loadPage(off: number, reset: boolean) {
    try {
      setLoading(true);
      const data = await apiGet<{ memories: Memory[]; total: number }>(
        `/api/memories/list?chatId=${encodeURIComponent(chatId)}&sort=${sort}&limit=${PAGE_SIZE}&offset=${off}`,
      );
      setTotal(data.total);
      setItems(reset ? data.memories : [...items, ...data.memories]);
      setOffset(off + data.memories.length);
      setError(null);
    } catch (err: any) { setError(err?.message || String(err)); }
    finally { setLoading(false); }
  }

  // Client-side filter by query.
  const filtered = useMemo(() => {
    if (!dq.trim()) return items;
    const q = dq.toLowerCase();
    return items.filter((m) => {
      if (m.summary.toLowerCase().includes(q)) return true;
      if (m.raw_text.toLowerCase().includes(q)) return true;
      const tags = [...safeJsonArray<string>(m.topics), ...safeJsonArray<string>(m.entities)];
      return tags.some((t) => t.toLowerCase().includes(q));
    });
  }, [items, dq]);

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div class="flex flex-col h-full">
      <PageHeader
        title="Memories"
        actions={
          <>
            <span class="text-[11px] text-[var(--color-text-muted)] tabular-nums mr-2">
              {dq ? filtered.length + ' / ' : ''}{total} memories
            </span>
            <button
              type="button"
              onClick={() => setPinnedOpen(true)}
              class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)] transition-colors"
            >
              <Pin size={13} /> Pinned
            </button>
            <button
              type="button"
              onClick={() => setInsightsOpen(true)}
              class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)] transition-colors"
            >
              <Sparkles size={13} /> Insights
            </button>
            <PrivacyToggle section="memories" />
          </>
        }
        tabs={
          <>
            <div class="flex-1 max-w-md mr-3 relative">
              <Search size={12} class="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
              <input
                type="text"
                value={query}
                onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
                placeholder="Filter loaded memories…"
                class="w-full bg-[var(--color-elevated)] border border-[var(--color-border)] rounded pl-7 pr-7 py-1 text-[12px] outline-none focus:border-[var(--color-accent)]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  class="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-[var(--color-card)] text-[var(--color-text-faint)]"
                >
                  <X size={10} />
                </button>
              )}
            </div>
            <Tab label="Importance" active={sort === 'importance'} onClick={() => setSort('importance')} />
            <Tab label="Salience" active={sort === 'salience'} onClick={() => setSort('salience')} />
            <Tab label="Recent" active={sort === 'recent'} onClick={() => setSort('recent')} />
          </>
        }
      />

      {error && <PageState error={error} />}
      {loading && items.length === 0 && <PageState loading />}
      {!loading && !error && total === 0 && (
        <PageState
          empty
          emptyTitle="No memories yet"
          emptyDescription="Memories are extracted automatically from your Telegram conversations."
        />
      )}
      {dq && filtered.length === 0 && items.length > 0 && (
        <PageState empty emptyTitle="No matches" emptyDescription={`Nothing in the loaded ${items.length} memories matches "${dq}".`} />
      )}

      {filtered.length > 0 && (
        <div class="flex-1 overflow-y-auto">
          {filtered.map((m) => (
            <MemoryRow key={m.id} memory={m} expanded={expanded.has(m.id)} onToggle={() => toggle(m.id)} />
          ))}
          {!dq && offset < total && (
            <button
              type="button"
              onClick={() => loadPage(offset, false)}
              disabled={loading}
              class="w-full px-6 py-3 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)] border-t border-[var(--color-border)] transition-colors disabled:opacity-40"
            >
              {loading ? 'Loading…' : `Load more (${total - offset} remaining)`}
            </button>
          )}
        </div>
      )}

      <Drawer open={pinnedOpen} onClose={() => setPinnedOpen(false)} title="Pinned memories">
        <PinnedDrawer />
      </Drawer>
      <Drawer open={insightsOpen} onClose={() => setInsightsOpen(false)} title="Memory insights">
        <InsightsDrawer />
      </Drawer>
    </div>
  );
}

function PinnedDrawer() {
  const { data, loading, error } = useFetch<{ memories: Memory[] }>(
    `/api/memories/pinned?chatId=${encodeURIComponent(chatId)}`,
  );
  if (loading) return <PageState loading />;
  if (error) return <PageState error={error} />;
  const list = data?.memories ?? [];
  if (list.length === 0) return <PageState empty emptyTitle="No pinned memories" />;
  return (
    <div class="px-6 py-4">
      <div class="text-[11px] text-[var(--color-text-muted)] mb-3">{list.length} pinned memories</div>
      <div class="space-y-2">
        {list.map((m) => (
          <div key={m.id} class="bg-[var(--color-elevated)] border border-[var(--color-border)] rounded p-3">
            <div class="text-[12.5px] text-[var(--color-text)] leading-snug">{m.summary}</div>
            <div class="flex flex-wrap gap-1 mt-1.5">
              {safeJsonArray<string>(m.topics).map((t, i) => (
                <span key={i} class="font-mono text-[10px] text-[var(--color-text-muted)] bg-[var(--color-card)] border border-[var(--color-border)] px-1.5 py-0.5 rounded">
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightsDrawer() {
  const { data, loading, error } = useFetch<{ consolidations: Consolidation[] }>(
    `/api/memories?chatId=${encodeURIComponent(chatId)}`,
  );
  if (loading) return <PageState loading />;
  if (error) return <PageState error={error} />;
  const list = data?.consolidations ?? [];
  if (list.length === 0) return <PageState empty emptyTitle="No insights yet" emptyDescription="Memory consolidation runs every 30 minutes and synthesizes patterns from recent memories." />;
  return (
    <div class="px-6 py-4">
      <div class="text-[11px] text-[var(--color-text-muted)] mb-3">{list.length} consolidation insights</div>
      <div class="space-y-2">
        {list.map((c) => (
          <div key={c.id} class="bg-[var(--color-elevated)] border border-[var(--color-border)] rounded p-3">
            <div class="text-[10px] text-[var(--color-text-faint)] tabular-nums mb-1">
              {formatRelativeTime(c.created_at)}
            </div>
            <div class="text-[13px] text-[var(--color-text)] font-medium mb-1 leading-snug">{c.insight}</div>
            <div class="text-[11.5px] text-[var(--color-text-muted)] leading-relaxed">{c.summary}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MemoryRow({ memory, expanded, onToggle }: { memory: Memory; expanded: boolean; onToggle: () => void }) {
  const topics = safeJsonArray<string>(memory.topics);
  const importanceColor =
    memory.importance >= 0.8 ? 'var(--color-priority-high)'
    : memory.importance >= 0.5 ? 'var(--color-priority-medium)'
    : 'var(--color-text-muted)';
  const blurOn = privacyBlur('memories').value;
  const [revealed, setRevealed] = useState(false);
  const blurClass = blurOn && !revealed ? 'privacy-blur' : (blurOn && revealed ? 'privacy-blur revealed' : '');
  function clickBlurSpan(ev: MouseEvent) {
    if (!blurOn) return; // let the row click bubble through to expand
    ev.stopPropagation();
    setRevealed((v) => !v);
  }

  return (
    <div
      class={[
        'border-b border-[var(--color-border)] px-6 py-3 cursor-pointer hover:bg-[var(--color-elevated)] transition-colors',
        expanded ? 'bg-[var(--color-elevated)]' : '',
      ].join(' ')}
      onClick={onToggle}
    >
      <div class="flex items-start gap-3">
        <ChevronRight
          size={14}
          class={'mt-1 shrink-0 text-[var(--color-text-faint)] transition-transform ' + (expanded ? 'rotate-90' : '')}
        />
        <div class="flex-1 min-w-0">
          <div class={'text-[13px] text-[var(--color-text)] leading-snug ' + (expanded ? '' : 'truncate')}>
            <span class={blurClass} onClick={clickBlurSpan}>{memory.summary}</span>
            {memory.pinned === 1 && <Pin size={11} class="inline ml-1.5 text-[var(--color-accent)]" />}
          </div>
          {topics.length > 0 && (
            <div class={'flex flex-wrap items-center gap-1 mt-1.5 ' + blurClass} onClick={clickBlurSpan}>
              {topics.slice(0, expanded ? 99 : 5).map((t, i) => (
                <span key={i} class="font-mono text-[10px] text-[var(--color-text-muted)] bg-[var(--color-elevated)] border border-[var(--color-border)] px-1.5 py-0.5 rounded">
                  {t}
                </span>
              ))}
            </div>
          )}
          {expanded && memory.raw_text && memory.raw_text !== memory.summary && (
            <div
              class={'mt-3 text-[12px] text-[var(--color-text-muted)] leading-relaxed whitespace-pre-wrap font-mono ' + blurClass}
              onClick={clickBlurSpan}
            >
              {memory.raw_text}
            </div>
          )}
        </div>

        <div class="flex items-center gap-3 shrink-0 pt-0.5">
          <span
            class="font-mono text-[11px] tabular-nums px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: 'color-mix(in srgb, ' + importanceColor + ' 18%, transparent)',
              color: importanceColor,
            }}
          >
            {memory.importance.toFixed(2)}
          </span>
          <div class="flex flex-col items-end gap-0.5">
            <div class="w-16 h-1 rounded-full bg-[var(--color-border)] overflow-hidden">
              <div
                class="h-full bg-[var(--color-accent)]"
                style={{ width: Math.max(2, Math.min(100, (memory.salience / 5) * 100)) + '%' }}
              />
            </div>
            <span class="font-mono text-[10px] text-[var(--color-text-faint)] tabular-nums">
              {memory.salience.toFixed(2)}
            </span>
          </div>
          <span class="text-[10px] text-[var(--color-text-faint)] w-12 text-right">
            {formatRelativeTime(memory.accessed_at || memory.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}
