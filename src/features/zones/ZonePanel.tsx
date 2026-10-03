import type { Zone, ZoneIssueSummary } from '../../types';

interface ZonePanelProps {
  zones: Zone[];
  hiddenZoneIds: string[];
  summaries: ZoneIssueSummary[];
  selectedZoneId: string | null;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onToggleLocked: (id: string) => void;
  onToggleHidden: (id: string) => void;
  onRemove: (id: string) => void;
}

export function ZonePanel({ zones, hiddenZoneIds, summaries, selectedZoneId, onAdd, onRename, onToggleLocked, onToggleHidden, onRemove }: ZonePanelProps) {
  const summaryByZone = new Map(summaries.map((summary) => [summary.zoneId, summary]));
  return <section className="panel zone-panel">
    <div className="panel-heading"><div><span className="section-kicker">ZONES</span><h2>分区</h2></div><span className="count-badge">{zones.length}</span></div>
    <p className="panel-hint">把元素归入分区；锁定整片防止误拖，隐藏只影响显示、不影响检查。</p>
    <div className="zone-list">
      {zones.length === 0 ? <div className="zone-empty">还没有分区，点击下方按钮创建。</div> : zones.map((zone) => {
        const hidden = hiddenZoneIds.includes(zone.id);
        const summary = summaryByZone.get(zone.id);
        return <div key={zone.id} className={`zone-row ${hidden ? 'is-hidden' : ''} ${selectedZoneId === zone.id ? 'is-zone-selected' : ''}`}>
          <span className="zone-swatch" style={{ background: zone.color }} />
          <input
            className="zone-name-input"
            aria-label="分区名称"
            value={zone.name}
            onChange={(event) => onRename(zone.id, event.target.value)}
          />
          <span className={`zone-issue-pill ${summary && summary.issueCount > 0 ? 'has-issues' : ''}`} title={hidden ? '该分区处于隐藏状态，问题仍计入检查结论' : '该分区的检查问题数（跨分区问题双方各计一次）'}>
            {summary ? summary.issueCount : 0}
          </span>
          <div className="zone-row-actions">
            <button type="button" className={`zone-icon-button ${zone.locked ? 'is-active' : ''}`} aria-label={zone.locked ? `解锁分区 ${zone.name}` : `锁定分区 ${zone.name}`} aria-pressed={zone.locked} title={zone.locked ? '解锁：恢复拖动' : '锁定：整片禁止误拖'} onClick={() => onToggleLocked(zone.id)}>{zone.locked ? '🔒' : '🔓'}</button>
            <button type="button" className={`zone-icon-button ${hidden ? 'is-active' : ''}`} aria-label={hidden ? `显示分区 ${zone.name}` : `隐藏分区 ${zone.name}`} aria-pressed={hidden} title={hidden ? '显示该分区' : '临时隐藏（仍计入检查）'} onClick={() => onToggleHidden(zone.id)}>{hidden ? '🚱' : '👁'}</button>
            <button type="button" className="zone-icon-button danger" aria-label={`删除分区 ${zone.name}（元素保留）`} title="删除分区，元素回到未分区（不会删除元素）" onClick={() => onRemove(zone.id)}>✕</button>
          </div>
          {hidden ? <span className="zone-hidden-flag">已隐藏 · 仍在检查范围内</span> : null}
          {zone.locked ? <span className="zone-locked-flag">已锁定</span> : null}
        </div>;
      })}
    </div>
    <button type="button" className="zone-add-button" onClick={onAdd}>＋ 新建分区</button>
  </section>;
}
