/**
 * Dashboard Analytics, Chart.js Integrations, Pomodoro Timer & Quick Actions
 */

let dailyChartInstance = null;
let weeklyChartInstance = null;
let priorityChartInstance = null;
let categoryChartInstance = null;
let statusChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  if (API.isAuthenticated()) {
    loadDashboardData();
    initPomodoroTimer();
    initQuickTaskModal();
  }
});

async function loadDashboardData() {
  try {
    const statsRes = await API.tasks.getStats();
    const stats = statsRes.data;

    // Render Metrics Cards
    renderMetrics(stats.summary);

    // Render Charts
    renderCharts(stats.charts);

    // Load upcoming deadlines
    loadUpcomingTasks();
  } catch (err) {
    showToast('Failed to load stats', err.message, 'error');
  }
}

function renderMetrics(summary) {
  if (!summary) return;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setVal('stat-total-tasks', summary.total);
  setVal('stat-completed-tasks', summary.completed);
  setVal('stat-pending-tasks', summary.pending);
  setVal('stat-inprogress-tasks', summary.inProgress);
  setVal('stat-overdue-tasks', summary.overdue);
  setVal('stat-today-tasks', summary.dueToday);
  setVal('stat-high-priority-tasks', summary.highPriority);
  setVal('stat-completion-rate', `${summary.completionRate}%`);

  const fill = document.getElementById('stat-progress-fill');
  if (fill) fill.style.width = `${summary.completionRate}%`;

  const bannerText = document.getElementById('productivity-summary-text');
  if (bannerText) {
    bannerText.textContent = summary.productivityMessage || 'Keep up the momentum!';
  }
}

function renderCharts(chartData) {
  if (!chartData || typeof Chart === 'undefined') return;

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';

  // 1. Daily Completed Chart (Line/Area)
  const ctxDaily = document.getElementById('chart-daily-completed');
  if (ctxDaily) {
    if (dailyChartInstance) dailyChartInstance.destroy();
    dailyChartInstance = new Chart(ctxDaily, {
      type: 'line',
      data: {
        labels: chartData.dailyCompleted.labels,
        datasets: [
          {
            label: 'Tasks Completed',
            data: chartData.dailyCompleted.data,
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.15)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#6366f1',
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: textColor, precision: 0 },
            grid: { color: gridColor }
          },
          x: {
            ticks: { color: textColor },
            grid: { color: gridColor }
          }
        }
      }
    });
  }

  // 2. Weekly Completed Chart (Bar)
  const ctxWeekly = document.getElementById('chart-weekly-completed');
  if (ctxWeekly) {
    if (weeklyChartInstance) weeklyChartInstance.destroy();
    weeklyChartInstance = new Chart(ctxWeekly, {
      type: 'bar',
      data: {
        labels: chartData.weeklyCompleted.labels,
        datasets: [
          {
            label: 'Completed Tasks',
            data: chartData.weeklyCompleted.data,
            backgroundColor: '#06b6d4',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: textColor, precision: 0 },
            grid: { color: gridColor }
          },
          x: {
            ticks: { color: textColor },
            grid: { display: false }
          }
        }
      }
    });
  }

  // 3. Tasks by Priority (Doughnut)
  const ctxPriority = document.getElementById('chart-by-priority');
  if (ctxPriority) {
    if (priorityChartInstance) priorityChartInstance.destroy();
    priorityChartInstance = new Chart(ctxPriority, {
      type: 'doughnut',
      data: {
        labels: chartData.byPriority.labels,
        datasets: [
          {
            data: chartData.byPriority.data,
            backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
            borderWidth: 2,
            borderColor: isDark ? '#111827' : '#ffffff'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: textColor, boxWidth: 12, padding: 12 }
          }
        },
        cutout: '68%'
      }
    });
  }

  // 4. Tasks by Category (Bar)
  const ctxCategory = document.getElementById('chart-by-category');
  if (ctxCategory) {
    if (categoryChartInstance) categoryChartInstance.destroy();
    categoryChartInstance = new Chart(ctxCategory, {
      type: 'bar',
      data: {
        labels: chartData.byCategory.labels.length ? chartData.byCategory.labels : ['No Categories'],
        datasets: [
          {
            label: 'Tasks',
            data: chartData.byCategory.data.length ? chartData.byCategory.data : [0],
            backgroundColor: '#a855f7',
            borderRadius: 6
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { color: textColor, precision: 0 },
            grid: { color: gridColor }
          },
          y: {
            ticks: { color: textColor },
            grid: { display: false }
          }
        }
      }
    });
  }

  // 5. Completed vs Pending Distribution
  const ctxStatus = document.getElementById('chart-status-distribution');
  if (ctxStatus) {
    if (statusChartInstance) statusChartInstance.destroy();
    statusChartInstance = new Chart(ctxStatus, {
      type: 'doughnut',
      data: {
        labels: chartData.statusDistribution.labels,
        datasets: [
          {
            data: chartData.statusDistribution.data,
            backgroundColor: ['#10b981', '#3b82f6', '#64748b'],
            borderWidth: 2,
            borderColor: isDark ? '#111827' : '#ffffff'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: textColor, boxWidth: 12, padding: 12 }
          }
        },
        cutout: '68%'
      }
    });
  }
}

