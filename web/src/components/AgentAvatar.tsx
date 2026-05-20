import { useState, useEffect } from 'preact/hooks';
import { dashboardToken } from '@/lib/api';

interface Props {
  agentId: string;
  name?: string;
  size?: number;
  running?: boolean;
  /** Bumped by callers (e.g. after avatar upload) to force the browser
   *  to refetch the image instead of serving from the 1h HTTP cache. */
  cacheBust?: number | string;
}

const FAILED_AVATARS = new Set<string>();

// Round avatar that lazy-loads from /api/agents/:id/avatar. Falls back to
// initials if the endpoint returns 204 (no Telegram avatar set) or 404.
// Successful loads are cached in the browser; 204/404 are remembered in a
// module-scoped Set so we don't re-fetch missing avatars within a session.
export function AgentAvatar({ agentId, name, size = 36, running, cacheBust }: Props) {
  const [imageOk, setImageOk] = useState(!FAILED_AVATARS.has(agentId));
  useEffect(() => { setImageOk(!FAILED_AVATARS.has(agentId)); }, [agentId]);
  // When cacheBust changes the FAILED set might be stale (a 204 from
  // last visit shouldn't keep us in initials mode after the user just
  // uploaded a new image). Re-enable the image element so the browser
  // refetches with the new query param.
  useEffect(() => {
    if (cacheBust !== undefined) {
      FAILED_AVATARS.delete(agentId);
      setImageOk(true);
    }
  }, [cacheBust, agentId]);

  const initials = (name || agentId)
    .split(/[\s_-]+/)
    .map((w) => w[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const ringColor = running ? 'var(--color-status-done)' : 'var(--color-text-faint)';

  if (!imageOk) {
    return (
      <div
        class="rounded-full flex items-center justify-center font-semibold shrink-0"
        style={{
          width: size + 'px',
          height: size + 'px',
          fontSize: Math.floor(size * 0.36) + 'px',
          backgroundColor: running ? 'var(--color-accent-soft)' : 'var(--color-elevated)',
          color: running ? 'var(--color-accent)' : 'var(--color-text-muted)',
          boxShadow: running ? 'inset 0 0 0 1px ' + ringColor : 'none',
        }}
      >
        {initials}
      </div>
    );
  }

  const cacheBustParam = cacheBust !== undefined ? `&v=${encodeURIComponent(String(cacheBust))}` : '';
  return (
    <img
      src={`/api/agents/${encodeURIComponent(agentId)}/avatar?token=${encodeURIComponent(dashboardToken)}${cacheBustParam}`}
      alt={name || agentId}
      class="rounded-full shrink-0 object-cover"
      style={{
        width: size + 'px',
        height: size + 'px',
        boxShadow: running ? 'inset 0 0 0 1px ' + ringColor : 'none',
      }}
      onError={() => {
        FAILED_AVATARS.add(agentId);
        setImageOk(false);
      }}
    />
  );
}
