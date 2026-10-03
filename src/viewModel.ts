import { createElement, createStarterDocument, createZone, analyzeLayout, findElement, getBoundingBox, normalizeRotation } from './domain';
import type { LayoutRepository } from './repository';
import type { Analysis, ElementKind, LayoutDocument, LayoutMode, Notice, RenderElement, ViewPhase } from './types';

export interface ExpoSketchState {
  phase: ViewPhase;
  document: LayoutDocument;
  renderElements: RenderElement[];
  selectedId: string | null;
  selectedElement: RenderElement | null;
  /** 元素 id -> 所属分区是否上锁的快速映射，画布据此禁用拖动。 */
  lockedElementIds: Set<string>;
  /** 临时隐藏的分区 id：仅视图状态，不持久化，也不影响检查口径。 */
  hiddenZoneIds: string[];
  mode: LayoutMode;
  analysis: Analysis;
  notice: Notice;
  lastSavedAt: number | null;
}

const toRenderElements = (document: LayoutDocument): RenderElement[] => document.elements.map((element) => {
  const box = getBoundingBox(element);
  return { ...element, displayWidth: box.width, displayHeight: box.height, occupiedArea: Number((box.width * box.height).toFixed(1)) };
});

const collectLockedElementIds = (document: LayoutDocument): Set<string> => {
  const lockedZoneIds = new Set(document.zones.filter((zone) => zone.locked).map((zone) => zone.id));
  return new Set(document.elements.filter((element) => element.zoneId && lockedZoneIds.has(element.zoneId)).map((element) => element.id));
};

const starter = createStarterDocument();
const starterRenderElements = toRenderElements(starter);

type Listener = () => void;

export class ExpoSketchViewModel {
  private listeners = new Set<Listener>();
  private stateValue: ExpoSketchState = {
    phase: 'loading',
    document: starter,
    renderElements: starterRenderElements,
    selectedId: 'stage-1',
    selectedElement: starterRenderElements.find((element) => element.id === 'stage-1') ?? null,
    lockedElementIds: collectLockedElementIds(starter),
    hiddenZoneIds: [],
    mode: 'edit',
    analysis: analyzeLayout(starter),
    notice: { tone: 'info', message: '正在恢复最近布局…' },
    lastSavedAt: null,
  };

  constructor(private readonly repository: LayoutRepository) {}

  get state() { return this.stateValue; }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async initialize() {
    try {
      const document = await this.repository.load();
      this.commit({ document, selectedId: document.elements[0]?.id ?? null, phase: 'ready', notice: { tone: 'success', message: '布局已就绪，可开始编辑' } });
    } catch {
      this.commit({ phase: 'error', notice: { tone: 'error', message: '布局读取失败，已载入安全示例' } });
    }
  }

  selectElement(id: string) { this.commit({ selectedId: id }); }

  setMode(mode: LayoutMode) { this.commit({ mode, notice: { tone: 'info', message: mode === 'inspect' ? '检查模式已开启：拖动元素查看即时提示' : mode === 'path' ? '路径模式已开启：入口到重点区域的访问路线已生成' : '编辑模式已开启' } }); }

  addElement(kind: ElementKind, zoneId: string | null = null) {
    const element = { ...createElement(kind, this.stateValue.document.elements.length, this.stateValue.document.field), zoneId };
    const document = { ...this.stateValue.document, elements: [...this.stateValue.document.elements, element] };
    this.commitAndPersist({ document, selectedId: element.id, notice: { tone: 'success', message: `${element.name} 已加入场地${zoneId ? '并归入分区' : ''}` } });
  }

  removeSelected() {
    if (!this.stateValue.selectedId) return;
    const removed = findElement(this.stateValue.document, this.stateValue.selectedId);
    const elements = this.stateValue.document.elements.filter((element) => element.id !== this.stateValue.selectedId);
    this.commitAndPersist({ document: { ...this.stateValue.document, elements }, selectedId: elements[0]?.id ?? null, notice: { tone: 'info', message: `${removed?.name ?? '元素'} 已移除` } });
  }

  private isLocked(id: string) {
    return this.stateValue.lockedElementIds.has(id);
  }