async function loadUpcomingTasks() {
  const container = document.getElementById('upcoming-tasks-list');
  if (!container) return;

  try {
    const res = await API.tasks.getAll({ status: 'Todo', dueDateFilter: 'week' });
    const tasks = res.data || [];

    if (tasks.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 24px 10px;">
          <i class="fa-regular fa-calendar-check empty-icon" style="font-size: 2rem;"></i>
          <p class="empty-desc" style="font-size: 0.85rem; margin: 0;">No upcoming tasks due this week</p>
        </div>
      `;
      return;
    }

    container.innerHTML = tasks.slice(0, 5).map((t) => {
      const dueStr = t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date';
      return `
        <div class="upcoming-task-item" onclick="window.location.href='/tasks.html?id=${t._id}'">
          <div class="upcoming-task-left">
            <span class="badge badge-${t.priority.toLowerCase()}">${t.priority}</span>
            <div>
              <div class="upcoming-task-title">${escapeHTML(t.title)}</div>
              <div class="upcoming-task-due"><i class="fa-regular fa-clock"></i> Due: ${dueStr} ${t.dueTime || ''}</div>
            </div>
          </div>
          <span class="badge" style="background: ${t.categoryColor || '#6366f1'}20; color: ${t.categoryColor || '#6366f1'}">
            ${escapeHTML(t.categoryName || 'General')}
          </span>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<p class="empty-desc">Error loading upcoming tasks</p>`;
  }
}

// ---------------- Pomodoro Timer ----------------
let pomoTimerInterval = null;
let pomoSecondsLeft = 25 * 60;
let pomoMode = 'work'; // 'work', 'shortBreak', 'longBreak'
let pomoIsRunning = false;
let completedPomoSessions = 0;

function initPomodoroTimer() {
  const display = document.getElementById('pomo-timer-display');
  const startBtn = document.getElementById('btn-pomo-toggle');
  const resetBtn = document.getElementById('btn-pomo-reset');
  const tabs = document.querySelectorAll('.pomo-tab');
  const taskSelect = document.getElementById('pomo-task-select');

  if (!display) return;

  // Populate task select for linking
  if (taskSelect) {
    API.tasks.getAll({ status: 'Todo' }).then((res) => {
      const tasks = res.data || [];
      tasks.forEach((t) => {
        const opt = document.createElement('option');
        opt.value = t._id;
        opt.textContent = t.title;
        taskSelect.appendChild(opt);
      });
    }).catch(() => {});
  }

  const updateDisplay = () => {
    const mins = Math.floor(pomoSecondsLeft / 60);
    const secs = pomoSecondsLeft % 60;
    display.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const setMode = (mode) => {
    clearInterval(pomoTimerInterval);
    pomoIsRunning = false;
    pomoMode = mode;
    if (startBtn) startBtn.innerHTML = '<i class="fa-solid fa-play"></i> Start';

    tabs.forEach((t) => t.classList.toggle('active', t.dataset.mode === mode));

    if (mode === 'work') pomoSecondsLeft = 25 * 60;
    else if (mode === 'shortBreak') pomoSecondsLeft = 5 * 60;
    else if (mode === 'longBreak') pomoSecondsLeft = 15 * 60;

    updateDisplay();
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => setMode(tab.dataset.mode));
  });

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      if (pomoIsRunning) {
        clearInterval(pomoTimerInterval);
        pomoIsRunning = false;
        startBtn.innerHTML = '<i class="fa-solid fa-play"></i> Resume';
      } else {
        pomoIsRunning = true;
        startBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';

        pomoTimerInterval = setInterval(() => {
          if (pomoSecondsLeft > 0) {
            pomoSecondsLeft--;
            updateDisplay();
          } else {
            clearInterval(pomoTimerInterval);
            pomoIsRunning = false;
            startBtn.innerHTML = '<i class="fa-solid fa-play"></i> Start';
            handlePomoComplete();
          }
        }, 1000);
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      setMode(pomoMode);
    });
  }

  const handlePomoComplete = async () => {
    AudioNotifier.playChime('success');
    if (pomoMode === 'work') {
      completedPomoSessions++;
      const countEl = document.getElementById('pomo-completed-count');
      if (countEl) countEl.textContent = completedPomoSessions;

      showToast('Pomodoro Complete!', 'Great work! Take a break now.', 'success');
      sendBrowserNotification('Pomodoro Complete!', 'Great focus! Time for a refreshing break.');

      // Check if associated with task
      const selectedTaskId = taskSelect ? taskSelect.value : null;
      if (selectedTaskId) {
        try {
          await API.tasks.recordPomodoro(selectedTaskId);
          showToast('Session Saved', 'Pomodoro session recorded to task time', 'info');
        } catch (e) {}
      }

      setMode('shortBreak');
    } else {
      showToast('Break Finished', 'Ready to dive back into your next session?', 'info');
      setMode('work');
    }
  };

  updateDisplay();
}

// ---------------- Quick Task Modal ----------------
function initQuickTaskModal() {
  const modal = document.getElementById('modal-quick-task');
  const openBtns = document.querySelectorAll('.btn-open-quick-task');
  const closeBtn = document.getElementById('btn-close-quick-modal');
  const form = document.getElementById('form-quick-task');
  const catSelect = document.getElementById('quick-task-category');

  if (!modal) return;

  const openModal = async () => {
    modal.classList.add('active');
    // Load categories into select
    if (catSelect && catSelect.children.length <= 1) {
      try {
        const res = await API.categories.getAll();
        (res.data || []).forEach((c) => {
          const opt = document.createElement('option');
          opt.value = c._id;
          opt.textContent = c.name;
          catSelect.appendChild(opt);
        });
      } catch (e) {}
    }
  };

  const closeModal = () => {
    modal.classList.remove('active');
    if (form) form.reset();
  };

  openBtns.forEach((btn) => btn.addEventListener('click', openModal));
  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('quick-task-title').value;
      const priority = document.getElementById('quick-task-priority').value;
      const category = catSelect.value || null;
      const dueDate = document.getElementById('quick-task-date').value || null;

      try {
        await API.tasks.create({ title, priority, category, dueDate });
        showToast('Created', 'Task created successfully', 'success');
        closeModal();
        loadDashboardData();
      } catch (err) {
        showToast('Error', err.message, 'error');
      }
    });
  }
}
