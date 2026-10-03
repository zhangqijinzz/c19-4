import type { Zone, ZoneSummary } from '../../types';

interface ZonePanelProps {
  zones: Zone[];
  summaries: ZoneSummary[];
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onToggleLock: (id: string) => void;
  onToggleHidden: (id: string) => void;
  onRemove: (id: string) => void;
}

export function ZonePanel({ zones, summaries, onAdd, onRename, onToggleLock, onToggleHidden, onRemove }: ZonePanelProps) {
  const summaryByZoneId = new Map(summaries.map((summary) => [summary.zoneId, summary]));
  const unzoned = summaries.find((summary) => summary.zoneId === null);
  const hiddenCount = zones.filter((zone) => zone.hidden).length;
  return (
    <section className="panel zone-panel">
      <div className="panel-heading"><div><span className="section-kicker">ZONES</span><h2>分区管理</h2></div><button type="button" className="zone-add" aria-label="新增分区" onClick={onAdd}>+</button></div>
      <p className="panel-hint">把元素归入分区：上锁防止误拖，隐藏可临时只看部分内容。</p>
      <div className="zone-list">
        {zones.map((zone) => {
          const summary = summaryByZoneId.get(zone.id);
          const issues = (summary?.overlaps ?? 0) + (summary?.bounds ?? 0) + (summary?.channels ?? 0);
          return <div key={zone.id} className={`zone-row ${zone.hidden ? 'is-hidden' : ''}`}>
            <i className="zone-color" style={{ background: zone.color }} />
            <input className="zone-name" aria-label={`分区名称 ${zone.name}`} defaultValue={zone.name} key={`${zone.id}-${zone.name}`} onBlur={(event) => { if (event.target.value.trim() && event.target.value.trim() !== zone.name) onRename(zone.id, event.target.value); }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
            <span className={`zone-count ${issues && !zone.hidden ? 'has-issues' : ''}`} title={`${summary?.elementCount ?? 0} 个元素 · ${issues} 项问题`}>{summary?.elementCount ?? 0}</span>
            <button type="button" className={`zone-toggle ${zone.locked ? 'active' : ''}`} aria-label={`${zone.locked ? '解锁' : '锁定'} ${zone.name}`} title={zone.locked ? '解锁分区' : '锁定分区（内部元素不可拖动）'} onClick={() => onToggleLock(zone.id)}>{zone.locked ? '🔒' : '🔓'}</button>
            <button type="button" className={`zone-toggle ${zone.hidden ? 'active' : ''}`} aria-label={`${zone.hidden ? '显示' : '隐藏'} ${zone.name}`} title={zone.hidden ? '恢复显示（重新计入检查结论）' : '隐藏分区（不计入检查结论）'} onClick={() => onToggleHidden(zone.id)}>{zone.hidden ? '◌' : '◉'}</button>
            <button type="button" className="zone-toggle danger" aria-label={`删除 ${zone.name}`} title="删除分区（元素回到未分区，不会被删除）" onClick={() => onRemove(zone.id)}>⌫</button>
          </div>;
        })}
        {zones.length === 0 ? <p className="zone-empty">还没有分区，点击 + 创建。</p> : null}
      </div>
      <div className="zone-unzoned"><span>未分区元素</span><strong>{unzoned?.elementCount ?? 0}</strong></div>
      <p className="zone-policy">口径：隐藏的分区不参与检查结论（当前 {hiddenCount} 个隐藏中），其问题不会被清除，恢复显示后重新计入。删除分区时元素回到未分区，不会跟着消失。</p>
    </section>
  );
}
