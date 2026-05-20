import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { X, Search, RotateCw, Sparkles, ChevronDown, ChevronRight, SlidersHorizontal } from 'lucide-preact';
import { formatRelativeTime } from '@/lib/format';

interface HiveEntry {
  id: number;
  agent_id: string;
  chat_id: string;
  action: string;
  summary: string;
  artifacts: string | null;
  created_at: number;
}

interface Props {
  entries: HiveEntry[];
  /** Top-level agent tab — 'all' or an agent id. Acts as a hard filter. */
  agentFilter: string;
  /** Per-agent dot color (defaults supplied by the parent). */
  agentColors: Record<string, string>;
  blurOn: boolean;
}

// ── Brain shape ─────────────────────────────────────────────────────
// Cerebrum only — clean superior view. The outline has subtle gyri
// bumps; the textured "wrinkled brain" feel comes from many internal
// sulci drawn as soft curves on top.

const VIEW_W = 900;
const VIEW_H = 520;

const CEREBRUM_PATH =
  'M 450,72 ' +
  'C 492,56 540,58 575,82 ' +
  'C 628,86 678,116 707,162 ' +
  'C 736,202 745,254 730,304 ' +
  'C 717,352 686,392 645,416 ' +
  'C 610,432 572,442 530,442 ' +
  'C 508,452 480,458 460,455 ' +
  'C 452,460 448,460 440,455 ' +
  'C 420,458 392,452 370,442 ' +
  'C 328,442 290,432 255,416 ' +
  'C 214,392 183,352 170,304 ' +
  'C 155,254 164,202 193,162 ' +
  'C 222,116 272,86 325,82 ' +
  'C 360,58 408,56 450,72 Z';

// Longitudinal fissure — full length of the brain, slightly off-axis
// so the two hemispheres feel organic rather than clinical.
const FISSURE_PATH = 'M 450,74 C 446,170 454,290 450,455';

// Sulci — short curved lines that give the surface its wrinkled
// cortical texture. Hand-arranged in roughly anatomical positions so
// the brain reads as folded rather than smooth. Mirrored across the
// midline; the slight asymmetry in offsets is intentional.
const SULCI_LEFT = [
  // Frontal lobe folds
  'M 282,118 C 270,148 268,178 280,208',
  'M 232,148 C 224,180 220,210 228,240',
  'M 320,108 C 318,140 322,172 332,200',
  // Central sulcus area
  'M 300,178 C 285,210 282,250 295,290',
  'M 250,210 C 240,240 240,275 252,302',
  // Lateral / temporal
  'M 195,280 C 220,295 250,302 285,300',
  'M 215,330 C 245,348 280,360 320,358',
  // Parietal folds
  'M 350,250 C 340,278 340,310 352,338',
  'M 280,360 C 300,378 332,392 365,392',
  // Occipital
  'M 320,400 C 348,418 380,428 412,425',
  // Tertiary
  'M 270,250 C 282,272 280,300 268,322',
  'M 380,180 C 372,210 372,238 382,265',
];

const SULCI_RIGHT = [
  'M 618,118 C 630,148 632,178 620,208',
  'M 668,148 C 676,180 680,210 672,240',
  'M 580,108 C 582,140 578,172 568,200',
  'M 600,178 C 615,210 618,250 605,290',
  'M 650,210 C 660,240 660,275 648,302',
  'M 705,280 C 680,295 650,302 615,300',
  'M 685,330 C 655,348 620,360 580,358',
  'M 550,250 C 560,278 560,310 548,338',
  'M 620,360 C 600,378 568,392 535,392',
  'M 580,400 C 552,418 520,428 488,425',
  'M 630,250 C 618,272 620,300 632,322',
  'M 520,180 C 528,210 528,238 518,265',
];

// ── Lobes ───────────────────────────────────────────────────────────
// Four lobes only. Rectangles overlap a bit; rejection sampling
// against both the lobe rect AND the brain shape keeps dots inside
// the silhouette. They're clickable as filters via the labels.

interface Lobe {
  id: string;
  label: string;
  color: string;
  rect: [number, number, number, number]; // x, y, w, h
  labelAt: [number, number];
}

