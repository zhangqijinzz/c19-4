import type { Analysis, LayoutMode } from '../../types';

interface AnalysisPanelProps { analysis: Analysis; mode: LayoutMode; elementCount: number; }

export function AnalysisPanel({ analysis, mode, elementCount }: AnalysisPanelProps) {
  const issueCount = analysis.overlaps.length + analysis.bounds.length + analysis.channels.length;
  const pathMessage = analysis.path ? `${analysis.path.fromName} → ${analysis.path.toName} · ${analysis.path.distance} m` : '需要入口和重点区域才能生成路径';
  return <section className={`analysis-panel analysis-${mode}`}>
    <div className="analysis-title"><span className="analysis-pulse" /><div><span className="section-kicker">LIVE ANALYSIS</span><strong>{mode === 'path' ? '访问路径预览' : mode === 'inspect' ? '空间检查结果' : '布局概览'}</strong></div></div>
    <div className="analysis-metrics"><span><b>{elementCount}</b>元素</span><span className={analysis.overlaps.length ? 'metric-warning' : ''}><b>{analysis.overlaps.length}</b>重叠</span><span className={analysis.bounds.length ? 'metric-warning' : ''}><b>{analysis.bounds.length}</b>越界</span><span className={analysis.channels.length ? 'metric-warning' : ''}><b>{analysis.channels.length}</b>窄通道</span></div>
    <div className="analysis-result"><strong>{issueCount ? `${issueCount} 项需要关注` : '当前布局通行顺畅'}</strong><small>{pathMessage}</small></div>
    {analysis.hiddenZoneCount > 0 ? <div className="hidden-zone-notice">⚠ 已隐藏 {analysis.hiddenZoneCount} 个分区（{analysis.hiddenElementCount} 个元素）：{analysis.excludedIssueCount} 项问题未计入以上结论，隐藏不等于没有问题</div> : null}
    <div className="zone-summary-row">
      {analysis.zoneSummaries.map((summary) => {
        const issues = summary.overlaps + summary.bounds + summary.channels;
        return <div key={summary.zoneId ?? 'unzoned'} className={`zone-chip ${summary.hidden ? 'is-excluded' : ''}`}>
          <i style={{ background: summary.color }} />
          <strong>{summary.name}</strong>
          <span>{summary.elementCount} 元素</span>
          <span className={issues ? 'chip-warning' : 'chip-clear'}>{issues ? `${issues} 问题` : '顺畅'}</span>
          <small>{summary.overlaps} 重叠 · {summary.bounds} 越界 · {summary.channels} 窄通道</small>
          {summary.hidden ? <em>未计入结论</em> : null}
        </div>;
      })}
    </div>
  </section>;
}
