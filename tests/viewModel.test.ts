import { describe, expect, it, vi } from 'vitest';
import { createStarterDocument } from '../src/domain';
import type { LayoutRepository } from '../src/repository';
import type { LayoutDocument } from '../src/types';
import { ExpoSketchViewModel } from '../src/viewModel';

const fakeRepository = (initial: LayoutDocument | null = null): LayoutRepository => ({
  load: vi.fn(async () => initial ?? createStarterDocument()),
  save: vi.fn(async (_document) => {}),
});

describe('ExpoSketchViewModel', () => {
  it('initializes and updates the selected layout', async () => {
    const repository = fakeRepository();
    const vm = new ExpoSketchViewModel(repository);
    await vm.initialize();
    expect(vm.state.phase).toBe('ready');
    const count = vm.state.document.elements.length;
    vm.addElement('booth');
    expect(vm.state.document.elements).toHaveLength(count + 1);
    expect(vm.state.selectedId).toContain('booth-');
  });

  it('updates analysis immediately after moving an element into an overlap', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.moveElement('stage-1', 4.5, 2.5);
    expect(vm.state.analysis.overlaps.length).toBeGreaterThan(0);
  });

  it('recovers the example if repository loading fails', async () => {
    const repository: LayoutRepository = { load: vi.fn(async () => { throw new Error('bad storage'); }), save: vi.fn(async () => {}) };
    const vm = new ExpoSketchViewModel(repository);
    await vm.initialize();
    expect(vm.state.phase).toBe('error');
    expect(vm.state.document.title).toContain('春日创意市集');
  });

  it('shows a save error without dropping the working document', async () => {
    const repository: LayoutRepository = { load: vi.fn(async () => createStarterDocument()), save: vi.fn(async () => { throw new Error('quota'); }) };
    const vm = new ExpoSketchViewModel(repository);
    await vm.initialize();
    vm.addElement('stage');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(vm.state.document.elements.some((element) => element.kind === 'stage' && element.id.startsWith('stage-'))).toBe(true);
    expect(vm.state.notice.tone).toBe('error');
  });

  it('ignores invalid dimensions instead of corrupting the working selection', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    const before = vm.state.document.elements[0].width;
    vm.resizeSelected(0, 0);
    expect(vm.state.document.elements[0].width).toBe(before);
  });

  it('locks a zone and blocks moving, resizing and rotating its elements while keeping them selectable', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.selectElement('stage-1');
    expect(vm.state.selectedElement?.zoneId).toBe('zone-activity');
    vm.toggleZoneLocked('zone-activity');
    expect(vm.state.lockedElementIds.has('stage-1')).toBe(true);

    const before = vm.state.document.elements.find((element) => element.id === 'stage-1');
    vm.moveElement('stage-1', 99, 99);
    const after = vm.state.document.elements.find((element) => element.id === 'stage-1');
    expect(after?.x).toBe(before?.x);
    expect(after?.y).toBe(before?.y);
    expect(vm.state.notice.tone).toBe('warning');

    vm.resizeSelected(20, 20);
    expect(vm.state.document.elements.find((element) => element.id === 'stage-1')?.width).toBe(before?.width);
    vm.rotateSelected();
    expect(vm.state.document.elements.find((element) => element.id === 'stage-1')?.rotation).toBe(0);

    // 解锁后恢复可拖动
    vm.toggleZoneLocked('zone-activity');
    vm.moveElement('stage-1', 12, 3);
    expect(vm.state.document.elements.find((element) => element.id === 'stage-1')?.x).toBe(12);
  });

  it('keeps hidden zones inside the analysis verdict (hiding is not fixing)', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    // 先制造一个位于展位区的重叠
    vm.moveElement('booth-2', 4.5, 2.5);
    const totalOverlaps = vm.state.analysis.overlaps.length;
    expect(totalOverlaps).toBeGreaterThan(0);

    vm.toggleZoneHidden('zone-booth');
    expect(vm.state.hiddenZoneIds).toContain('zone-booth');
    // 全局结论数量不变
    expect(vm.state.analysis.overlaps).toHaveLength(totalOverlaps);
    expect(vm.state.analysis.hiddenIssueCount).toBeGreaterThan(0);
    const boothRow = vm.state.analysis.zoneSummaries.find((row) => row.zoneId === 'zone-booth');
    expect(boothRow?.hidden).toBe(true);
    expect(boothRow?.issueCount).toBeGreaterThan(0);
  });

  it('removes a zone without deleting its elements: they become unzoned and stay selectable', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    const memberIds = vm.state.document.elements.filter((element) => element.zoneId === 'zone-booth').map((element) => element.id);
    expect(memberIds.length).toBeGreaterThan(0);

    vm.removeZone('zone-booth');
    expect(vm.state.document.zones.some((zone) => zone.id === 'zone-booth')).toBe(false);
    const survivors = vm.state.document.elements.filter((element) => memberIds.includes(element.id));
    expect(survivors).toHaveLength(memberIds.length);
    expect(survivors.every((element) => element.zoneId === null)).toBe(true);

    // 元素仍可选中
    vm.selectElement(memberIds[0]);
    expect(vm.state.selectedElement?.id).toBe(memberIds[0]);
    // 隐藏状态里也清掉了被删的分区
    expect(vm.state.hiddenZoneIds).not.toContain('zone-booth');
  });

  it('assigns the selected element to a zone and back to unzoned', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.selectElement('entry-1');
    expect(vm.state.selectedElement?.zoneId ?? null).toBeNull();
    vm.assignSelectedToZone('zone-dining');
    expect(vm.state.document.elements.find((element) => element.id === 'entry-1')?.zoneId).toBe('zone-dining');
    vm.assignSelectedToZone(null);
    expect(vm.state.document.elements.find((element) => element.id === 'entry-1')?.zoneId).toBeNull();
  });

  it('persists the locked flag with the document while hidden stays a view-only state', async () => {
    const repository = fakeRepository();
    const vm = new ExpoSketchViewModel(repository);
    await vm.initialize();
    vm.toggleZoneLocked('zone-booth');
    vm.toggleZoneHidden('zone-booth');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const calls = vi.mocked(repository.save).mock.calls;
    const saved = calls[calls.length - 1]?.[0];
    expect(saved?.zones.find((zone: { id: string }) => zone.id === 'zone-booth')?.locked).toBe(true);
    expect(Object.keys(saved ?? {})).not.toContain('hiddenZoneIds');
    expect(vm.state.hiddenZoneIds).toContain('zone-booth');
  });
});