const LOBES: Lobe[] = [
  { id: 'frontal',   label: 'Frontal',   color: '#5eb6ff', rect: [200,  80, 500, 110], labelAt: [450,  98] },
  { id: 'parietal',  label: 'Parietal',  color: '#10b981', rect: [240, 190, 420, 100], labelAt: [450, 240] },
  { id: 'temporal',  label: 'Temporal',  color: '#f59e0b', rect: [165, 280, 570,  90], labelAt: [240, 350] },
  { id: 'occipital', label: 'Occipital', color: '#a78bfa', rect: [280, 370, 340,  80], labelAt: [450, 410] },
];

const LOBE_BY_ID = LOBES.reduce<Record<string, Lobe>>((acc, l) => { acc[l.id] = l; return acc; }, {});

const AGENT_LOBE: Record<string, string> = {
  main:     'frontal',     // executive, planning
  research: 'parietal',    // sensing & integration
  comms:    'temporal',    // language & memory
  content:  'occipital',   // visual / creative output
  ops:      'parietal',    // coordination — slot here without cerebellum
  meta:     'frontal',     // system-level — slot with main
};

function lobeFor(entry: HiveEntry): Lobe {
  return LOBE_BY_ID[AGENT_LOBE[entry.agent_id] || 'frontal'];
}

// ── PRNG + layout ───────────────────────────────────────────────────

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Pt { x: number; y: number }

type LobePools = Record<string, Pt[]>;

function generateLobePools(cerebrum: SVGPathElement): LobePools {
  const pools: LobePools = {};
  const r = rng(0xb14b);
  for (const lobe of LOBES) {
    const target = 140;
    const pts: Pt[] = [];
    let tries = 0;
    while (pts.length < target && tries < target * 60) {
      tries++;
      const [x0, y0, w, h] = lobe.rect;
      const x = x0 + r() * w;
      const y = y0 + r() * h;
      if (!(cerebrum as any).isPointInFill({ x, y })) continue;
      // Keep dots a few px away from the longitudinal fissure so the
      // midline stays visible.
      if (Math.abs(x - 450) < 10) continue;
      let tooClose = false;
      for (const p of pts) {
        const dx = p.x - x, dy = p.y - y;
        if (dx * dx + dy * dy < 13 * 13) { tooClose = true; break; }
      }
      if (!tooClose) pts.push({ x, y });
    }
    pools[lobe.id] = pts;
  }
  return pools;
}

// ── Filter state ────────────────────────────────────────────────────

interface BrainFilters {
  query: string;
  hiddenAgents: Set<string>;
  hiddenLobes: Set<string>;
  nodeSize: number;
  edgeOpacity: number;
  tilt: number;
}

const DEFAULT_FILTERS: BrainFilters = {
  query: '',
  hiddenAgents: new Set(),
  hiddenLobes: new Set(),
  nodeSize: 1,
  edgeOpacity: 0.4,
  tilt: 0,
};

// ── Component ───────────────────────────────────────────────────────

