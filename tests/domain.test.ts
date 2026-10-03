import { describe, expect, it } from 'vitest';
import { analyzeLayout, findBoundsIssues, findNarrowChannels, findOverlaps, getZoneBounds } from '../src/domain';
import type { ExpoElement, LayoutDocument } from '../src/types';

const item = (id: string, x: number, y: number, width = 4, height = 3, zoneId: string | null = null): ExpoElement => ({ id, kind: 'booth', name: id, x, y, width, height, rotation: 0, zoneId });

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
    const document: LayoutDocument = { version: 1, title: 'x', field: { width: 20, height: 12 }, zones: [], elements: [{ ...item('entry', 1, 5, 2, 1), kind: 'entrance' }, { ...item('stage', 10, 2, 5, 3), kind: 'stage' }] };
    const analysis = analyzeLayout(document);
    expect(analysis.path?.points).toHaveLength(3);
    expect(analysis.path?.distance).toBeGreaterThan(0);
  });

  const zoneDoc = (): LayoutDocument => ({
    version: 1,
    title: 'zones',
    field: { width: 30, height: 20 },
    zones: [
      { id: 'z-a', name: '展位区', color: '#eaf3ff', locked: false },
      { id: 'z-b', name: '餐饮区', color: '#eef8ec', locked: false },
    ],
    elements: [
      item('a1', 1, 1, undefined, undefined, 'z-a'),
      item('a2', 3, 2, undefined, undefined, 'z-a'), // 与 a1 重叠（同区）
      item('b1', 20, 1, undefined, undefined, 'z-b'),
      item('free', 10, 15, undefined, undefined, null), // 未分区
    ],
  });

  it('summarizes issues per zone and keeps an unzoned bucket', () => {
    const analysis = analyzeLayout(zoneDoc());
    const zoneA = analysis.zoneSummaries.find((row) => row.zoneId === 'z-a');
    const zoneB = analysis.zoneSummaries.find((row) => row.zoneId === 'z-b');
    const unzoned = analysis.zoneSummaries.find((row) => row.zoneId === null);
    expect(zoneA?.overlaps).toBe(1);
    expect(zoneA?.elementCount).toBe(2);
    expect(zoneB?.issueCount).toBe(0);
    expect(unzoned?.elementCount).toBe(1);
    expect(unzoned?.zoneName).toBe('未分区');
  });

  it('counts a cross-zone overlap once in each zone without inflating the global total', () => {
    const doc = zoneDoc();
    doc.elements = [
      item('a1', 1, 1, undefined, undefined, 'z-a'),
      item('b1', 3, 2, undefined, undefined, 'z-b'), // 与 a1 重叠（跨区）
    ];
    const analysis = analyzeLayout(doc);
    expect(analysis.overlaps).toHaveLength(1);
    expect(analysis.zoneSummaries.find((row) => row.zoneId === 'z-a')?.overlaps).toBe(1);
    expect(analysis.zoneSummaries.find((row) => row.zoneId === 'z-b')?.overlaps).toBe(1);
  });

  it('still counts hidden zones in the global verdict and flags them on summary rows', () => {
    const analysis = analyzeLayout(zoneDoc(), ['z-a']);
    // 全局结论不受隐藏影响：重叠仍在
    expect(analysis.overlaps).toHaveLength(1);
    const zoneA = analysis.zoneSummaries.find((row) => row.zoneId === 'z-a');
    expect(zoneA?.hidden).toBe(true);
    expect(zoneA?.overlaps).toBe(1);
    expect(analysis.hiddenIssueCount).toBe(1);
    expect(analysis.hiddenElementCount).toBe(2);
    expect(analysis.hiddenZoneCount).toBe(1);
  });

  it('computes a zone frame from the union of member bounds plus padding', () => {
    const frame = getZoneBounds({ id: 'z-a', name: '展位区', color: '#fff', locked: false }, zoneDoc().elements);
    expect(frame).not.toBeNull();
    expect(frame?.memberCount).toBe(2);
    expect(frame?.left).toBeCloseTo(0.2, 5);
    expect(frame?.top).toBeCloseTo(0.2, 5);
  });
});
