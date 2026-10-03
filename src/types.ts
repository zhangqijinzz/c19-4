export type ElementKind = 'booth' | 'stage' | 'seating' | 'entrance';
export type LayoutMode = 'edit' | 'inspect' | 'path';
export type ViewPhase = 'loading' | 'ready' | 'error';

export interface ExpoElement {
  id: string;
  kind: ElementKind;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  /** 所属分区；null 表示未分区。删除分区时回到此状态。 */
  zoneId?: string | null;
}

export interface Zone {
  id: string;
  name: string;
  color: string;
  /** 上锁后分区内元素禁止拖动/缩放/旋转，仍可选中；随文档持久化。 */
  locked: boolean;
}

export interface RenderElement extends ExpoElement {
  displayWidth: number;
  displayHeight: number;
  occupiedArea: number;
}

export interface FieldSize {
  width: number;
  height: number;
}

export interface LayoutDocument {
  version: 1;
  title: string;
  field: FieldSize;
  elements: ExpoElement[];
  zones: Zone[];
}

export interface ElementSpec {
  kind: ElementKind;
  label: string;
  eyebrow: string;
  icon: string;
  color: string;
  width: number;
  height: number;
}

export interface OverlapIssue {
  firstId: string;
  secondId: string;
  amount: number;
}

export interface BoundsIssue {
  elementId: string;
  overflow: number;
}

export interface ChannelIssue {
  firstId: string;
  secondId: string;
  gap: number;
}

export interface PathPreview {
  points: Array<{ x: number; y: number }>;
  distance: number;
  fromName: string;
  toName: string;
}

/** 单个分区（或未分区桶）的问题汇总。跨分区问题在两侧分区各计一次。 */
export interface ZoneIssueSummary {
  /** null 表示未分区 */
  zoneId: string | null;
  zoneName: string;
  color: string;
  elementCount: number;
  hidden: boolean;
  locked: boolean;
  overlaps: number;
  bounds: number;
  channels: number;
  issueCount: number;
}

export interface Analysis {
  overlaps: OverlapIssue[];
  bounds: BoundsIssue[];
  channels: ChannelIssue[];
  path: PathPreview | null;
  /** 按文档分区顺序排列的分区汇总，末尾可能附带未分区行。 */
  zoneSummaries: ZoneIssueSummary[];
  /** 至少一端落在隐藏分区内的全局问题数（去重计数）。隐藏不等于没问题。 */
  hiddenIssueCount: number;
  hiddenElementCount: number;
  hiddenZoneCount: number;
}

export interface Notice {
  tone: 'info' | 'success' | 'warning' | 'error';
  message: string;
}
