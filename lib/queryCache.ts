interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class QueryCache {
  private cache = new Map<string, CacheItem<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    if (!item || Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return item.data as T;
  }

  async set<T>(key: string, data: T, ttl = this.DEFAULT_TTL): Promise<void> {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl
    });
    
    if (Math.random() < 0.1) this.cleanup(); // 10% chance to clean
  }

  private cleanup(): void {
    const now = Date.now();
    // Fix for downlevelIteration error
    Array.from(this.cache.entries()).forEach(([key, item]) => {
      if (now > item.expiresAt) {
        this.cache.delete(key);
      }
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

const queryCache = new QueryCache();
export { queryCache }; 