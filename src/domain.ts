import type {
  Analysis,
  BoundsIssue,
  ChannelIssue,
  ElementKind,
  ElementSpec,
  ExpoElement,
  FieldSize,
  LayoutDocument,
  PathPreview,
  OverlapIssue,
  Zone,
  ZoneIssueSummary,
} from './types';

export const MIN_CHANNEL = 1.2;

export const ZONE_COLORS = ['#eaf3ff', '#eef8ec', '#fff1e4', '#f4ecfb', '#fdecec', '#e7f6f4'];

export const createZone = (index: number, name?: string): Zone => ({
  id: `zone-${Date.now()}-${index}`,
  name: name?.trim() || `分区 ${index + 1}`,
  color: ZONE_COLORS[index % ZONE_COLORS.length],
  locked: false,
});

/** 计算一片分区的外框（成员元素包围盒并集 + 内边距）；无成员返回 null。 */
export const getZoneBounds = (zone: Zone, elements: ExpoElement[]) => {
  const members = elements.filter((element) => element.zoneId === zone.id);
  if (!members.length) return null;
  const boxes = members.map(getBoundingBox);
  const padding = 0.8;
  const left = Math.min(...boxes.map((box) => box.left)) - padding;
  const top = Math.min(...boxes.map((box) => box.top)) - padding;
  const right = Math.max(...boxes.map((box) => box.right)) + padding;
  const bottom = Math.max(...boxes.map((box) => box.bottom)) + padding;
  return { left: Number(left.toFixed(1)), top: Number(top.toFixed(1)), width: Number((right - left).toFixed(1)), height: Number((bottom - top).toFixed(1)), memberCount: members.length };
};

export const ELEMENT_SPECS: Record<ElementKind, ElementSpec> = {
  booth: { kind: 'booth', label: '标准展位', eyebrow: 'BOOTH', icon: '▦', color: '#e7f0ff', width: 5, height: 3.5 },
  stage: { kind: 'stage', label: '主舞台', eyebrow: 'STAGE', icon: '✦', color: '#f2e9ff', width: 8, height: 4 },
  seating: { kind: 'seating', label: '观众座席', eyebrow: 'SEATING', icon: '▤', color: '#e6f7f2', width: 6, height: 3 },
  entrance: { kind: 'entrance', label: '入口', eyebrow: 'ENTRY', icon: '↗', color: '#fff2d8', width: 2.5, height: 1.5 },
};

export const createStarterDocument = (): LayoutDocument => ({
  version: 1,
  title: '春日创意市集 · A 区',
  field: { width: 28, height: 18 },
  zones: [
    { id: 'zone-booth', name: '展位片区', color: ZONE_COLORS[0], locked: false },
    { id: 'zone-activity', name: '活动片区', color: ZONE_COLORS[1], locked: false },
    { id: 'zone-dining', name: '餐饮片区', color: ZONE_COLORS[2], locked: false },
  ],
  elements: [
    { id: 'entry-1', kind: 'entrance', name: '主入口', x: 1, y: 8.25, width: 2.5, height: 1.5, rotation: 0, zoneId: null },
    { id: 'stage-1', kind: 'stage', name: '分享舞台', x: 10, y: 1.5, width: 8, height: 4, rotation: 0, zoneId: 'zone-activity' },
    { id: 'booth-1', kind: 'booth', name: '香氛展位', x: 4, y: 2, width: 5, height: 3.5, rotation: 0, zoneId: 'zone-booth' },
    { id: 'booth-2', kind: 'booth', name: '手作展位', x: 19, y: 2, width: 5, height: 3.5, rotation: 0, zoneId: 'zone-booth' },
    { id: 'seating-1', kind: 'seating', name: '休息座席', x: 10, y: 11, width: 6, height: 3, rotation: 0, zoneId: 'zone-dining' },
    { id: 'booth-3', kind: 'booth', name: '轻食摊位', x: 19, y: 11, width: 5, height: 3.5, rotation: 0, zoneId: 'zone-dining' },
  ],
});

