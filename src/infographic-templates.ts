/**
 * Pre-built HTML infographic templates for common EAC use cases.
 * Each function returns self-contained HTML with inline styles.
 *
 * Usage:
 *   import { upgradeOverviewTemplate } from './infographic-templates.js';
 *   import { renderHtmlToImage } from './image-renderer.js';
 *   const html = upgradeOverviewTemplate({ ... });
 *   const imagePath = await renderHtmlToImage(html);
 */

export interface UpgradeOverviewData {
  projectName: string;
  currentVersion: string;
  targetVersion: string;
  commitCount: number;
  features: string[];
  conflicts: { file: string; severity: 'low' | 'moderate' | 'severe' }[];
  autoMerged: number;
  scheduledTime: string;
  rollbackPlan: string[];
}

export function upgradeOverviewTemplate(data: UpgradeOverviewData): string {
  const severityColor = { low: '#22c55e', moderate: '#f59e0b', severe: '#ef4444' };
  const severityBg = { low: '#f0fdf4', moderate: '#fffbeb', severe: '#fef2f2' };

  const featureItems = data.features
    .map(f => `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;"><span style="color:#22c55e;font-size:18px;">&#10003;</span><span>${f}</span></div>`)
    .join('');

  const conflictItems = data.conflicts
    .map(c => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;margin:4px 0;background:${severityBg[c.severity]};border-radius:6px;border-left:3px solid ${severityColor[c.severity]};">
        <code style="font-family:'SF Mono',Consolas,monospace;font-size:13px;">${c.file}</code>
        <span style="font-size:11px;font-weight:600;text-transform:uppercase;color:${severityColor[c.severity]};">${c.severity}</span>
      </div>
    `)
    .join('');

  const rollbackItems = data.rollbackPlan
    .map((step, i) => `<div style="display:flex;gap:10px;padding:4px 0;"><span style="color:#6366f1;font-weight:700;min-width:20px;">${i + 1}.</span><span>${step}</span></div>`)
    .join('');

  const severeCount = data.conflicts.filter(c => c.severity === 'severe').length;
  const moderateCount = data.conflicts.filter(c => c.severity === 'moderate').length;
  const statusColor = severeCount > 3 ? '#ef4444' : severeCount > 0 ? '#f59e0b' : '#22c55e';
  const statusText = severeCount > 3 ? 'HIGH RISK' : severeCount > 0 ? 'MODERATE RISK' : 'LOW RISK';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:1100px;margin:0 auto;padding:40px;">

  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;">
    <div>
      <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:2px;color:#6366f1;margin-bottom:4px;">Upgrade Plan</div>
      <div style="font-size:32px;font-weight:800;color:#f8fafc;">${data.projectName}</div>
    </div>
    <div style="text-align:right;">
      <div style="display:inline-block;padding:6px 16px;border-radius:20px;background:${statusColor}22;border:1px solid ${statusColor};color:${statusColor};font-size:13px;font-weight:700;">${statusText}</div>
      <div style="color:#94a3b8;font-size:13px;margin-top:8px;">${data.scheduledTime}</div>
    </div>
  </div>

  <!-- Version Banner -->
  <div style="display:flex;align-items:center;gap:20px;padding:20px 28px;background:linear-gradient(135deg,#1e1b4b,#312e81);border-radius:12px;margin-bottom:28px;">
    <div style="text-align:center;">
      <div style="font-size:11px;color:#a5b4fc;text-transform:uppercase;letter-spacing:1px;">Current</div>
      <div style="font-size:22px;font-weight:700;color:#e0e7ff;font-family:'SF Mono',Consolas,monospace;">${data.currentVersion}</div>
    </div>
    <div style="font-size:28px;color:#6366f1;">&#8594;</div>
    <div style="text-align:center;">
      <div style="font-size:11px;color:#a5b4fc;text-transform:uppercase;letter-spacing:1px;">Target</div>
      <div style="font-size:22px;font-weight:700;color:#e0e7ff;font-family:'SF Mono',Consolas,monospace;">${data.targetVersion}</div>
    </div>
    <div style="flex:1;"></div>
    <div style="display:flex;gap:24px;">
      <div style="text-align:center;">
        <div style="font-size:28px;font-weight:800;color:#f8fafc;">${data.commitCount}</div>
        <div style="font-size:11px;color:#a5b4fc;">Commits</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:28px;font-weight:800;color:#22c55e;">${data.autoMerged}</div>
        <div style="font-size:11px;color:#a5b4fc;">Auto-merged</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:28px;font-weight:800;color:#f59e0b;">${data.conflicts.length}</div>
        <div style="font-size:11px;color:#a5b4fc;">Conflicts</div>
      </div>
    </div>
  </div>

  <!-- Two Column Layout -->
  <div style="display:flex;gap:20px;margin-bottom:28px;">

    <!-- Features -->
    <div style="flex:1;background:#1e293b;border-radius:12px;padding:24px;">
      <div style="font-size:14px;font-weight:700;color:#f8fafc;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
        <span style="font-size:18px;">&#9889;</span> New Features (${data.features.length})
      </div>
      <div style="color:#cbd5e1;font-size:14px;">${featureItems}</div>
    </div>

    <!-- Conflicts -->
    <div style="flex:1;background:#1e293b;border-radius:12px;padding:24px;">
      <div style="font-size:14px;font-weight:700;color:#f8fafc;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
        <span style="font-size:18px;">&#9888;</span> Conflicts (${data.conflicts.length})
      </div>
      <div style="color:#cbd5e1;font-size:13px;">
        <div style="display:flex;gap:12px;margin-bottom:12px;">
          <span style="font-size:12px;"><span style="color:#ef4444;">&#9679;</span> ${severeCount} severe</span>
          <span style="font-size:12px;"><span style="color:#f59e0b;">&#9679;</span> ${moderateCount} moderate</span>
          <span style="font-size:12px;"><span style="color:#22c55e;">&#9679;</span> ${data.conflicts.length - severeCount - moderateCount} low</span>
        </div>
        ${conflictItems}
      </div>
    </div>
  </div>

  <!-- Rollback Plan -->
  <div style="background:#1e293b;border-radius:12px;padding:24px;">
    <div style="font-size:14px;font-weight:700;color:#f8fafc;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
      <span style="font-size:18px;">&#8634;</span> Rollback Plan
    </div>
    <div style="color:#cbd5e1;font-size:14px;">${rollbackItems}</div>
  </div>

  <!-- Footer -->
  <div style="margin-top:24px;text-align:center;color:#475569;font-size:11px;">
    Generated by EAC / Galvatron &bull; ClaudeClaw Autonomous Agent
  </div>

</div>
</body>
</html>`;
}

export interface StatusReportData {
  title: string;
  subtitle?: string;
  metrics: { label: string; value: string | number; trend?: 'up' | 'down' | 'neutral' }[];
  sections: { heading: string; items: string[] }[];
  footer?: string;
}

export function statusReportTemplate(data: StatusReportData): string {
  const trendIcon = { up: '&#9650;', down: '&#9660;', neutral: '&#8212;' };
  const trendColor = { up: '#22c55e', down: '#ef4444', neutral: '#94a3b8' };

  const metricCards = data.metrics
    .map(m => `
      <div style="flex:1;min-width:140px;background:#1e293b;border-radius:10px;padding:20px;text-align:center;">
        <div style="font-size:28px;font-weight:800;color:#f8fafc;">${m.value}</div>
        <div style="font-size:12px;color:#94a3b8;margin-top:4px;">${m.label}</div>
        ${m.trend ? `<div style="color:${trendColor[m.trend]};font-size:11px;margin-top:4px;">${trendIcon[m.trend]}</div>` : ''}
      </div>
    `)
    .join('');

  const sectionBlocks = data.sections
    .map(s => `
      <div style="background:#1e293b;border-radius:12px;padding:24px;margin-bottom:16px;">
        <div style="font-size:14px;font-weight:700;color:#f8fafc;margin-bottom:12px;">${s.heading}</div>
        ${s.items.map(item => `<div style="color:#cbd5e1;font-size:14px;padding:4px 0;display:flex;gap:8px;"><span style="color:#6366f1;">&#8226;</span>${item}</div>`).join('')}
      </div>
    `)
    .join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:1100px;margin:0 auto;padding:40px;">
  <div style="margin-bottom:28px;">
    <div style="font-size:32px;font-weight:800;color:#f8fafc;">${data.title}</div>
    ${data.subtitle ? `<div style="font-size:14px;color:#94a3b8;margin-top:4px;">${data.subtitle}</div>` : ''}
  </div>
  <div style="display:flex;gap:16px;margin-bottom:28px;flex-wrap:wrap;">${metricCards}</div>
  ${sectionBlocks}
  ${data.footer ? `<div style="margin-top:20px;text-align:center;color:#475569;font-size:11px;">${data.footer}</div>` : ''}
</div>
</body>
</html>`;
}
