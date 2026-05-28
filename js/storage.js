/* ============================================
   storage.js — persistence layer
   Currently uses localStorage. Swap the implementation
   here to move to a real backend later — the public
   API (get/set/remove) stays the same.
   ============================================ */

const Storage = {
  PREFIX: 'notebook:',

  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(this.PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (err) {
      console.warn('Storage.get failed:', key, err);
      return fallback;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.warn('Storage.set failed:', key, err);
      return false;
    }
  },

  remove(key) {
    localStorage.removeItem(this.PREFIX + key);
  },

  // Export all notebook data as JSON (for backup)
  exportAll() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(this.PREFIX)) {
        data[k.slice(this.PREFIX.length)] = JSON.parse(localStorage.getItem(k));
      }
    }
    return data;
  },

  // Import previously exported data
  importAll(data) {
    Object.entries(data).forEach(([k, v]) => this.set(k, v));
  }
};