export const createElement = (kind: ElementKind, index: number, field: FieldSize): ExpoElement => {
  const spec = ELEMENT_SPECS[kind];
  const offset = Math.min(index * 0.65, 4);
  return {
    id: `${kind}-${Date.now()}-${index}`,
    kind,
    name: `${spec.label} ${index + 1}`,
    x: Math.max(0.5, Math.min(field.width - spec.width - 0.5, (field.width - spec.width) / 2 + offset)),
    y: Math.max(0.5, Math.min(field.height - spec.height - 0.5, (field.height - spec.height) / 2 + offset)),
    width: spec.width,
    height: spec.height,
    rotation: 0,
  };
};

export const normalizeRotation = (rotation: number): number => ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;

export const getBoundingBox = (element: ExpoElement) => {
  const isQuarterTurn = normalizeRotation(element.rotation) % 180 !== 0;
  const width = isQuarterTurn ? element.height : element.width;
  const height = isQuarterTurn ? element.width : element.height;
  return { left: element.x, top: element.y, right: element.x + width, bottom: element.y + height, width, height };
};

const intersectionSize = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));

export const findOverlaps = (elements: ExpoElement[]): OverlapIssue[] => {
  const issues: OverlapIssue[] = [];
  for (let i = 0; i < elements.length; i += 1) {
    const first = getBoundingBox(elements[i]);
    for (let j = i + 1; j < elements.length; j += 1) {
      const second = getBoundingBox(elements[j]);
      const overlapX = intersectionSize(first.left, first.right, second.left, second.right);
      const overlapY = intersectionSize(first.top, first.bottom, second.top, second.bottom);
      if (overlapX > 0 && overlapY > 0) {
        issues.push({ firstId: elements[i].id, secondId: elements[j].id, amount: Number((overlapX * overlapY).toFixed(1)) });
      }
    }
  }
  return issues;
};

export const findBoundsIssues = (field: FieldSize, elements: ExpoElement[]): BoundsIssue[] =>
  elements.flatMap((element) => {
    const box = getBoundingBox(element);
    const overflow = Math.max(0, -box.left, -box.top, box.right - field.width, box.bottom - field.height);
    return overflow > 0 ? [{ elementId: element.id, overflow: Number(overflow.toFixed(1)) }] : [];
  });

export const findNarrowChannels = (elements: ExpoElement[]): ChannelIssue[] => {
  const issues: ChannelIssue[] = [];
  for (let i = 0; i < elements.length; i += 1) {
    const first = getBoundingBox(elements[i]);
    for (let j = i + 1; j < elements.length; j += 1) {
      const second = getBoundingBox(elements[j]);
      const verticalOverlap = intersectionSize(first.top, first.bottom, second.top, second.bottom);
      const horizontalOverlap = intersectionSize(first.left, first.right, second.left, second.right);
      const horizontalGap = first.right <= second.left ? second.left - first.right : second.right <= first.left ? first.left - second.right : 0;
      const verticalGap = first.bottom <= second.top ? second.top - first.bottom : second.bottom <= first.top ? first.top - second.bottom : 0;
      const gap = verticalOverlap > 0 ? horizontalGap : horizontalOverlap > 0 ? verticalGap : 0;
      if (gap > 0 && gap < MIN_CHANNEL) issues.push({ firstId: elements[i].id, secondId: elements[j].id, gap: Number(gap.toFixed(1)) });
    }
  }
  return issues;
};

const distance = (first: { x: number; y: number }, second: { x: number; y: number }) => Math.hypot(second.x - first.x, second.y - first.y);

export const createPathPreview = (elements: ExpoElement[]): PathPreview | null => {
  const entrance = elements.find((element) => element.kind === 'entrance');
  const target = elements.find((element) => element.kind === 'stage') ?? elements.find((element) => element.kind !== 'entrance');
  if (!entrance || !target) return null;
  const startBox = getBoundingBox(entrance);
  const targetBox = getBoundingBox(target);
  const start = { x: startBox.left + startBox.width / 2, y: startBox.top + startBox.height / 2 };
  const end = { x: targetBox.left + targetBox.width / 2, y: targetBox.top + targetBox.height / 2 };
  const elbow = { x: end.x, y: start.y };
  return { points: [start, elbow, end], distance: Number((distance(start, elbow) + distance(elbow, end)).toFixed(1)), fromName: entrance.name, toName: target.name };
};

