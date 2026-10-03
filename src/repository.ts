import { createStarterDocument } from './domain';
import type { DocumentStorageService } from './storageService';
import type { ExpoElement, LayoutDocument, Zone } from './types';

export interface LayoutRepository {
  load(): Promise<LayoutDocument>;
  save(document: LayoutDocument): Promise<void>;
}

const isElement = (value: unknown): value is ExpoElement => {
  if (!value || typeof value !== 'object') return false;
  const element = value as Record<string, unknown>;
  return typeof element.id === 'string' && typeof element.kind === 'string' && typeof element.x === 'number' && typeof element.y === 'number' && typeof element.width === 'number' && typeof element.height === 'number' && typeof element.rotation === 'number';
};

const isZone = (value: unknown): value is Zone => {
  if (!value || typeof value !== 'object') return false;
  const zone = value as Record<string, unknown>;
  return typeof zone.id === 'string' && typeof zone.name === 'string' && typeof zone.color === 'string' && typeof zone.locked === 'boolean';
};

const isDocument = (value: unknown): value is LayoutDocument => {
  if (!value || typeof value !== 'object') return false;
  const document = value as Record<string, unknown>;
  const field = document.field as Record<string, unknown> | undefined;
  return document.version === 1 && typeof document.title === 'string' && !!field && typeof field.width === 'number' && typeof field.height === 'number' && Array.isArray(document.elements) && document.elements.every(isElement);
};

/**
 * 补齐旧版本存档：早期文档没有 zones，元素也没有 zoneId。
 * 统一规整为“全部元素未分区”；引用了已不存在分区的 zoneId 也置回 null，
 * 保证删除分区/存档损坏后元素始终可选中。
 */
export const normalizeDocument = (document: LayoutDocument): LayoutDocument => {
  const zones = Array.isArray(document.zones) && document.zones.every(isZone) ? document.zones : [];
  const knownZoneIds = new Set(zones.map((zone) => zone.id));
  const elements = document.elements.map((element) => ({
    ...element,
    zoneId: element.zoneId && knownZoneIds.has(element.zoneId) ? element.zoneId : null,
  }));
  return { ...document, zones, elements };
};

export class LocalLayoutRepository implements LayoutRepository {
  constructor(private readonly storage: DocumentStorageService) {}

  async load(): Promise<LayoutDocument> {
    try {
      const saved = await this.storage.read();
      return isDocument(saved) ? normalizeDocument(saved) : createStarterDocument();
    } catch {
      return createStarterDocument();
    }
  }

  async save(document: LayoutDocument): Promise<void> {
    await this.storage.write(document);
  }
}