  moveElement(id: string, x: number, y: number) {
    if (this.isLocked(id)) {
      this.commit({ notice: { tone: 'warning', message: '该元素位于已锁定分区，请先解锁分区再拖动' } });
      return;
    }
    const elements = this.stateValue.document.elements.map((element) => element.id === id ? { ...element, x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) } : element);
    this.commitAndPersist({ document: { ...this.stateValue.document, elements } });
  }

  resizeSelected(width: number, height: number) {
    const id = this.stateValue.selectedId;
    if (!id || width <= 0 || height <= 0) return;
    if (this.isLocked(id)) {
      this.commit({ notice: { tone: 'warning', message: '已锁定分区内的元素不能调整尺寸' } });
      return;
    }
    const elements = this.stateValue.document.elements.map((element) => element.id === id ? { ...element, width: Number(width.toFixed(1)), height: Number(height.toFixed(1)) } : element);
    this.commitAndPersist({ document: { ...this.stateValue.document, elements } });
  }

  rotateSelected() {
    const id = this.stateValue.selectedId;
    if (!id) return;
    if (this.isLocked(id)) {
      this.commit({ notice: { tone: 'warning', message: '已锁定分区内的元素不能旋转' } });
      return;
    }
    const elements = this.stateValue.document.elements.map((element) => element.id === id ? { ...element, rotation: normalizeRotation(element.rotation + 90) } : element);
    this.commitAndPersist({ document: { ...this.stateValue.document, elements }, notice: { tone: 'info', message: '方向已旋转 90°' } });
  }

  renameSelected(name: string) {
    const id = this.stateValue.selectedId;
    if (!id || !name.trim()) return;
    const elements = this.stateValue.document.elements.map((element) => element.id === id ? { ...element, name: name.trim() } : element);
    this.commitAndPersist({ document: { ...this.stateValue.document, elements } });
  }

  /** 把元素归入分区；zoneId 为 null 表示移出分区、回到未分区状态。 */
  assignSelectedToZone(zoneId: string | null) {
    const id = this.stateValue.selectedId;
    if (!id) return;
    if (zoneId && !this.stateValue.document.zones.some((zone) => zone.id === zoneId)) return;
    const elements = this.stateValue.document.elements.map((element) => element.id === id ? { ...element, zoneId } : element);
    const zoneName = this.stateValue.document.zones.find((zone) => zone.id === zoneId)?.name;
    this.commitAndPersist({ document: { ...this.stateValue.document, elements }, notice: { tone: 'success', message: zoneName ? `已归入「${zoneName}」` : '已移出分区，回到未分组' } });
  }

  addZone() {
    const zone = createZone(this.stateValue.document.zones.length);
    const document = { ...this.stateValue.document, zones: [...this.stateValue.document.zones, zone] };
    this.commitAndPersist({ document, notice: { tone: 'success', message: `已创建分区「${zone.name}」` } });
  }

  renameZone(id: string, name: string) {
    if (!name.trim()) return;
    const zones = this.stateValue.document.zones.map((zone) => zone.id === id ? { ...zone, name: name.trim() } : zone);
    this.commitAndPersist({ document: { ...this.stateValue.document, zones } });
  }

  toggleZoneLocked(id: string) {
    const target = this.stateValue.document.zones.find((zone) => zone.id === id);
    if (!target) return;
    const zones = this.stateValue.document.zones.map((zone) => zone.id === id ? { ...zone, locked: !zone.locked } : zone);
    this.commitAndPersist({ document: { ...this.stateValue.document, zones }, notice: { tone: 'info', message: target.locked ? `分区「${target.name}」已解锁` : `分区「${target.name}」已锁定，内部元素不可拖动` } });
  }

  /** 临时隐藏是视图状态：不持久化、不改变检查结论。 */
  toggleZoneHidden(id: string) {
    const hiddenZoneIds = this.stateValue.hiddenZoneIds.includes(id)
      ? this.stateValue.hiddenZoneIds.filter((zoneId) => zoneId !== id)
      : [...this.stateValue.hiddenZoneIds, id];
    const target = this.stateValue.document.zones.find((zone) => zone.id === id);
    const nowHidden = hiddenZoneIds.includes(id);
    this.commit({ hiddenZoneIds, notice: { tone: 'info', message: nowHidden ? `分区「${target?.name}」已临时隐藏，但仍计入检查结论` : `分区「${target?.name}」已重新显示` } });
  }

  /** 删除分区：分区消失，但成员元素保留并回到未分区状态，仍可选中。 */
  removeZone(id: string) {
    const target = this.stateValue.document.zones.find((zone) => zone.id === id);
    if (!target) return;
    const detachedCount = this.stateValue.document.elements.filter((element) => element.zoneId === id).length;
    const zones = this.stateValue.document.zones.filter((zone) => zone.id !== id);
    const elements = this.stateValue.document.elements.map((element) => element.zoneId === id ? { ...element, zoneId: null } : element);
    const hiddenZoneIds = this.stateValue.hiddenZoneIds.filter((zoneId) => zoneId !== id);
    this.commitAndPersist({ document: { ...this.stateValue.document, zones, elements }, hiddenZoneIds, notice: { tone: 'info', message: `分区「${target.name}」已删除，${detachedCount} 个元素回到未分区状态，未被删除` } });
  }

  resizeField(width: number, height: number) {
    if (width < 12 || height < 10) return;
    this.commitAndPersist({ document: { ...this.stateValue.document, field: { width: Number(width.toFixed(1)), height: Number(height.toFixed(1)) } }, notice: { tone: 'success', message: '场地尺寸已更新' } });
  }

  renameProject(title: string) {
    if (!title.trim()) return;
    this.commitAndPersist({ document: { ...this.stateValue.document, title: title.trim() } });
  }

  resetExample() {
    const document = createStarterDocument();
    this.commitAndPersist({ document, selectedId: 'stage-1', hiddenZoneIds: [], mode: 'edit', notice: { tone: 'success', message: '已恢复示例布局' } });
  }

  private commitAndPersist(patch: Partial<ExpoSketchState>) {
    this.commit(patch);
    void this.persist();
  }

  private async persist() {
    try {
      await this.repository.save(this.stateValue.document);
      this.commit({ lastSavedAt: Date.now() });
    } catch {
      this.commit({ notice: { tone: 'error', message: '本地保存失败，当前编辑仍保留在页面中' } });
    }
  }

  private commit(patch: Partial<ExpoSketchState>) {
    const next = { ...this.stateValue, ...patch };
    const renderElements = toRenderElements(next.document);
    this.stateValue = {
      ...next,
      renderElements,
      lockedElementIds: collectLockedElementIds(next.document),
      selectedElement: renderElements.find((element) => element.id === next.selectedId) ?? null,
      analysis: analyzeLayout(next.document, next.hiddenZoneIds),
    };
    this.listeners.forEach((listener) => listener());
  }
}
