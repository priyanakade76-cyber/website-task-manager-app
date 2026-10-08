/**
 * In-App Toasts, Audio Chime & Notifications Management
 */

// Sound Synthesizer for notifications
const AudioNotifier = {
  ctx: null,
  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  },
  playChime(type = 'success') {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      if (type === 'success') {
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
      } else if (type === 'error') {
        osc.frequency.setValueAtTime(329.63, now); // E4
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.2); // A3
      } else {
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5
      }

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {
      // Audio might be blocked by browser policy until user gesture
    }
  }
};

// Toast Notifications System
function showToast(title, message, type = 'info', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconMap = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info'
  };

  toast.innerHTML = `
    <i class="fa-solid ${iconMap[type] || 'fa-bell'} toast-icon"></i>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <i class="fa-solid fa-xmark toast-close"></i>
  `;

  container.appendChild(toast);

  // Trigger audio
  AudioNotifier.playChime(type);

  // Animate in
  setTimeout(() => toast.classList.add('show'), 10);

  // Dismiss handler
  const dismiss = () => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  };

  toast.querySelector('.toast-close').addEventListener('click', dismiss);
  if (duration > 0) {
    setTimeout(dismiss, duration);
  }
}

// Request Browser Notifications
async function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

function sendBrowserNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/assets/icon.png'
    });
  }
}

// Notifications Panel Manager
const NotificationManager = {
  isOpen: false,

  init() {
    this.bindEvents();
    this.refresh();
    // Proactive check every 60 seconds
    setInterval(() => {
      this.checkDueReminders();
    }, 60000);
  },

  bindEvents() {
    const bellBtn = document.getElementById('btn-notifications-bell');
    const panel = document.getElementById('notification-dropdown');
    const markAllBtn = document.getElementById('btn-mark-all-read');
    const clearAllBtn = document.getElementById('btn-clear-all-notifs');

    if (bellBtn && panel) {
      bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggle();
      });

      document.addEventListener('click', (e) => {
        if (!panel.contains(e.target) && !bellBtn.contains(e.target)) {
          this.close();
        }
      });
    }

    if (markAllBtn) {
      markAllBtn.addEventListener('click', async () => {
        try {
          await API.notifications.markAllAsRead();
          this.refresh();
          showToast('Updated', 'All notifications marked as read', 'success');
        } catch (err) {
          showToast('Error', err.message, 'error');
        }
      });
    }

    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', async () => {
        try {
          await API.notifications.clearAll();
          this.refresh();
          showToast('Cleared', 'All notifications cleared', 'info');
        } catch (err) {
          showToast('Error', err.message, 'error');
        }
      });
    }
  },

  toggle() {
    const panel = document.getElementById('notification-dropdown');
    if (!panel) return;
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      panel.classList.add('active');
      this.refresh();
    } else {
      panel.classList.remove('active');
    }
  },

  close() {
    const panel = document.getElementById('notification-dropdown');
    if (panel) {
      panel.classList.remove('active');
      this.isOpen = false;
    }
  },

  async refresh() {
    if (!API.isAuthenticated()) return;
    try {
      const res = await API.notifications.getAll();
      this.render(res.data || [], res.unreadCount || 0);
    } catch (err) {
      // User may not be logged in or session expired
    }
  },

  async checkDueReminders() {
    if (!API.isAuthenticated()) return;
    try {
      const res = await API.notifications.checkDue();
      if (res.data && res.data.length > 0) {
        res.data.forEach((n) => {
          showToast(n.title, n.message, n.type === 'overdue' ? 'error' : 'warning');
          sendBrowserNotification(n.title, n.message);
        });
        this.refresh();
      }
    } catch (err) {
      // Ignore background check error
    }
  },

  render(notifications, unreadCount) {
    const badge = document.getElementById('notif-badge-dot');
    const unreadCountEl = document.getElementById('notif-unread-count');
    const list = document.getElementById('notification-list');

    if (badge) {
      badge.style.display = unreadCount > 0 ? 'block' : 'none';
    }
    if (unreadCountEl) {
      unreadCountEl.textContent = unreadCount > 0 ? `${unreadCount} new` : 'All read';
    }

    if (!list) return;

    if (notifications.length === 0) {
      list.innerHTML = `
        <div class="empty-state" style="padding: 30px 10px;">
          <i class="fa-regular fa-bell empty-icon" style="font-size: 2rem;"></i>
          <p class="empty-desc" style="font-size: 0.8rem; margin: 0;">No notifications yet</p>
        </div>
      `;
      return;
    }

    list.innerHTML = notifications
      .map((n) => {
        const timeAgo = formatTimeAgo(new Date(n.createdAt));
        const iconClass =
          n.type === 'overdue'
            ? 'fa-triangle-exclamation'
            : n.type === 'due_soon'
            ? 'fa-clock'
            : n.type === 'completed'
            ? 'fa-circle-check'
            : n.type === 'recurring_created'
            ? 'fa-arrows-rotate'
            : 'fa-bell';

        return `
          <div class="notification-item ${n.isRead ? '' : 'unread'}" data-id="${n._id}">
            <div class="notif-icon notif-${n.type}">
              <i class="fa-solid ${iconClass}"></i>
            </div>
            <div class="notif-details">
              <div class="notif-title">${escapeHTML(n.title)}</div>
              <div class="notif-msg">${escapeHTML(n.message)}</div>
              <div class="notif-time">${timeAgo}</div>
            </div>
            <button class="action-icon-btn delete notif-del-btn" title="Delete" data-id="${n._id}">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        `;
      })
      .join('');

    // Attach click events to items
    list.querySelectorAll('.notification-item').forEach((item) => {
      item.addEventListener('click', async (e) => {
        if (e.target.closest('.notif-del-btn')) return;
        const id = item.dataset.id;
        try {
          await API.notifications.markAsRead(id);
          item.classList.remove('unread');
          this.refresh();
        } catch (err) {}
      });
    });

    list.querySelectorAll('.notif-del-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        try {
          await API.notifications.delete(id);
          this.refresh();
        } catch (err) {}
      });
    });
  }
};

// Utilities
function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
