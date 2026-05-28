/* ============================================
   app.js — entry point
   ============================================ */

(function init() {
  // Load persisted data
  State.init();

  // Register pages
  Router.register('focus', FocusPage);
  Router.register('projects', ProjectsPage);
  Router.register('diary', DiaryPage);

  // Boot
  Router.init();
})();