export function BrainGraph({ entries, agentFilter, agentColors, blurOn }: Props) {
  const cerebrumRef = useRef<SVGPathElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [pools, setPools] = useState<LobePools>({});
  const [hovered, setHovered] = useState<number | null>(null);
  const [hoverLobe, setHoverLobe] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<HiveEntry | null>(null);
  const [filters, setFilters] = useState<BrainFilters>(DEFAULT_FILTERS);
  const [animateNonce, setAnimateNonce] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    if (!cerebrumRef.current) return;
    setPools(generateLobePools(cerebrumRef.current));
  }, []);

  // Auto-open the panel when the user clicks a dot, so detail shows.
  useEffect(() => {
    if (selected) setPanelOpen(true);
  }, [selected]);

  const placed = useMemo(() => {
    const lobeIndex: Record<string, number> = {};
    const out: Array<HiveEntry & { pt: Pt; lobe: string }> = [];
    for (const e of entries) {
      const lobe = lobeFor(e);
      const pool = pools[lobe.id];
      if (!pool || pool.length === 0) continue;
      const idx = lobeIndex[lobe.id] = (lobeIndex[lobe.id] ?? -1) + 1;
      const pt = pool[idx % pool.length];
      out.push({ ...e, pt, lobe: lobe.id });
    }
    return out;
  }, [entries, pools]);

  const edges = useMemo(() => {
    const out: Array<{ a: number; b: number; agent: string }> = [];
    const byChat = new Map<string, number[]>();
    placed.forEach((e, i) => {
      const arr = byChat.get(e.chat_id);
      if (arr) arr.push(i); else byChat.set(e.chat_id, [i]);
    });
    for (const idxs of byChat.values()) {
      if (idxs.length < 2) continue;
      const sorted = idxs.slice().sort((a, b) => placed[a].created_at - placed[b].created_at);
      for (let i = 1; i < sorted.length; i++) {
        const a = sorted[i - 1];
        const b = sorted[i];
        if (placed[b].created_at - placed[a].created_at <= 1800) {
          out.push({ a, b, agent: placed[a].agent_id });
        }
      }
    }
    return out;
  }, [placed]);

  function isVisible(e: HiveEntry & { lobe: string }): boolean {
    if (filters.hiddenAgents.has(e.agent_id)) return false;
    if (filters.hiddenLobes.has(e.lobe)) return false;
    if (agentFilter !== 'all' && e.agent_id !== agentFilter) return false;
    if (filters.query) {
      const q = filters.query.toLowerCase();
      if (!e.summary.toLowerCase().includes(q) && !e.action.toLowerCase().includes(q)) return false;
    }
    return true;
  }

  function handleMove(e: MouseEvent) {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  const hoveredEntry = hovered !== null ? placed.find((e) => e.id === hovered) || null : null;

  const visibleAgents = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of entries) counts[e.agent_id] = (counts[e.agent_id] || 0) + 1;
    return counts;
  }, [entries]);

  const visibleEntryCount = useMemo(() => placed.filter(isVisible).length, [placed, filters, agentFilter]);

  function update<K extends keyof BrainFilters>(key: K, value: BrainFilters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
  }
  function toggleHidden(set: 'hiddenAgents' | 'hiddenLobes', id: string) {
    setFilters((f) => {
      const next = new Set(f[set]);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...f, [set]: next };
    });
  }

  return (
    <div class="flex-1 flex min-h-0 relative">
      <div
        ref={wrapRef}
        class="brain-stage flex-1 relative overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse 80% 70% at 50% 45%, color-mix(in srgb, var(--color-accent) 9%, transparent), transparent 75%), radial-gradient(ellipse 40% 30% at 30% 70%, color-mix(in srgb, #5eb6ff 4%, transparent), transparent 70%), var(--color-bg)',
        }}
        onMouseMove={handleMove}
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          class="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
          style={{ transform: `rotateY(${filters.tilt}deg)` }}
        >
          <defs>
            <radialGradient id="brainFill" cx="50%" cy="42%" r="60%">
              <stop offset="0%" stop-color="color-mix(in srgb, var(--color-accent) 32%, transparent)" />
              <stop offset="55%" stop-color="color-mix(in srgb, var(--color-accent) 10%, transparent)" />
              <stop offset="100%" stop-color="transparent" />
            </radialGradient>
            <radialGradient id="brainHalo" cx="50%" cy="48%" r="70%">
              <stop offset="0%" stop-color="var(--color-accent)" stop-opacity="0.16" />
              <stop offset="100%" stop-color="transparent" />
            </radialGradient>
            <filter id="dotGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="3.2" />
            </filter>
            <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.4" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {LOBES.map((l) => (
              <radialGradient key={l.id} id={`lobeGlow-${l.id}`} cx="50%" cy="50%" r="55%">
                <stop offset="0%" stop-color={l.color} stop-opacity="0.24" />
                <stop offset="100%" stop-color={l.color} stop-opacity="0" />
              </radialGradient>
            ))}
            <clipPath id="brainClip">
              <path d={CEREBRUM_PATH} />
            </clipPath>
          </defs>

          {/* Backlit halo behind the brain */}
          <ellipse cx={VIEW_W / 2} cy={250} rx={340} ry={230} fill="url(#brainHalo)" />

          {/* Lobe glows on hover */}
          <g clip-path="url(#brainClip)">
            {LOBES.map((l) => (
              <ellipse
                key={l.id}
                cx={l.rect[0] + l.rect[2] / 2}
                cy={l.rect[1] + l.rect[3] / 2}
                rx={l.rect[2] * 0.7}
                ry={l.rect[3] * 0.95}
                fill={`url(#lobeGlow-${l.id})`}
                opacity={hoverLobe === l.id ? 1 : 0}
                style={{ transition: 'opacity 220ms ease-out' }}
              />
            ))}
          </g>

          {/* Brain silhouette fill */}
          <path
            ref={cerebrumRef}
            d={CEREBRUM_PATH}
            fill="url(#brainFill)"
          />

          {/* Sulci — clipped to brain so they never escape the outline */}
          <g clip-path="url(#brainClip)" opacity="0.55">
            {[...SULCI_LEFT, ...SULCI_RIGHT].map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke="color-mix(in srgb, var(--color-accent) 42%, var(--color-text-faint))"
                stroke-width="0.9"
                stroke-linecap="round"
              />
            ))}
          </g>

          {/* Longitudinal fissure */}
          <path
            d={FISSURE_PATH}
            fill="none"
            stroke="color-mix(in srgb, var(--color-accent) 50%, var(--color-text-faint))"
            stroke-width="1.1"
            stroke-linecap="round"
            opacity="0.7"
          />

          {/* Animated outline draw-in */}
          <path
            d={CEREBRUM_PATH}
            fill="none"
            stroke="color-mix(in srgb, var(--color-accent) 70%, var(--color-text))"
            stroke-width="1.2"
            opacity="0.85"
            class="brain-outline-anim"
          />

          {/* Lobe labels */}
          {LOBES.map((l) => {
            const hidden = filters.hiddenLobes.has(l.id);
            return (
              <text
                key={l.id}
                x={l.labelAt[0]}
                y={l.labelAt[1]}
                text-anchor="middle"
                class={'brain-lobe-label ' + (hoverLobe === l.id ? 'is-active' : (hidden ? 'is-dim' : ''))}
                style={{ cursor: 'pointer', pointerEvents: 'auto', fill: hoverLobe === l.id ? l.color : undefined }}
                onMouseEnter={() => setHoverLobe(l.id)}
                onMouseLeave={() => setHoverLobe((h) => (h === l.id ? null : h))}
                onClick={() => toggleHidden('hiddenLobes', l.id)}
              >
                {l.label}
              </text>
            );
          })}

          {/* Edges */}
          <g style={{ opacity: filters.edgeOpacity }}>
            {edges.map((edge, i) => {
              const a = placed[edge.a];
              const b = placed[edge.b];
              if (!a || !b) return null;
              const visible = isVisible(a) && isVisible(b);
              const color = agentColors[edge.agent] || 'var(--color-text-muted)';
              const mx = (a.pt.x + b.pt.x) / 2;
              const my = (a.pt.y + b.pt.y) / 2;
              const cx = mx + (VIEW_W / 2 - mx) * 0.18;
              const cy = my + (250 - my) * 0.18;
              return (
                <path
                  key={i}
                  d={`M ${a.pt.x},${a.pt.y} Q ${cx},${cy} ${b.pt.x},${b.pt.y}`}
                  fill="none"
                  stroke={color}
                  stroke-width={visible ? 0.85 : 0.4}
                  opacity={visible ? 1 : 0.18}
                  filter="url(#softGlow)"
                />
              );
            })}
          </g>

          {/* Dots */}
          <g key={animateNonce}>
            {placed.map((entry, i) => {
              const visible = isVisible(entry);
              const isHovered = hovered === entry.id;
              const isSelected = selected?.id === entry.id;
              const color = agentColors[entry.agent_id] || 'var(--color-text-muted)';
              const r = (isHovered || isSelected ? 5.4 : 3.5) * filters.nodeSize;
              return (
                <g
                  key={entry.id}
                  class="brain-dot-bloom"
                  style={{ animationDelay: `${Math.min(i * 16, 2200)}ms` }}
                  onMouseEnter={() => setHovered(entry.id)}
                  onMouseLeave={() => setHovered((h) => (h === entry.id ? null : h))}
                  onClick={() => setSelected(entry)}
                >
                  <circle
                    cx={entry.pt.x}
                    cy={entry.pt.y}
                    r={r * 3.2}
                    fill={color}
                    opacity={visible ? (isHovered ? 0.4 : 0.18) : 0.04}
                    filter="url(#dotGlow)"
                    style={{ transition: 'opacity 200ms', pointerEvents: 'none' }}
                  />
                  <circle
                    cx={entry.pt.x}
                    cy={entry.pt.y}
                    r={r}
                    fill={color}
                    opacity={visible ? 0.95 : 0.18}
                    stroke={isHovered || isSelected ? 'white' : 'none'}
                    stroke-width={isHovered || isSelected ? 0.9 : 0}
                    style={{ cursor: 'pointer', transition: 'r 180ms, opacity 200ms' }}
                  />
                  <circle
                    cx={entry.pt.x - r * 0.3}
                    cy={entry.pt.y - r * 0.3}
                    r={r * 0.36}
                    fill="white"
                    opacity={visible ? (isHovered ? 0.9 : 0.55) : 0.1}
                    style={{ pointerEvents: 'none', transition: 'opacity 200ms' }}
                  />
                </g>
              );
            })}
          </g>
        </svg>

        {/* Hover tooltip */}
        {hoveredEntry && mousePos && !selected && (
          <div
            class="absolute pointer-events-none bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-xl px-3 py-2 text-[11.5px] text-[var(--color-text)] max-w-[320px] z-10"
            style={{
              left: Math.min(mousePos.x + 14, (wrapRef.current?.clientWidth || 800) - 340),
              top: Math.min(mousePos.y + 14, (wrapRef.current?.clientHeight || 500) - 110),
              backdropFilter: 'blur(8px)',
            }}
          >
            <div class="flex items-center gap-2 mb-1">
              <span
                class="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: agentColors[hoveredEntry.agent_id] || 'var(--color-text-muted)' }}
              />
              <span class="font-mono text-[10.5px] text-[var(--color-text-muted)]">
                @{hoveredEntry.agent_id} · {hoveredEntry.action}
              </span>
              <span class="text-[10px] text-[var(--color-text-faint)] ml-auto tabular-nums">
                {formatRelativeTime(hoveredEntry.created_at)}
              </span>
            </div>
            <div class={'leading-snug ' + (blurOn ? 'privacy-blur revealed' : '')}>
              {hoveredEntry.summary}
            </div>
          </div>
        )}

        {/* Floating filter button — visible only when panel is closed */}
        {!panelOpen && (
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            class="absolute top-4 right-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-card)]/90 backdrop-blur border border-[var(--color-border)] hover:border-[var(--color-accent)] text-[11.5px] text-[var(--color-text)] shadow-lg transition-colors"
            style={{ backdropFilter: 'blur(8px)' }}
          >
            <SlidersHorizontal size={12} />
            Filters
            <span class="text-[10.5px] text-[var(--color-text-faint)] tabular-nums">
              {visibleEntryCount}
            </span>
          </button>
        )}
      </div>

      {/* Right-side panel — slides in from the right */}
      <aside
        class={[
          'absolute top-0 right-0 bottom-0 w-[320px] bg-[var(--color-card)] border-l border-[var(--color-border)] flex flex-col min-h-0 shadow-2xl z-20',
          'transition-transform duration-300 ease-out',
          panelOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        style={{ backdropFilter: 'blur(8px)' }}
      >
        {selected ? (
          <DetailPanel
            entry={selected}
            color={agentColors[selected.agent_id] || 'var(--color-text-muted)'}
            blurOn={blurOn}
            lobeLabel={LOBE_BY_ID[AGENT_LOBE[selected.agent_id] || 'frontal']?.label}
            onClose={() => { setSelected(null); setPanelOpen(false); }}
          />
        ) : (
          <FilterPanel
            filters={filters}
            update={update}
            toggleHidden={toggleHidden}
            visibleAgents={visibleAgents}
            agentColors={agentColors}
            onAnimate={() => setAnimateNonce((n) => n + 1)}
            onReset={() => setFilters(DEFAULT_FILTERS)}
            totalEntries={entries.length}
            visibleEntries={visibleEntryCount}
            onClose={() => setPanelOpen(false)}
          />
        )}
      </aside>
    </div>
  );
}

