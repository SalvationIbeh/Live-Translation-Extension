// tests/unit/src/lib/cacheService.test.js

import FakeIndexedDB from 'fake-indexeddb';
import CacheService from '../../../../src/lib/cacheService';

let cacheService;

beforeEach(async () => {
  global.window = {};
  global.window.indexedDB = FakeIndexedDB;
  cacheService = new CacheService();
  await cacheService.init();
});

afterEach(async () => {
  await cacheService.clear();
});

describe('CacheService', () => {
  it('should set and get values in the cache', async () => {
    await cacheService.set('testKey', 'testValue');
    const value = await cacheService.get('testKey');
    expect(value).toBe('testValue');
  });

  it('should clear the cache', async () => {
    await cacheService.set('key1', 'value1');
    await cacheService.set('key2', 'value2');
    await cacheService.clear();
    const value1 = await cacheService.get('key1');
    const value2 = await cacheService.get('key2');
    expect(value1).toBeUndefined();
    expect(value2).toBeUndefined();
  });

  it('should handle missing keys', async () => {
    const value = await cacheService.get('nonExistentKey');
    expect(value).toBeUndefined();
  });

  it('should work correctly in memory cache mode', async () => {
    const memoryCache = new CacheService();
    memoryCache.useMemoryCache = true;
    await memoryCache.set('key1', 'value1');
    const value = await memoryCache.get('key1');
    expect(value).toBe('value1');
  });

  it('should successfully clear the cache', async () => {
    await cacheService.set('key1', 'value1');
    await cacheService.clear();
    const value = await cacheService.get('key1');
    expect(value).toBeUndefined();
  });

  it('should successfully set a value', async () => {
    await expect(cacheService.set('testKey', 'testValue')).resolves.not.toThrow();
  });

  it('should successfully get a set value', async () => {
    await cacheService.set('testKey', 'testValue');
    const value = await cacheService.get('testKey');
    expect(value).toBe('testValue');
  });

  it('should handle errors during set operation', async () => {
    const errorCacheService = new CacheService();
    errorCacheService.useMemoryCache = false;  // Ensure IndexedDB is used
    errorCacheService.db = {
      transaction: jest.fn().mockReturnValue({
        objectStore: jest.fn().mockReturnValue({
          put: jest.fn().mockReturnValue({
            set onerror(handler) {
              console.log('set onerror called');
              handler({ target: { error: new Error('Failed to store item') } });
            },
            set onsuccess(handler) {
              console.log('set onsuccess called');
              // Do nothing
            }
          })
        })
      })
    };
  
    await expect(errorCacheService.set('key', 'value')).rejects.toThrow('Failed to store item');
  });
  
  it('should handle errors during get operation', async () => {
    const errorCacheService = new CacheService();
    errorCacheService.useMemoryCache = false;  // Ensure IndexedDB is used
    errorCacheService.db = {
      transaction: jest.fn().mockReturnValue({
        objectStore: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue({
            set onerror(handler) {
              console.log('get onerror called');
              handler({ target: { error: new Error('Failed to retrieve item') } });
            },
            set onsuccess(handler) {
              console.log('get onsuccess called');
              // Do nothing
            }
          })
        })
      })
    };
  
    await expect(errorCacheService.get('key')).rejects.toThrow('Failed to retrieve item');
  });

  it('should handle errors during clear operation', async () => {
    const errorCacheService = new CacheService();
    errorCacheService.db = {
      transaction: jest.fn().mockReturnValue({
        objectStore: jest.fn().mockReturnValue({
          clear: jest.fn().mockReturnValue({
            set onerror(handler) {
              console.log('onerror called');
              handler({ target: { error: new Error('Failed to clear cache') } });
            },
            set onsuccess(handler) {
              console.log('onsuccess called');
              // Do nothing
            }
          })
        })
      })
    };
  
    try {
      await errorCacheService.clear();
      console.log('Clear operation succeeded unexpectedly');
    } catch (error) {
      console.log('Caught error:', error.message);
      throw error;
    }
  });
});