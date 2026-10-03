import type { RenderElement, Zone } from '../../types';

interface InspectorPanelProps {
  selectedElement: RenderElement | null;
  zones: Zone[];
  selectedElementHidden: boolean;
  onRename: (name: string) => void;
  onResize: (width: number, height: number) => void;
  onRotate: () => void;
  onDelete: () => void;
  onAssignZone: (zoneId: string | null) => void;
}

export function InspectorPanel({ selectedElement, zones, selectedElementHidden, onRename, onResize, onRotate, onDelete, onAssignZone }: InspectorPanelProps) {
  return <section className="panel inspector-panel">
    <div className="panel-heading"><div><span className="section-kicker">SELECTION</span><h2>属性面板</h2></div><span className="selection-indicator" /></div>
    {selectedElement ? <SelectedFields element={selectedElement} zones={zones} hiddenByZone={selectedElementHidden} onRename={onRename} onResize={onResize} onRotate={onRotate} onDelete={onDelete} onAssignZone={onAssignZone} /> : <div className="empty-inspector"><span>⌁</span><p>点击场地中的元素<br />开始调整布局</p></div>}
  </section>;
}

interface SelectedFieldsProps { element: RenderElement; zones: Zone[]; hiddenByZone: boolean; onRename: (name: string) => void; onResize: (width: number, height: number) => void; onRotate: () => void; onDelete: () => void; onAssignZone: (zoneId: string | null) => void; }

function SelectedFields({ element, zones, hiddenByZone, onRename, onResize, onRotate, onDelete, onAssignZone }: SelectedFieldsProps) {
  const zone = zones.find((item) => item.id === element.zoneId) ?? null;
  const readOnly = !!zone?.locked;
  return <div className="selected-fields">
    <div className="selected-kind"><span className="selected-symbol">{element.kind === 'stage' ? '✦' : element.kind === 'entrance' ? '↗' : element.kind === 'seating' ? '▤' : '▦'}</span><div><strong>{element.kind.toUpperCase()}</strong><small>ID · {element.id.slice(0, 12)}</small></div></div>
    <label className="field-label-input">名称<input aria-label="元素名称" value={element.name} onChange={(event) => onRename(event.target.value)} /></label>
    <label className="zone-assign">所属分区
      <select aria-label="所属分区" value={element.zoneId ?? ''} onChange={(event) => onAssignZone(event.target.value || null)}>
        <option value="">未分区</option>
        {zones.map((item) => <option key={item.id} value={item.id}>{item.name}{item.locked ? '（已锁定）' : ''}</option>)}
      </select>
    </label>
    {hiddenByZone ? <p className="zone-readonly-note hidden-note">该元素所在分区已临时隐藏，画布上不显示，但仍可在此编辑、仍计入检查。</p> : null}
    {readOnly ? <p className="zone-readonly-note">该元素位于已锁定分区，尺寸与旋转被禁用；解锁分区后可继续调整。</p> : null}
    <div className="dimension-grid"><label>宽度<input aria-label="元素宽度" type="number" min="1" step="0.5" value={element.width} disabled={readOnly} onChange={(event) => onResize(Number(event.target.value), element.height)} /></label><label>深度<input aria-label="元素深度" type="number" min="1" step="0.5" value={element.height} disabled={readOnly} onChange={(event) => onResize(element.width, Number(event.target.value))} /></label></div>
    <div className="transform-readout"><span>位置 <strong>{element.x.toFixed(1)}, {element.y.toFixed(1)}</strong></span><span>旋转 <strong>{element.rotation}°</strong></span><span>占地 <strong>{element.occupiedArea.toFixed(1)} m²</strong></span></div>
    <div className="inspector-actions"><button type="button" className="secondary-button" disabled={readOnly} onClick={onRotate}>↻ 旋转 90°</button><button type="button" className="icon-button danger" aria-label="删除元素" onClick={onDelete}>⌫</button></div>
  </div>;
}
