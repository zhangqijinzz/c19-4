import { describe, expect, it } from 'vitest';
import { createStarterDocument } from '../src/domain';
import { LocalLayoutRepository } from '../src/repository';
import { BrowserStorageService } from '../src/storageService';

describe('LocalLayoutRepository', () => {
  it('falls back to the starter document when persisted JSON is damaged', async () => {
    window.localStorage.setItem('exposketch.document.v1', '{broken-json');
    const repository = new LocalLayoutRepository(new BrowserStorageService());
    expect(await repository.load()).toEqual(createStarterDocument());
    window.localStorage.clear();
  });

  it('migrates legacy documents without zones and clears dangling zone references', async () => {
    const legacy = {
      version: 1,
      title: 'legacy',
      field: { width: 20, height: 12 },
      elements: [
        { id: 'a', kind: 'booth', name: 'a', x: 1, y: 1, width: 4, height: 3, rotation: 0, zoneId: 'ghost-zone' },
        { id: 'b', kind: 'stage', name: 'b', x: 8, y: 1, width: 5, height: 3, rotation: 0 },
      ],
    };
    window.localStorage.setItem('exposketch.document.v1', JSON.stringify(legacy));
    const repository = new LocalLayoutRepository(new BrowserStorageService());
    const loaded = await repository.load();
    expect(loaded.zones).toEqual([]);
    expect(loaded.elements.map((element) => element.zoneId)).toEqual([null, null]);
    window.localStorage.clear();
  });

  it('keeps valid zone references when loading a zoned document', async () => {
    const zoned = {
      ...createStarterDocument(),
      zones: [{ id: 'zone-1', name: '餐饮区', color: '#123456', locked: true, hidden: false }],
      elements: [{ ...createStarterDocument().elements[0], zoneId: 'zone-1' }],
    };
    window.localStorage.setItem('exposketch.document.v1', JSON.stringify(zoned));
    const repository = new LocalLayoutRepository(new BrowserStorageService());
    const loaded = await repository.load();
    expect(loaded.zones).toHaveLength(1);
    expect(loaded.elements[0].zoneId).toBe('zone-1');
    window.localStorage.clear();
  });
});
