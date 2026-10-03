import { describe, expect, it } from 'vitest';
import { createStarterDocument } from '../src/domain';
import { LocalLayoutRepository, normalizeDocument } from '../src/repository';
import { BrowserStorageService } from '../src/storageService';
import type { LayoutDocument } from '../src/types';

describe('LocalLayoutRepository', () => {
  it('falls back to the starter document when persisted JSON is damaged', async () => {
    window.localStorage.setItem('exposketch.document.v1', '{broken-json');
    const repository = new LocalLayoutRepository(new BrowserStorageService());
    expect(await repository.load()).toEqual(createStarterDocument());
    window.localStorage.clear();
  });

  it('migrates a legacy document without zones: elements stay and become unzoned', () => {
    const legacy = { version: 1, title: 'old', field: { width: 20, height: 12 }, elements: [{ id: 'x', kind: 'booth', name: 'X', x: 1, y: 1, width: 4, height: 3, rotation: 0 }] } as unknown as LayoutDocument;
    const normalized = normalizeDocument(legacy);
    expect(normalized.zones).toEqual([]);
    expect(normalized.elements).toHaveLength(1);
    expect(normalized.elements[0].zoneId).toBeNull();
  });

  it('detaches elements from zones that no longer exist', () => {
    const doc: LayoutDocument = {
      version: 1,
      title: 'dangling',
      field: { width: 20, height: 12 },
      zones: [{ id: 'z1', name: '存在的分区', color: '#fff', locked: false }],
      elements: [
        { id: 'keep', kind: 'booth', name: 'K', x: 1, y: 1, width: 2, height: 2, rotation: 0, zoneId: 'z1' },
        { id: 'orphan', kind: 'booth', name: 'O', x: 4, y: 4, width: 2, height: 2, rotation: 0, zoneId: 'deleted-zone' },
      ],
    };
    const normalized = normalizeDocument(doc);
    expect(normalized.elements.find((element) => element.id === 'keep')?.zoneId).toBe('z1');
    expect(normalized.elements.find((element) => element.id === 'orphan')?.zoneId).toBeNull();
  });
});
