import { createElement, createStarterDocument, createZone, analyzeLayout, findElement, findZone, getVisibleElements, getBoundingBox, normalizeRotation } from './domain';
import type { LayoutRepository } from './repository';
import type { Analysis, ElementKind, LayoutDocument, LayoutMode, Notice, RenderElement, ViewPhase } from './types';

export interface ExpoSketchState {
  phase: ViewPhase;
  document: LayoutDocument;
  renderElements: RenderElement[];
  visibleElements: RenderElement[];
  selectedId: string | null;
  selectedElement: RenderElement | null;
  mode: LayoutMode;
  analysis: Analysis;
  notice: Notice;
  lastSavedAt: number | null;
}

const toRenderElements = (document: LayoutDocument): RenderElement[] => document.elements.map((element) => {
  const box = getBoundingBox(element);
  return { ...element, displayWidth: box.width, displayHeight: box.height, occupiedArea: Number((box.width * box.height).toFixed(1)) };
});

const starter = createStarterDocument();
const starterRenderElements = toRenderElements(starter);

type Listener = () => void;

export class ExpoSketchViewModel {
  private listeners = new Set<Listener>();
  private stateValue: ExpoSketchState = {
    phase: 'loading',
    document: starter,
    renderElements: starterRenderElements,
    visibleElements: starterRenderElements,
    selectedId: 'stage-1',
    selectedElement: starterRenderElements.find((element) => element.id === 'stage-1') ?? null,
    mode: 'edit',
    analysis: analyzeLayout(createStarterDocument()),
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

  addElement(kind: ElementKind) {
    const element = createElement(kind, this.stateValue.document.elements.length, this.stateValue.document.field);
    const document = { ...this.stateValue.document, elements: [...this.stateValue.document.elements, element] };
    this.commitAndPersist({ document, selectedId: element.id, notice: { tone: 'success', message: `${element.name} 已加入场地` } });
  }

  removeSelected() {
    if (!this.stateValue.selectedId) return;
    const removed = findElement(this.stateValue.document, this.stateValue.selectedId);
    const elements = this.stateValue.document.elements.filter((element) => element.id !== this.stateValue.selectedId);
    this.commitAndPersist({ document: { ...this.stateValue.document, elements }, selectedId: elements[0]?.id ?? null, notice: { tone: 'info', message: `${removed?.name ?? '元素'} 已移除` } });
  }

  moveElement(id: string, x: number, y: number) {
    const element = findElement(this.stateValue.document, id);
    const zone = findZone(this.stateValue.document, element?.zoneId);
    if (zone?.locked) return;
    const elements = this.stateValue.document.elements.map((item) => item.id === id ? { ...item, x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) } : item);
    this.commitAndPersist({ document: { ...this.stateValue.document, elements } });
  }

  resizeSelected(width: number, height: number) {
    const id = this.stateValue.selectedId;
    if (!id || width <= 0 || height <= 0) return;
    const elements = this.stateValue.document.elements.map((element) => element.id === id ? { ...element, width: Number(width.toFixed(1)), height: Number(height.toFixed(1)) } : element);
    this.commitAndPersist({ document: { ...this.stateValue.document, elements } });
  }

  rotateSelected() {
    const id = this.stateValue.selectedId;
    if (!id) return;
    const elements = this.stateValue.document.elements.map((element) => element.id === id ? { ...element, rotation: normalizeRotation(element.rotation + 90) } : element);
    this.commitAndPersist({ document: { ...this.stateValue.document, elements }, notice: { tone: 'info', message: '方向已旋转 90°' } });
  }

  renameSelected(name: string) {
    const id = this.stateValue.selectedId;
    if (!id || !name.trim()) return;
    const elements = this.stateValue.document.elements.map((element) => element.id === id ? { ...element, name: name.trim() } : element);
    this.commitAndPersist({ document: { ...this.stateValue.document, elements } });
  }

  addZone() {
    const zone = createZone(this.stateValue.document.zones.length);
    const document = { ...this.stateValue.document, zones: [...this.stateValue.document.zones, zone] };
    this.commitAndPersist({ document, notice: { tone: 'success', message: `${zone.name} 已创建，在属性面板可将元素归入该分区` } });
  }

  renameZone(id: string, name: string) {
    if (!name.trim()) return;
    const zones = this.stateValue.document.zones.map((zone) => zone.id === id ? { ...zone, name: name.trim() } : zone);
    this.commitAndPersist({ document: { ...this.stateValue.document, zones } });
  }

  toggleZoneLocked(id: string) {
    const zone = findZone(this.stateValue.document, id);
    if (!zone) return;
    const zones = this.stateValue.document.zones.map((item) => item.id === id ? { ...item, locked: !item.locked } : item);
    this.commitAndPersist({ document: { ...this.stateValue.document, zones }, notice: { tone: 'info', message: zone.locked ? `${zone.name} 已解锁，元素可拖动` : `${zone.name} 已上锁，内部元素不可拖动` } });
  }

  toggleZoneHidden(id: string) {
    const zone = findZone(this.stateValue.document, id);
    if (!zone) return;
    const zones = this.stateValue.document.zones.map((item) => item.id === id ? { ...item, hidden: !item.hidden } : item);
    this.commitAndPersist({ document: { ...this.stateValue.document, zones }, notice: { tone: 'warning', message: zone.hidden ? `${zone.name} 已恢复显示，重新计入检查结论` : `${zone.name} 已隐藏：其元素不参与检查结论，问题不会被清除` } });
  }

  removeZone(id: string) {
    const zone = findZone(this.stateValue.document, id);
    if (!zone) return;
    const zones = this.stateValue.document.zones.filter((item) => item.id !== id);
    let released = 0;
    const elements = this.stateValue.document.elements.map((element) => {
      if (element.zoneId !== id) return element;
      released += 1;
      return { ...element, zoneId: null };
    });
    this.commitAndPersist({ document: { ...this.stateValue.document, zones, elements }, notice: { tone: 'info', message: `${zone.name} 已删除，${released} 个元素回到未分区，未被删除` } });
  }

  assignSelectedZone(zoneId: string | null) {
    const id = this.stateValue.selectedId;
    if (!id) return;
    const zone = findZone(this.stateValue.document, zoneId);
    const elements = this.stateValue.document.elements.map((element) => element.id === id ? { ...element, zoneId: zone?.id ?? null } : element);
    this.commitAndPersist({ document: { ...this.stateValue.document, elements }, notice: { tone: 'success', message: zone ? `已归入 ${zone.name}` : '已移出分区，回到未分区' } });
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
    this.commitAndPersist({ document, selectedId: 'stage-1', mode: 'edit', notice: { tone: 'success', message: '已恢复示例布局' } });
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
    const visibleIds = new Set(getVisibleElements(next.document).map((element) => element.id));
    const visibleElements = renderElements.filter((element) => visibleIds.has(element.id));
    this.stateValue = { ...next, renderElements, visibleElements, selectedElement: visibleElements.find((element) => element.id === next.selectedId) ?? null, analysis: analyzeLayout(next.document) };
    this.listeners.forEach((listener) => listener());
  }
}
