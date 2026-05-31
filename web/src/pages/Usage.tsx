import { PageHeader } from '@/components/PageHeader';
import { Pill, StatusDot } from '@/components/Pill';
import { PageState } from '@/components/PageState';
import { useFetch } from '@/lib/useFetch';
import { formatCost, formatNumber } from '@/lib/format';
import { showCosts } from '@/lib/theme';
import { chatId } from '@/lib/api';

interface TokenStats {
  todayInput: number;
  todayOutput: number;
  todayCost: number;
  todayTurns: number;
  allTimeCost: number;
  allTimeTurns: number;
}

interface CostTimelineEntry { date: string; cost: number; turns: number; }

interface Health {
  contextPct: number;
  turns: number;
  compactions: number;
  sessionAge: string;
  model: string;
  telegramConnected: boolean;
  waConnected: boolean;
  slackConnected: boolean;
  killSwitches: Record<string, boolean>;
  killSwitchRefusals: Record<string, number>;
}

export function Usage() {
  const tokens = useFetch<{ stats: TokenStats; costTimeline: CostTimelineEntry[] }>(
    `/api/tokens?chatId=${encodeURIComponent(chatId)}`, 60_000,
  );
  const health = useFetch<Health>(`/api/health?chatId=${encodeURIComponent(chatId)}`, 30_000);

  const stats = tokens.data?.stats;
  const timeline = tokens.data?.costTimeline ?? [];
  const error = tokens.error || health.error;

  return (
    <div class="flex flex-col h-full">
      <PageHeader title="Usage" />

      {error && <PageState error={error} />}
      {!error && (tokens.loading || health.loading) && !tokens.data && <PageState loading />}

      {stats && (
        <div class="flex-1 overflow-y-auto p-6 space-y-4">
          <div class={(showCosts.value ? 'grid-cols-4' : 'grid-cols-2') + ' grid gap-3'}>
            <KpiCard label="Today turns" value={formatNumber(stats.todayTurns)} />
            <KpiCard label="Today tokens" value={formatNumber(stats.todayInput + stats.todayOutput)} />
            {showCosts.value && <KpiCard label="Today cost" value={formatCost(stats.todayCost)} />}
            {showCosts.value && <KpiCard label="Lifetime cost" value={formatCost(stats.allTimeCost)} />}
          </div>

          {showCosts.value && (() => {
            const totalCost = timeline.reduce((a, b) => a + b.cost, 0);
            const totalTurns = timeline.reduce((a, b) => a + b.turns, 0);
            const hasData = timeline.length > 0 && totalCost > 0;
            return (
              <div class="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-4">
                <div class="flex items-center justify-between mb-3">
                  <div class="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">30-day cost</div>
                  <div class="text-[10px] text-[var(--color-text-muted)] tabular-nums">
                    {hasData ? `${formatCost(totalCost)} · ${formatNumber(totalTurns)} turns` : 'no activity yet'}
                  </div>
                </div>
                {hasData ? (
                  <Sparkline data={timeline} />
                ) : (
                  <div class="py-10 text-center">
                    <div class="text-[12px] text-[var(--color-text-muted)] mb-1">No cost data in the last 30 days</div>
                    <div class="text-[11px] text-[var(--color-text-faint)]">
                      Charts populate once your agents start running turns. Send a message in Chat or talk to your bot in Telegram.
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {health.data && (
            <div class="grid grid-cols-2 gap-3">
              <div class="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-4">
                <div class="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] mb-3">System health</div>
                <div class="grid grid-cols-2 gap-3">
                  <Stat label="Context" value={health.data.contextPct + '%'} />
                  <Stat label="Turns" value={String(health.data.turns)} />
                  <Stat label="Session age" value={health.data.sessionAge} />
                  <Stat label="Compactions" value={String(health.data.compactions)} />
                  <Stat label="Model" value={health.data.model.replace('claude-', '')} colSpan={2} />
                </div>
              </div>
              <div class="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-4">
                <div class="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] mb-3">Connections</div>
                <div class="space-y-2">
                  <Connection label="Telegram" connected={health.data.telegramConnected} />
                  <Connection label="WhatsApp" connected={health.data.waConnected} />
                  <Connection label="Slack" connected={health.data.slackConnected} />
                </div>
                <div class="mt-4 pt-3 border-t border-[var(--color-border)]">
                  <div class="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] mb-2">Kill switches</div>
                  <div class="flex flex-wrap gap-1.5">
                    {Object.entries(health.data.killSwitches).map(([k, on]) => (
                      <Pill key={k} tone={on ? 'done' : 'failed'}>
                        {k.replace('_ENABLED', '').toLowerCase()}
                      </Pill>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div class="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-4">
      <div class="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] mb-1.5">{label}</div>
      <div class="text-[20px] font-semibold tabular-nums text-[var(--color-text)]">{value}</div>
    </div>
  );
}

function Stat({ label, value, colSpan = 1 }: { label: string; value: string; colSpan?: number }) {
  return (
    <div style={{ gridColumn: 'span ' + colSpan }}>
      <div class="text-[10px] text-[var(--color-text-faint)] uppercase tracking-wider mb-0.5">{label}</div>
      <div class="text-[12.5px] tabular-nums text-[var(--color-text)]">{value}</div>
    </div>
  );
}

function Connection({ label, connected }: { label: string; connected: boolean }) {
  return (
    <div class="flex items-center gap-2 text-[12px]">
      <StatusDot tone={connected ? 'done' : 'cancelled'} />
      <span class="text-[var(--color-text-muted)]">{label}</span>
      <span class="ml-auto text-[var(--color-text-faint)] text-[10.5px]">
        {connected ? 'connected' : 'offline'}
      </span>
    </div>
  );
}

function Sparkline({ data }: { data: CostTimelineEntry[] }) {
  if (data.length < 2) return <div class="text-[var(--color-text-faint)] text-[11px] py-8 text-center">Not enough data</div>;
  const maxCost = Math.max(...data.map((d) => d.cost), 0.01);
  const w = 100; const h = 24;
  const stepX = w / (data.length - 1);
  const points = data.map((d, i) => `${i * stepX},${h - (d.cost / maxCost) * h}`).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" class="w-full h-20">
        <polyline points={points} fill="none" stroke="var(--color-accent)" stroke-width="0.6" />
      </svg>
      <div class="flex justify-between mt-1 text-[10px] text-[var(--color-text-faint)] tabular-nums">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}
