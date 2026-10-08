/**
 * Authentication handling, Session verification, UI theme & user profile binding
 */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  checkAuthProtection();
  initUserUI();
  initMobileNav();
  initThemeToggle();
  if (window.NotificationManager) {
    NotificationManager.init();
  }
});

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('taskmanager_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const nextTheme = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', nextTheme);
  localStorage.setItem('taskmanager_theme', nextTheme);

  // Update toggle button icon if exists
  const themeBtn = document.getElementById('btn-theme-toggle');
  if (themeBtn) {
    const icon = themeBtn.querySelector('i');
    if (icon) {
      icon.className = nextTheme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    }
  }

  // Update profile setting on backend if logged in
  if (API.isAuthenticated()) {
    API.auth.updateProfile({ theme: nextTheme }).catch(() => {});
  }
}

function initThemeToggle() {
  const themeBtn = document.getElementById('btn-theme-toggle');
  if (themeBtn) {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const icon = themeBtn.querySelector('i');
    if (icon) {
      icon.className = current === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    }
    themeBtn.addEventListener('click', toggleTheme);
  }
}

// Protected route verification
function checkAuthProtection() {
  const path = window.location.pathname;
  const isAuthPage = path.includes('login') || path.includes('register') || path === '/' || path.endsWith('index.html');
  const isProtectedPage = path.includes('dashboard') || path.includes('tasks') || path.includes('calendar') || path.includes('profile');

  if (isProtectedPage && !API.isAuthenticated()) {
    window.location.href = '/login.html';
  } else if ((path.includes('login') || path.includes('register')) && API.isAuthenticated()) {
    window.location.href = '/dashboard.html';
  }
}

// Populate user details across Sidebar and Topbar
function initUserUI() {
  const user = API.getUser();
  if (!user) return;

  // Sidebar user info
  const nameEls = document.querySelectorAll('.user-name');
  const emailEls = document.querySelectorAll('.user-email');
  const avatarEls = document.querySelectorAll('.user-avatar');

  nameEls.forEach((el) => (el.textContent = user.name || 'User'));
  emailEls.forEach((el) => (el.textContent = user.email || 'user@example.com'));

  avatarEls.forEach((el) => {
    if (user.profileImage) {
      if (el.tagName === 'IMG') {
        el.src = user.profileImage;
      } else {
        el.innerHTML = `<img src="${user.profileImage}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" alt="${user.name}" />`;
      }
    } else {
      const initial = (user.name || 'U').charAt(0).toUpperCase();
      el.textContent = initial;
    }
  });

  // Profile dropdown menu toggle
  const userBtn = document.getElementById('btn-user-menu');
  const profileDropdown = document.getElementById('profile-dropdown');
  const logoutBtn = document.getElementById('btn-logout');

  if (userBtn && profileDropdown) {
    userBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profileDropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (!profileDropdown.contains(e.target) && !userBtn.contains(e.target)) {
        profileDropdown.classList.remove('active');
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      API.auth.logout();
    });
  }
}

// Mobile sidebar drawer
function initMobileNav() {
  const toggleBtn = document.getElementById('btn-mobile-menu');
  const sidebar = document.querySelector('.sidebar');
  let backdrop = document.querySelector('.sidebar-backdrop');

  if (!backdrop && sidebar) {
    backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    document.body.appendChild(backdrop);
  }

  if (toggleBtn && sidebar && backdrop) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      backdrop.classList.toggle('active');
    });

    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('active');
    });
  }
}
