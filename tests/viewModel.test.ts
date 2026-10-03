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

  it('blocks dragging elements whose zone is locked', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.toggleZoneLocked('zone-event');
    vm.moveElement('stage-1', 20, 10);
    const stage = vm.state.document.elements.find((element) => element.id === 'stage-1');
    expect(stage?.x).toBe(10);
    expect(stage?.y).toBe(1.5);
    vm.toggleZoneLocked('zone-event');
    vm.moveElement('stage-1', 20, 10);
    expect(vm.state.document.elements.find((element) => element.id === 'stage-1')?.x).toBe(20);
  });

  it('returns elements to the unzoned pool when a zone is removed', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.removeZone('zone-booth');
    expect(vm.state.document.zones.some((zone) => zone.id === 'zone-booth')).toBe(false);
    const booths = vm.state.document.elements.filter((element) => element.kind === 'booth');
    expect(booths).toHaveLength(2);
    expect(booths.every((element) => element.zoneId === null)).toBe(true);
    expect(vm.state.visibleElements.some((element) => element.id === 'booth-1')).toBe(true);
  });

  it('excludes hidden zones from the analysis conclusion and the canvas, without deleting elements', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.toggleZoneHidden('zone-booth');
    expect(vm.state.analysis.hiddenZoneCount).toBe(1);
    expect(vm.state.analysis.hiddenElementCount).toBe(2);
    expect(vm.state.visibleElements.some((element) => element.zoneId === 'zone-booth')).toBe(false);
    expect(vm.state.document.elements.filter((element) => element.zoneId === 'zone-booth')).toHaveLength(2);
    expect(vm.state.analysis.zoneSummaries.find((summary) => summary.zoneId === 'zone-booth')?.hidden).toBe(true);
    vm.toggleZoneHidden('zone-booth');
    expect(vm.state.analysis.hiddenZoneCount).toBe(0);
    expect(vm.state.visibleElements.some((element) => element.zoneId === 'zone-booth')).toBe(true);
  });

  it('assigns the selected element to a zone and back to unzoned', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.selectElement('entry-1');
    vm.assignSelectedZone('zone-event');
    expect(vm.state.document.elements.find((element) => element.id === 'entry-1')?.zoneId).toBe('zone-event');
    vm.assignSelectedZone(null);
    expect(vm.state.document.elements.find((element) => element.id === 'entry-1')?.zoneId).toBeNull();
  });
});
