/* ============================================
   utils.js — pure helper functions
   ============================================ */

const Utils = {

  // Generate a short unique ID
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  // Format ms as HH:MM:SS or MM:SS
  formatTime(ms, showHours = false) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    if (showHours || h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
  },

  // Format ms as "1h 23m"
  formatDuration(ms) {
    const totalMin = Math.floor(ms / 60000);
    if (totalMin < 60) return `${totalMin}m`;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  },

  // Get date key for storage (YYYY-MM-DD)
  dateKey(date = new Date()) {
    const d = new Date(date);
    return d.toISOString().slice(0, 10);
  },

  // Get ISO week key (YYYY-Www)
  weekKey(date = new Date()) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  },

  // Get Monday-Sunday range for a week containing the given date
  weekRange(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay() || 7;       // Sun = 0 → 7
    const monday = new Date(d);
    monday.setDate(d.getDate() - day + 1);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { start: monday, end: sunday };
  },

  // "Thursday, May 28"
  formatDateLong(date = new Date()) {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  },

  // "May 25"
  formatDateShort(date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  // "MAY 25 — MAY 31, 2026"
  formatWeekRange(date = new Date()) {
    const { start, end } = this.weekRange(date);
    const s = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
    const e = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
    return `${s} — ${e}, ${end.getFullYear()}`;
  },

  // "Mon", "Tue", etc.
  shortDay(date) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  },

  // Escape HTML for safe insertion
  esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};
