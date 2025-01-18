const CACHE_SIZE = 100 // Maximum number of cached responses
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

interface CacheEntry {
  audio: ArrayBuffer;
  timestamp: number;
}

class AudioCache {
  private cache = new Map<string, CacheEntry>();

  async getAudio(key: string): Promise<ArrayBuffer | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if cache entry has expired
    if (Date.now() - entry.timestamp > CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }

    return entry.audio;
  }

  setAudio(key: string, audio: ArrayBuffer) {
    // Clear old entries if cache is full
    if (this.cache.size >= CACHE_SIZE) {
      const oldestKey = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0][0];
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      audio,
      timestamp: Date.now()
    });
  }

  generateKey(text: string, options: any): string {
    return `${text}-${JSON.stringify(options)}`;
  }
}

export const audioCache = new AudioCache(); 