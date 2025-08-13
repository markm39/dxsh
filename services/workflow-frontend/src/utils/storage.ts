export const storageAvailable = (type: "localStorage" | "sessionStorage" = "localStorage"): boolean => {
    try {
      const storage = window[type];
      const testKey = "__storage_test__";
      storage.setItem(testKey, testKey);
      storage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  };
  
  const memoryStore: Record<string, string> = {};
  
  export function setItem(key: string, value: string) {
    if (storageAvailable("localStorage")) {
      window.localStorage.setItem(key, value);
    } else {
      memoryStore[key] = value;
    }
  }
  
  export function getItem(key: string): string | null {
    if (storageAvailable("localStorage")) {
      return window.localStorage.getItem(key);
    }
    return memoryStore[key] ?? null;
  }
  
  export function removeItem(key: string) {
    if (storageAvailable("localStorage")) {
      window.localStorage.removeItem(key);
    } else {
      delete memoryStore[key];
    }
  }