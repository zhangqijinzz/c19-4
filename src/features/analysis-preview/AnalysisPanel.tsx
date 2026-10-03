import type { Analysis, LayoutMode } from '../../types';

interface AnalysisPanelProps { analysis: Analysis; mode: LayoutMode; elementCount: number; }

export function AnalysisPanel({ analysis, mode, elementCount }: AnalysisPanelProps) {
  const issueCount = analysis.overlaps.length + analysis.bounds.length + analysis.channels.length;
  const pathMessage = analysis.path ? `${analysis.path.fromName} → ${analysis.path.toName} · ${analysis.path.distance} m` : '需要入口和重点区域才能生成路径';
  return <section className={`analysis-panel analysis-${mode} analysis-expanded`}>
    <div className="analysis-headline">
      <div className="analysis-title"><span className="analysis-pulse" /><div><span className="section-kicker">LIVE ANALYSIS</span><strong>{mode === 'path' ? '访问路径预览' : mode === 'inspect' ? '空间检查结果' : '布局概览'}</strong></div></div>
      <div className="analysis-metrics"><span><b>{elementCount}</b>元素</span><span className={analysis.overlaps.length ? 'metric-warning' : ''}><b>{analysis.overlaps.length}</b>重叠</span><span className={analysis.bounds.length ? 'metric-warning' : ''}><b>{analysis.bounds.length}</b>越界</span><span className={analysis.channels.length ? 'metric-warning' : ''}><b>{analysis.channels.length}</b>窄通道</span></div>
      <div className="analysis-result"><strong>{issueCount ? `${issueCount} 项需要关注` : '当前布局通行顺畅'}</strong><small>{pathMessage}</small></div>
    </div>
    <div className="analysis-zone-breakdown">
      <div className="breakdown-heading">
        <span className="section-kicker">BY ZONE · 按分区汇总</span>
        <span className={`hidden-policy-badge ${analysis.hiddenZoneCount ? 'is-active' : ''}`} title="隐藏只是不显示；检查始终覆盖所有元素和分区">
          {analysis.hiddenZoneCount ? `🔕 ${analysis.hiddenZoneCount} 个分区已隐藏 · 仍计入检查（${analysis.hiddenIssueCount} 项问题）` : '🔍 检查口径：隐藏的分区照常计入结论'}
        </span>
      </div>
      <div className="zone-breakdown-list">
        {analysis.zoneSummaries.length === 0 ? <span className="breakdown-empty">所有元素均未分区</span> : analysis.zoneSummaries.map((summary) => (
          <div key={summary.zoneId ?? 'unzoned'} className={`breakdown-row ${summary.issueCount ? 'has-issues' : 'is-clear'} ${summary.hidden ? 'is-hidden-row' : ''}`} title={summary.zoneId === null ? '尚未归入任何分区的元素' : undefined}>
            <span className="breakdown-swatch" style={{ background: summary.color }} />
            <span className="breakdown-name">{summary.zoneName}{summary.zoneId === null ? '' : null}<em className="breakdown-count">{summary.elementCount} 个元素</em>{summary.locked ? <em className="breakdown-flag">已锁定</em> : null}{summary.hidden ? <em className="breakdown-flag flag-hidden">已隐藏·仍检查</em> : null}</span>
            <span className="breakdown-numbers">
              <em className={summary.overlaps ? 'num-warning' : ''}>{summary.overlaps} 重叠</em>
              <em className={summary.bounds ? 'num-warning' : ''}>{summary.bounds} 越界</em>
              <em className={summary.channels ? 'num-warning' : ''}>{summary.channels} 窄通道</em>
              <b className={summary.issueCount ? 'num-warning' : ''}>{summary.issueCount}</b>
            </span>
          </div>
        ))}
      </div>
      <small className="breakdown-footnote">跨分区的问题会在涉及的两个分区各计一次，因此分区问题数之和可能大于顶部总数。</small>
    </div>
  </section>;
}
