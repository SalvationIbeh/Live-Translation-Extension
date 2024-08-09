// src/lib/cacheService.js

class CacheService {
  constructor(dbName = 'translationCache', storeName = 'translations', dbVersion = 1) {
    this.dbName = dbName;
    this.storeName = storeName;
    this.dbVersion = dbVersion;
    this.db = null;
    this.memoryCache = new Map();
    this.useMemoryCache = process.env.NODE_ENV === 'test';
  }

  async init() {
    if (this.db !== null || this.useMemoryCache) {
      return;
    }

    try {
      await this._initDB();
    } catch (error) {
      throw error;
    }
  }
  
  async _initDB() {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = (event) => {
        reject(event.target.error);
      };

      request.onupgradeneeded = (event) => {
        try {
          const db = event.target.result;
          db.createObjectStore(this.storeName, { keyPath: 'key' });
          this.db = db;
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve();
      };
    });
  }

  async set(key, value) {
    console.log(`Setting key: ${key}`);
    if (this.useMemoryCache) {
      console.log('Using memory cache for set operation');
      this.memoryCache.set(key, value);
      return;
    }

    if (!this.db) {
      console.log('Database not initialized');
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      console.log('Starting set operation');
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put({ key, value });

      request.onerror = (event) => {
        console.log('Set operation failed:', event.target.error);
        reject(event.target.error || new Error('Failed to store item'));
      };
      request.onsuccess = () => {
        console.log('Set operation succeeded');
        resolve();
      };
    });
  }

  async get(key) {
    console.log(`Getting key: ${key}`);
    if (this.useMemoryCache) {
      console.log('Using memory cache for get operation');
      return this.memoryCache.get(key);
    }

    if (!this.db) {
      console.log('Database not initialized');
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      console.log('Starting get operation');
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onerror = (event) => {
        console.log('Get operation failed:', event.target.error);
        reject(event.target.error || new Error('Failed to retrieve item'));
      };
      request.onsuccess = () => {
        console.log('Get operation succeeded');
        resolve(request.result ? request.result.value : undefined);
      };
    });
  }

  async clear() {
    if (this.useMemoryCache) {
      console.log('Using memory cache');
      this.memoryCache.clear();
      return;
    }

    if (!this.db) {
      console.log('Database not initialized');
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      console.log('Starting clear operation');
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onerror = (event) => {
        console.log('Clear operation failed:', event.target.error);
        reject(event.target.error || new Error('Failed to clear cache'));
      };
      request.onsuccess = () => {
        console.log('Clear operation succeeded');
        resolve();
      };
    });
  }
}

export default CacheService;