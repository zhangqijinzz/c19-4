import { describe, expect, it } from 'vitest';
import { analyzeLayout, findBoundsIssues, findNarrowChannels, findOverlaps, getVisibleElements, summarizeByZone } from '../src/domain';
import type { ExpoElement, LayoutDocument, Zone } from '../src/types';

const item = (id: string, x: number, y: number, width = 4, height = 3): ExpoElement => ({ id, kind: 'booth', name: id, x, y, width, height, rotation: 0, zoneId: null });

const zone = (id: string, overrides: Partial<Zone> = {}): Zone => ({ id, name: id, color: '#000', locked: false, hidden: false, ...overrides });

const docWith = (zones: Zone[], elements: ExpoElement[]): LayoutDocument => ({ version: 1, title: 'x', field: { width: 20, height: 12 }, zones, elements });

describe('layout domain rules', () => {
  it('detects overlap area between two elements', () => {
    expect(findOverlaps([item('a', 1, 1), item('b', 3, 2)])).toEqual([{ firstId: 'a', secondId: 'b', amount: 4 }]);
  });

  it('detects field overflow and rotated bounds', () => {
    const rotated = { ...item('rotated', 8, 2, 2, 5), rotation: 90 };
    expect(findBoundsIssues({ width: 10, height: 10 }, [rotated])).toEqual([{ elementId: 'rotated', overflow: 3 }]);
  });

  it('flags a pass narrower than the minimum channel', () => {
    expect(findNarrowChannels([item('a', 1, 1), item('b', 5.5, 1)])).toEqual([{ firstId: 'a', secondId: 'b', gap: 0.5 }]);
  });

  it('returns a path when entrance and focus area exist', () => {
    const analysis = analyzeLayout({ version: 1, title: 'x', field: { width: 20, height: 12 }, zones: [], elements: [{ ...item('entry', 1, 5, 2, 1), kind: 'entrance' }, { ...item('stage', 10, 2, 5, 3), kind: 'stage' }] });
    expect(analysis.path?.points).toHaveLength(3);
    expect(analysis.path?.distance).toBeGreaterThan(0);
  });
});

describe('zone-aware analysis', () => {
  it('excludes hidden zones from the conclusion but keeps their issues visible in summaries', () => {
    const document = docWith(
      [zone('z1', { hidden: true })],
      [{ ...item('a', 1, 1), zoneId: 'z1' }, { ...item('b', 3, 2), zoneId: 'z1' }, item('c', 12, 1)],
    );
    const analysis = analyzeLayout(document);
    expect(analysis.overlaps).toHaveLength(0);
    expect(analysis.hiddenZoneCount).toBe(1);
    expect(analysis.hiddenElementCount).toBe(2);
    expect(analysis.excludedIssueCount).toBe(1);
    const summary = analysis.zoneSummaries.find((entry) => entry.zoneId === 'z1');
    expect(summary?.hidden).toBe(true);
    expect(summary?.overlaps).toBe(1);
    expect(summary?.elementCount).toBe(2);
  });

  it('keeps visible zones and unzoned elements in the conclusion', () => {
    const document = docWith(
      [zone('z1', { hidden: true }), zone('z2')],
      [{ ...item('a', 1, 1), zoneId: 'z1' }, { ...item('b', 1, 1), zoneId: 'z2' }, { ...item('c', 1.5, 1.5) }],
    );
    const analysis = analyzeLayout(document);
    expect(analysis.overlaps).toEqual([{ firstId: 'b', secondId: 'c', amount: 8.8 }]);
    expect(analysis.zoneSummaries.map((entry) => entry.zoneId)).toEqual(['z1', 'z2', null]);
  });

  it('treats elements referencing a missing zone as unzoned and visible', () => {
    const document = docWith([], [{ ...item('ghost', 1, 1), zoneId: 'deleted-zone' }]);
    expect(getVisibleElements(document)).toHaveLength(1);
    const summaries = summarizeByZone(document);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].zoneId).toBeNull();
    expect(summaries[0].elementCount).toBe(1);
  });
});
