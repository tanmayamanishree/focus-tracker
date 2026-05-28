/* ============================================
   router.js — page switching
   Add a new page: create a module under js/pages/,
   register it here, add a nav-item in index.html.
   ============================================ */

const Router = {
  current: null,
  pages: {},

  register(name, module) {
    this.pages[name] = module;
  },

  init() {
    // Hook up nav clicks
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => this.go(item.dataset.page));
    });

    // Open initial page (default focus)
    const initial = window.location.hash?.slice(1) || 'focus';
    this.go(this.pages[initial] ? initial : 'focus');
  },

  go(name) {
    if (!this.pages[name]) return;

    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === name);
    });

    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    // Tell outgoing page to clean up
    if (this.current && this.pages[this.current]?.onLeave) {
      this.pages[this.current].onLeave();
    }

    // Show new page
    const container = document.getElementById('page-' + name);
    container.classList.add('active');

    // Render via the page module
    this.pages[name].render(container);
    if (this.pages[name].onEnter) this.pages[name].onEnter();

    this.current = name;
    window.location.hash = name;
  }
};
