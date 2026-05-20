// Focus Tracker - Main JavaScript

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  // Get Started button handler
  const getStartedBtn = document.getElementById('get-started-btn');
  
  if (getStartedBtn) {
    getStartedBtn.addEventListener('click', handleGetStarted);
  }
}

function handleGetStarted() {
  alert('Welcome to Focus Tracker! Start building your app here.');
}