// ── Detail panel ─────────────────────────────────────────────────────

function DetailPanel({
  entry, color, blurOn, lobeLabel, onClose,
}: {
  entry: HiveEntry;
  color: string;
  blurOn: boolean;
  lobeLabel?: string;
  onClose: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <>
      <header class="flex items-center px-4 py-3 border-b border-[var(--color-border)] gap-2">
        <span class="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span class="font-mono text-[12px] text-[var(--color-text)]">@{entry.agent_id}</span>
        {lobeLabel && (
          <span class="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] ml-1">{lobeLabel}</span>
        )}
        <span class="text-[10.5px] text-[var(--color-text-faint)] ml-auto tabular-nums">
          {formatRelativeTime(entry.created_at)}
        </span>
        <button
          type="button"
          onClick={onClose}
          class="p-1 rounded hover:bg-[var(--color-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          <X size={13} />
        </button>
      </header>
      <div class="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <Field label="Action">
          <span class="font-mono text-[11.5px] text-[var(--color-text)]">{entry.action}</span>
        </Field>
        <Field label="Summary">
          <div
            class={'text-[12.5px] text-[var(--color-text)] leading-relaxed ' + (blurOn && !revealed ? 'privacy-blur' : (blurOn && revealed ? 'privacy-blur revealed' : ''))}
            onClick={() => blurOn && setRevealed((v) => !v)}
          >
            {entry.summary}
          </div>
        </Field>
        {entry.artifacts && (
          <Field label="Artifacts">
            <div class="font-mono text-[11px] text-[var(--color-text-muted)] whitespace-pre-wrap break-words">
              {entry.artifacts}
            </div>
          </Field>
        )}
        <Field label="Chat">
          <div class="font-mono text-[11px] text-[var(--color-text-muted)] truncate">{entry.chat_id}</div>
        </Field>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <div>
      <div class="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] mb-1">{label}</div>
      {children}
    </div>
  );
}