/**
 * 检查口径：隐藏只影响画布显示，检查始终覆盖全部元素。
 * hiddenZoneIds 仅用于给汇总行打“已隐藏”标记、以及统计隐藏分区内的问题数，
 * 不会把隐藏分区的问题从结论中剔除。
 */
export const analyzeLayout = (document: LayoutDocument, hiddenZoneIds: readonly string[] = []): Analysis => {
  const overlaps = findOverlaps(document.elements);
  const bounds = findBoundsIssues(document.field, document.elements);
  const channels = findNarrowChannels(document.elements);
  const path = createPathPreview(document.elements);
  const zoneSummaries = summarizeZones(document, new Set(hiddenZoneIds), { overlaps, bounds, channels });
  const hidden = new Set(hiddenZoneIds);
  const zoneOf = (id: string) => document.elements.find((element) => element.id === id)?.zoneId ?? null;
  const touchesHidden = (ids: string[]) => ids.some((id) => hidden.has(zoneOf(id) ?? ''));
  const hiddenIssueCount = new Set<string>([
    ...overlaps.filter((issue) => touchesHidden([issue.firstId, issue.secondId])).map((issue) => `o:${issue.firstId}:${issue.secondId}`),
    ...channels.filter((issue) => touchesHidden([issue.firstId, issue.secondId])).map((issue) => `c:${issue.firstId}:${issue.secondId}`),
    ...bounds.filter((issue) => touchesHidden([issue.elementId])).map((issue) => `b:${issue.elementId}`),
  ]).size;
  return {
    overlaps,
    bounds,
    channels,
    path,
    zoneSummaries,
    hiddenIssueCount,
    hiddenElementCount: document.elements.filter((element) => element.zoneId && hidden.has(element.zoneId)).length,
    hiddenZoneCount: document.zones.filter((zone) => hidden.has(zone.id)).length,
  };
};

const summarizeZones = (
  document: LayoutDocument,
  hidden: Set<string>,
  issues: Pick<Analysis, 'overlaps' | 'bounds' | 'channels'>,
): ZoneIssueSummary[] => {
  const counters = new Map<string | null, { overlaps: number; bounds: number; channels: number }>();
  const bump = (zoneId: string | null, kind: 'overlaps' | 'bounds' | 'channels') => {
    const current = counters.get(zoneId) ?? { overlaps: 0, bounds: 0, channels: 0 };
    current[kind] += 1;
    counters.set(zoneId, current);
  };
  // 跨分区问题在涉及的每个分区各计一次；未分区端计入“未分区”行。
  issues.overlaps.forEach((issue) => new Set([zoneIdOf(document, issue.firstId), zoneIdOf(document, issue.secondId)]).forEach((zoneId) => bump(zoneId, 'overlaps')));
  issues.channels.forEach((issue) => new Set([zoneIdOf(document, issue.firstId), zoneIdOf(document, issue.secondId)]).forEach((zoneId) => bump(zoneId, 'channels')));
  issues.bounds.forEach((issue) => bump(zoneIdOf(document, issue.elementId), 'bounds'));

  const rowFor = (zoneId: string | null, name: string, color: string, locked: boolean, isHidden: boolean, elementCount: number): ZoneIssueSummary => {
    const counter = counters.get(zoneId) ?? { overlaps: 0, bounds: 0, channels: 0 };
    return { zoneId, zoneName: name, color, elementCount, hidden: isHidden, locked, ...counter, issueCount: counter.overlaps + counter.bounds + counter.channels };
  };

  const rows = document.zones.map((zone) => rowFor(zone.id, zone.name, zone.color, zone.locked, hidden.has(zone.id), document.elements.filter((element) => element.zoneId === zone.id).length));
  const unzonedCount = document.elements.filter((element) => !element.zoneId).length;
  if (unzonedCount > 0 || counters.has(null)) rows.push(rowFor(null, '未分区', '#f1f4f7', false, false, unzonedCount));
  return rows;
};

const zoneIdOf = (document: LayoutDocument, elementId: string): string | null => document.elements.find((element) => element.id === elementId)?.zoneId ?? null;

export const findElement = (document: LayoutDocument, id: string | null) => document.elements.find((element) => element.id === id) ?? null;

export const formatArea = (field: FieldSize) => `${field.width} × ${field.height} m`;
