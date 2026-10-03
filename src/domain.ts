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
  ZoneSummary,
} from './types';

export const MIN_CHANNEL = 1.2;

export const ZONE_COLORS = ['#5b8def', '#ef795f', '#8f6fd8', '#3fa98a', '#e0a23f', '#d66f9e'];

export const UNZONED_LABEL = '未分区';

export const ELEMENT_SPECS: Record<ElementKind, ElementSpec> = {
  booth: { kind: 'booth', label: '标准展位', eyebrow: 'BOOTH', icon: '▦', color: '#e7f0ff', width: 5, height: 3.5 },
  stage: { kind: 'stage', label: '主舞台', eyebrow: 'STAGE', icon: '✦', color: '#f2e9ff', width: 8, height: 4 },
  seating: { kind: 'seating', label: '观众座席', eyebrow: 'SEATING', icon: '▤', color: '#e6f7f2', width: 6, height: 3 },
  entrance: { kind: 'entrance', label: '入口', eyebrow: 'ENTRY', icon: '↗', color: '#fff2d8', width: 2.5, height: 1.5 },
};

export const createZone = (index: number): Zone => ({
  id: `zone-${Date.now()}-${index}`,
  name: `分区 ${index + 1}`,
  color: ZONE_COLORS[index % ZONE_COLORS.length],
  locked: false,
  hidden: false,
});

export const createStarterDocument = (): LayoutDocument => ({
  version: 1,
  title: '春日创意市集 · A 区',
  field: { width: 28, height: 18 },
  zones: [
    { id: 'zone-booth', name: '展位区', color: ZONE_COLORS[0], locked: false, hidden: false },
    { id: 'zone-event', name: '活动区', color: ZONE_COLORS[1], locked: false, hidden: false },
  ],
  elements: [
    { id: 'entry-1', kind: 'entrance', name: '主入口', x: 1, y: 8.25, width: 2.5, height: 1.5, rotation: 0, zoneId: null },
    { id: 'stage-1', kind: 'stage', name: '分享舞台', x: 10, y: 1.5, width: 8, height: 4, rotation: 0, zoneId: 'zone-event' },
    { id: 'booth-1', kind: 'booth', name: '香氛展位', x: 4, y: 2, width: 5, height: 3.5, rotation: 0, zoneId: 'zone-booth' },
    { id: 'booth-2', kind: 'booth', name: '手作展位', x: 19, y: 2, width: 5, height: 3.5, rotation: 0, zoneId: 'zone-booth' },
    { id: 'seating-1', kind: 'seating', name: '休息座席', x: 10, y: 11, width: 6, height: 3, rotation: 0, zoneId: 'zone-event' },
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
    zoneId: null,
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

export const findZone = (document: LayoutDocument, id: string | null | undefined): Zone | null =>
  id ? document.zones.find((zone) => zone.id === id) ?? null : null;

export const getVisibleElements = (document: LayoutDocument): ExpoElement[] => {
  const hiddenZoneIds = new Set(document.zones.filter((zone) => zone.hidden).map((zone) => zone.id));
  return document.elements.filter((element) => !element.zoneId || !hiddenZoneIds.has(element.zoneId));
};

const countIssueCount = (overlaps: OverlapIssue[], bounds: BoundsIssue[], channels: ChannelIssue[]) =>
  overlaps.length + bounds.length + channels.length;

export const summarizeByZone = (document: LayoutDocument): ZoneSummary[] => {
  const overlaps = findOverlaps(document.elements);
  const bounds = findBoundsIssues(document.field, document.elements);
  const channels = findNarrowChannels(document.elements);
  const knownZoneIds = new Set(document.zones.map((zone) => zone.id));
  const summarize = (zoneId: string | null, name: string, color: string, locked: boolean, hidden: boolean, ids: Set<string>): ZoneSummary => ({
    zoneId,
    name,
    color,
    locked,
    hidden,
    elementCount: ids.size,
    overlaps: overlaps.filter((issue) => ids.has(issue.firstId) || ids.has(issue.secondId)).length,
    bounds: bounds.filter((issue) => ids.has(issue.elementId)).length,
    channels: channels.filter((issue) => ids.has(issue.firstId) || ids.has(issue.secondId)).length,
  });
  const summaries = document.zones.map((zone) => summarize(
    zone.id,
    zone.name,
    zone.color,
    zone.locked,
    zone.hidden,
    new Set(document.elements.filter((element) => element.zoneId === zone.id).map((element) => element.id)),
  ));
  const unzonedIds = new Set(document.elements.filter((element) => !element.zoneId || !knownZoneIds.has(element.zoneId)).map((element) => element.id));
  if (unzonedIds.size > 0) summaries.push(summarize(null, UNZONED_LABEL, '#9aa7b4', false, false, unzonedIds));
  return summaries;
};

export const analyzeLayout = (document: LayoutDocument): Analysis => {
  const visibleElements = getVisibleElements(document);
  const overlaps = findOverlaps(visibleElements);
  const bounds = findBoundsIssues(document.field, visibleElements);
  const channels = findNarrowChannels(visibleElements);
  const allIssueCount = countIssueCount(findOverlaps(document.elements), findBoundsIssues(document.field, document.elements), findNarrowChannels(document.elements));
  const hiddenZones = document.zones.filter((zone) => zone.hidden);
  return {
    overlaps,
    bounds,
    channels,
    path: createPathPreview(visibleElements),
    zoneSummaries: summarizeByZone(document),
    hiddenZoneCount: hiddenZones.length,
    hiddenElementCount: document.elements.length - visibleElements.length,
    excludedIssueCount: allIssueCount - countIssueCount(overlaps, bounds, channels),
  };
};

export const findElement = (document: LayoutDocument, id: string | null) => document.elements.find((element) => element.id === id) ?? null;

export const formatArea = (field: FieldSize) => `${field.width} × ${field.height} m`;