// ── Filter panel ─────────────────────────────────────────────────────

function FilterPanel({
  filters, update, toggleHidden, visibleAgents, agentColors, onAnimate, onReset, totalEntries, visibleEntries, onClose,
}: {
  filters: BrainFilters;
  update: <K extends keyof BrainFilters>(key: K, value: BrainFilters[K]) => void;
  toggleHidden: (set: 'hiddenAgents' | 'hiddenLobes', id: string) => void;
  visibleAgents: Record<string, number>;
  agentColors: Record<string, string>;
  onAnimate: () => void;
  onReset: () => void;
  totalEntries: number;
  visibleEntries: number;
  onClose: () => void;
}) {
  const [openSection, setOpenSection] = useState({
    agents: true,
    lobes: false,
    display: false,
  });
  return (
    <>
      <header class="flex items-center px-4 py-3 border-b border-[var(--color-border)] gap-2">
        <Sparkles size={13} class="text-[var(--color-accent)]" />
        <span class="text-[12.5px] font-semibold text-[var(--color-text)]">Filters</span>
        <span class="text-[10.5px] text-[var(--color-text-faint)] ml-auto tabular-nums">
          {visibleEntries} / {totalEntries}
        </span>
        <button
          type="button"
          onClick={onReset}
          class="p-1 rounded hover:bg-[var(--color-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          title="Reset all filters"
        >
          <RotateCw size={11} />
        </button>
        <button
          type="button"
          onClick={onClose}
          class="p-1 rounded hover:bg-[var(--color-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          title="Close panel"
        >
          <X size={13} />
        </button>
      </header>

      <div class="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        <div>
          <div class="relative">
            <Search size={12} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
            <input
              value={filters.query}
              onInput={(e) => update('query', (e.target as HTMLInputElement).value)}
              placeholder="Search summaries…"
              class="w-full pl-7 pr-2.5 py-1.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none text-[12px] text-[var(--color-text)]"
            />
          </div>
        </div>

        <Section
          label="Agents"
          open={openSection.agents}
          onToggle={() => setOpenSection((s) => ({ ...s, agents: !s.agents }))}
        >
          <div class="space-y-1">
            {Object.entries(visibleAgents).sort((a, b) => b[1] - a[1]).map(([id, count]) => {
              const on = !filters.hiddenAgents.has(id);
              const color = agentColors[id] || 'var(--color-text-muted)';
              const lobe = LOBE_BY_ID[AGENT_LOBE[id] || 'frontal'];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleHidden('hiddenAgents', id)}
                  class="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--color-elevated)] transition-colors text-left"
                >
                  <span
                    class="inline-block w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: color, boxShadow: on ? `0 0 6px ${color}` : 'none' }}
                  />
                  <span class={'font-mono text-[11.5px] ' + (on ? 'text-[var(--color-text)]' : 'text-[var(--color-text-faint)]')}>
                    @{id}
                  </span>
                  {lobe && (
                    <span class="text-[10px]" style={{ color: on ? lobe.color : 'var(--color-text-faint)', opacity: on ? 0.75 : 0.4 }}>
                      {lobe.label.toLowerCase()}
                    </span>
                  )}
                  <span class="ml-auto text-[10.5px] tabular-nums text-[var(--color-text-faint)]">{count}</span>
                  <span class={'brain-switch ' + (on ? 'is-on' : '')} />
                </button>
              );
            })}
          </div>
        </Section>

        <Section
          label="Regions"
          open={openSection.lobes}
          onToggle={() => setOpenSection((s) => ({ ...s, lobes: !s.lobes }))}
        >
          <div class="space-y-1">
            {LOBES.map((l) => {
              const on = !filters.hiddenLobes.has(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => toggleHidden('hiddenLobes', l.id)}
                  class="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--color-elevated)] transition-colors text-left"
                >
                  <span
                    class="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{
                      backgroundColor: l.color,
                      opacity: on ? 1 : 0.3,
                      boxShadow: on ? `0 0 6px ${l.color}` : 'none',
                    }}
                  />
                  <span class={'text-[12px] ' + (on ? 'text-[var(--color-text)]' : 'text-[var(--color-text-faint)]')}>
                    {l.label}
                  </span>
                  <span class={'brain-switch ml-auto ' + (on ? 'is-on' : '')} />
                </button>
              );
            })}
          </div>
        </Section>

        <Section
          label="Display"
          open={openSection.display}
          onToggle={() => setOpenSection((s) => ({ ...s, display: !s.display }))}
        >
          <div class="space-y-3">
            <SliderRow
              label="Node size"
              value={filters.nodeSize}
              min={0.5} max={2} step={0.05}
              onInput={(v) => update('nodeSize', v)}
            />
            <SliderRow
              label="Edge opacity"
              value={filters.edgeOpacity}
              min={0} max={1} step={0.05}
              onInput={(v) => update('edgeOpacity', v)}
            />
            <SliderRow
              label="Tilt"
              value={filters.tilt}
              min={-25} max={25} step={1}
              onInput={(v) => update('tilt', v)}
              fmt={(v) => `${v}°`}
            />
            <button
              type="button"
              onClick={onAnimate}
              class="w-full py-1.5 mt-1 rounded bg-[var(--color-elevated)] hover:bg-[var(--color-accent-soft)] text-[var(--color-text)] hover:text-[var(--color-accent)] text-[11.5px] transition-colors flex items-center justify-center gap-1.5"
            >
              <Sparkles size={11} /> Animate
            </button>
          </div>
        </Section>
      </div>
    </>
  );
}

function Section({
  label, open, onToggle, children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: any;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        class="w-full flex items-center gap-1 text-[10.5px] uppercase tracking-wider text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)] mb-1.5"
      >
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        {label}
      </button>
      {open && children}
    </div>
  );
}

function SliderRow({
  label, value, min, max, step, onInput, fmt,
}: {
  label: string;
  value: number;
  min: number; max: number; step: number;
  onInput: (v: number) => void;
  fmt?: (v: number) => string;
}) {
  return (
    <div>
      <div class="flex items-center justify-between mb-1">
        <span class="text-[11px] text-[var(--color-text-muted)]">{label}</span>
        <span class="text-[10.5px] text-[var(--color-text-faint)] tabular-nums">
          {fmt ? fmt(value) : value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        class="brain-slider"
        min={min} max={max} step={step}
        value={value}
        onInput={(e) => onInput(parseFloat((e.target as HTMLInputElement).value))}
      />
    </div>
  );
}
