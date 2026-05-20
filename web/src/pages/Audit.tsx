import { useEffect, useState } from 'preact/hooks';
import { ShieldAlert, ShieldCheck } from 'lucide-preact';
import { PageHeader, Tab } from '@/components/PageHeader';
import { PageState } from '@/components/PageState';
import { apiGet } from '@/lib/api';
import { formatRelativeTime } from '@/lib/format';

interface AuditEntry {
  id: number;
  agent_id: string;
  chat_id: string;
  action: string;
  detail: string;
  blocked: number;
  created_at: number;
}

const PAGE = 100;

export function Audit() {
  const [filter, setFilter] = useState<'all' | 'blocked'>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Sticky union of every agent_id we've ever seen in this session, so
  // narrowing the filter to a single agent doesn't make the other chips
  // disappear (the previous version derived chips from the currently
  // loaded rows, which collapsed once you filtered).
  const [knownAgents, setKnownAgents] = useState<string[]>([]);

  useEffect(() => {
    setItems([]); setOffset(0); setLoading(true);
    void load(0, true);
  }, [filter, agentFilter]);

  async function load(off: number, reset: boolean) {
    try {
      setLoading(true); setError(null);
      let path: string;
      if (filter === 'blocked') {
        path = `/api/audit/blocked?limit=${PAGE}`;
      } else {
        path = `/api/audit?limit=${PAGE}&offset=${off}` + (agentFilter !== 'all' ? `&agent=${encodeURIComponent(agentFilter)}` : '');
      }
      const data = await apiGet<{ entries: AuditEntry[]; total?: number }>(path);
      setTotal(data.total ?? data.entries.length);
      setItems(reset ? data.entries : [...items, ...data.entries]);
      setOffset(off + data.entries.length);
      setKnownAgents((prev) => {
        const next = new Set(prev);
        for (const e of data.entries) next.add(e.agent_id);
        return Array.from(next).sort();
      });
    } catch (err: any) { setError(err?.message || String(err)); }
    finally { setLoading(false); }
  }

  const agentIds = knownAgents;

  return (
    <div class="flex flex-col h-full">
      <PageHeader
        title="Audit"
        actions={<span class="text-[11px] text-[var(--color-text-muted)] tabular-nums">{filter === 'blocked' ? items.length + ' blocked' : total + ' entries'}</span>}
        tabs={
          <>
            <Tab label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
            <Tab label="Blocked" active={filter === 'blocked'} onClick={() => setFilter('blocked')} />
            {filter === 'all' && agentIds.length > 0 && (
              <>
                <span class="mx-1 text-[var(--color-text-faint)]">·</span>
                <Tab label="Any agent" active={agentFilter === 'all'} onClick={() => setAgentFilter('all')} />
                {agentIds.map((id) => (
                  <Tab key={id} label={id} active={agentFilter === id} onClick={() => setAgentFilter(id)} />
                ))}
              </>
            )}
          </>
        }
      />

      {error && <PageState error={error} />}
      {loading && items.length === 0 && <PageState loading />}
      {!loading && !error && items.length === 0 && (
        <PageState empty emptyTitle="No audit events" emptyDescription="Security-relevant actions and kill-switch refusals appear here." />
      )}

      {items.length > 0 && (
        <div class="flex-1 overflow-y-auto">
          <table class="w-full text-[12px]">
            <thead class="sticky top-0 bg-[var(--color-bg)] border-b border-[var(--color-border)]">
              <tr class="text-left">
                <th class="px-6 py-2 font-medium text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] w-[10%]">When</th>
                <th class="px-3 py-2 font-medium text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] w-[10%]">Agent</th>
                <th class="px-3 py-2 font-medium text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] w-[20%]">Action</th>
                <th class="px-3 py-2 font-medium text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] w-[8%] text-center">Status</th>
                <th class="px-3 py-2 font-medium text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">Detail</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id} class="border-b border-[var(--color-border)] hover:bg-[var(--color-elevated)] transition-colors">
                  <td class="px-6 py-2 text-[var(--color-text-faint)] tabular-nums whitespace-nowrap">
                    {formatRelativeTime(e.created_at)}
                  </td>
                  <td class="px-3 py-2 text-[var(--color-text-muted)]">{e.agent_id}</td>
                  <td class="px-3 py-2 font-mono text-[11px] text-[var(--color-text)]">{e.action}</td>
                  <td class="px-3 py-2 text-center">
                    {e.blocked === 1 ? (
                      <span class="inline-flex items-center gap-1 text-[var(--color-status-failed)] text-[10px] font-medium">
                        <ShieldAlert size={11} /> blocked
                      </span>
                    ) : (
                      <span class="inline-flex items-center gap-1 text-[var(--color-status-done)] text-[10px] font-medium">
                        <ShieldCheck size={11} /> ok
                      </span>
                    )}
                  </td>
                  <td class="px-3 py-2 text-[var(--color-text-muted)] truncate max-w-0 font-mono text-[11px]">{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filter === 'all' && offset < total && (
            <button
              type="button"
              onClick={() => load(offset, false)}
              disabled={loading}
              class="w-full px-6 py-3 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)] border-t border-[var(--color-border)] transition-colors disabled:opacity-40"
            >
              {loading ? 'Loading…' : `Load more (${total - offset} remaining)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
