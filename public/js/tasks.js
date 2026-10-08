/**
 * Comprehensive Task Management: List View, Drag-and-Drop Kanban Board,
 * Advanced Filters, Live Task Stopwatch, Notes Manager & Activity Timeline.
 */

let allTasks = [];
let allCategories = [];
let currentViewMode = 'list'; // 'list' | 'kanban'
let activeStopwatches = {}; // { taskId: { interval, seconds, startTime } }
let selectedTaskIdForDetails = null;

document.addEventListener('DOMContentLoaded', () => {
  if (API.isAuthenticated()) {
    initTasksApp();
  }
});

async function initTasksApp() {
  bindToolbarEvents();
  initTaskFormModal();
  initTaskDetailsModal();
  initCategoryModal();

  await loadCategories();
  await loadTasks();

  // Check URL params for direct task opening or category filtering
  const urlParams = new URLSearchParams(window.location.search);
  const directId = urlParams.get('id');
  const directCat = urlParams.get('category');

  if (directCat) {
    const catSelect = document.getElementById('filter-category');
    if (catSelect) {
      catSelect.value = directCat;
      loadTasks();
    }
  }

  if (directId) {
    openTaskDetails(directId);
  }
}

// ---------------- Load Data ----------------
async function loadCategories() {
  try {
    const res = await API.categories.getAll();
    allCategories = res.data || [];
    populateCategoryDropdowns();
  } catch (err) {
    console.error('Failed to load categories', err);
  }
}

function populateCategoryDropdowns() {
  const filterCat = document.getElementById('filter-category');
  const formCat = document.getElementById('task-category');

  if (filterCat) {
    const currentVal = filterCat.value;
    filterCat.innerHTML = '<option value="All">All Categories</option>';
    allCategories.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c._id;
      opt.textContent = `${c.name} (${c.taskCount || 0})`;
      filterCat.appendChild(opt);
    });
    filterCat.value = currentVal || 'All';
  }

  if (formCat) {
    formCat.innerHTML = '<option value="">No Category (General)</option>';
    allCategories.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c._id;
      opt.textContent = c.name;
      formCat.appendChild(opt);
    });
  }
}

async function loadTasks() {
  const searchInput = document.getElementById('tasks-search-input');
  const statusFilter = document.getElementById('filter-status');
  const priorityFilter = document.getElementById('filter-priority');
  const categoryFilter = document.getElementById('filter-category');
  const dateFilter = document.getElementById('filter-due-date');
  const sortSelect = document.getElementById('filter-sort-by');
  const archiveToggle = document.getElementById('toggle-show-archived');

  const params = {
    search: searchInput ? searchInput.value.trim() : '',
    status: statusFilter ? statusFilter.value : 'All',
    priority: priorityFilter ? priorityFilter.value : 'All',
    category: categoryFilter ? categoryFilter.value : 'All',
    dueDateFilter: dateFilter ? dateFilter.value : '',
    sortBy: sortSelect ? sortSelect.value : 'createdAt',
    isArchived: archiveToggle && archiveToggle.checked ? 'true' : 'false'
  };

  try {
    const res = await API.tasks.getAll(params);
    allTasks = res.data || [];
    renderCurrentView();
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}

function renderCurrentView() {
  if (currentViewMode === 'kanban') {
    renderKanbanBoard();
  } else {
    renderListView();
  }
}

// ---------------- Toolbar & Filters ----------------
function bindToolbarEvents() {
  const searchInput = document.getElementById('tasks-search-input');
  const statusFilter = document.getElementById('filter-status');
  const priorityFilter = document.getElementById('filter-priority');
  const categoryFilter = document.getElementById('filter-category');
  const dateFilter = document.getElementById('filter-due-date');
  const sortSelect = document.getElementById('filter-sort-by');
  const archiveToggle = document.getElementById('toggle-show-archived');

  let debounceTimer;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(loadTasks, 300);
    });
  }

  [statusFilter, priorityFilter, categoryFilter, dateFilter, sortSelect, archiveToggle].forEach((el) => {
    if (el) el.addEventListener('change', loadTasks);
  });

  // View Mode Switcher
  const btnListView = document.getElementById('btn-view-list');
  const btnKanbanView = document.getElementById('btn-view-kanban');
  const listViewContainer = document.getElementById('container-task-list');
  const kanbanContainer = document.getElementById('container-kanban-board');

  if (btnListView && btnKanbanView) {
    btnListView.addEventListener('click', () => {
      currentViewMode = 'list';
      btnListView.classList.add('active');
      btnKanbanView.classList.remove('active');
      if (listViewContainer) listViewContainer.style.display = 'flex';
      if (kanbanContainer) kanbanContainer.style.display = 'none';
      renderCurrentView();
    });

    btnKanbanView.addEventListener('click', () => {
      currentViewMode = 'kanban';
      btnKanbanView.classList.add('active');
      btnListView.classList.remove('active');
      if (listViewContainer) listViewContainer.style.display = 'none';
      if (kanbanContainer) kanbanContainer.style.display = 'grid';
      renderCurrentView();
    });
  }
}

// ---------------- List View Rendering ----------------
function renderListView() {
  const container = document.getElementById('container-task-list');
  if (!container) return;

  if (allTasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-list-check empty-icon"></i>
        <div class="empty-title">No tasks found</div>
        <p class="empty-desc">Create your first task or change your filter criteria.</p>
        <button class="btn-primary" onclick="openCreateTaskModal()">
          <i class="fa-solid fa-plus"></i> Create New Task
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = allTasks.map((t) => {
    const isCompleted = t.status === 'Completed';
    const isRunning = !!activeStopwatches[t._id];

    // Due date info
    let dueClass = '';
    let dueText = 'No due date';
    if (t.dueDate) {
      const d = new Date(t.dueDate);
      const now = new Date();
      now.setHours(0,0,0,0);
      const isOverdue = d < now && !isCompleted;
      const isToday = d.toDateString() === new Date().toDateString();

      dueText = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + (t.dueTime ? ` at ${t.dueTime}` : '');
      if (isOverdue) {
        dueClass = 'overdue';
        dueText = `Overdue: ${dueText}`;
      } else if (isToday) {
        dueClass = 'today';
        dueText = `Due Today: ${t.dueTime || ''}`;
      }
    }

    const tagsHtml = (t.tags || []).map((tag) => `<span class="badge badge-tag">#${escapeHTML(tag)}</span>`).join('');
    const actualMins = Math.round((t.actualTime || 0) / 60);

    return `
      <div class="task-list-card ${isCompleted ? 'completed' : ''}" data-id="${t._id}">
        <div class="task-checkbox-wrap">
          <div class="task-checkbox ${isCompleted ? 'checked' : ''}" onclick="toggleTaskStatus('${t._id}', '${t.status}')">
            ${isCompleted ? '<i class="fa-solid fa-check"></i>' : ''}
          </div>
        </div>

        <div class="task-content-main" onclick="openTaskDetails('${t._id}')">
          <div class="task-title-row">
            <span class="task-card-title">${escapeHTML(t.title)}</span>
            <span class="badge badge-${t.priority.toLowerCase()}">${t.priority}</span>
            <span class="badge" style="background: ${t.categoryColor || '#6366f1'}1f; color: ${t.categoryColor || '#6366f1'}">
              ${escapeHTML(t.categoryName || 'General')}
            </span>
            ${t.recurring && t.recurring.isRecurring ? '<span class="badge" title="Recurring Task" style="background: rgba(99,102,241,0.15); color: var(--primary)"><i class="fa-solid fa-arrows-rotate"></i> ' + t.recurring.frequency + '</span>' : ''}
          </div>
          ${t.description ? `<div class="task-card-desc">${escapeHTML(t.description)}</div>` : ''}
          <div class="task-meta-row">
            <span class="task-due-info ${dueClass}"><i class="fa-regular fa-calendar"></i> ${dueText}</span>
            <span class="task-time-spent"><i class="fa-solid fa-stopwatch"></i> ${actualMins}m tracked</span>
            ${t.pomodoroSessions ? `<span><i class="fa-solid fa-fire" style="color: #f59e0b"></i> ${t.pomodoroSessions} pomo</span>` : ''}
            ${t.notes && t.notes.length ? `<span><i class="fa-regular fa-comment"></i> ${t.notes.length}</span>` : ''}
            ${tagsHtml}
          </div>
        </div>

        <div class="task-actions-btn-group">
          <!-- Stopwatch Toggle -->
          <button class="task-stopwatch-btn ${isRunning ? 'running' : ''}" onclick="toggleTaskStopwatch('${t._id}')" title="Live Time Tracker">
            <i class="fa-solid ${isRunning ? 'fa-stop' : 'fa-play'}"></i>
            <span id="stopwatch-display-${t._id}">${isRunning ? formatSeconds(activeStopwatches[t._id].seconds) : 'Timer'}</span>
          </button>

          <button class="action-icon-btn" onclick="openEditTaskModal('${t._id}')" title="Edit Task">
            <i class="fa-regular fa-pen-to-square"></i>
          </button>
          <button class="action-icon-btn" onclick="duplicateTask('${t._id}')" title="Duplicate Task">
            <i class="fa-regular fa-copy"></i>
          </button>
          <button class="action-icon-btn" onclick="toggleArchiveTask('${t._id}')" title="${t.isArchived ? 'Restore' : 'Archive'}">
            <i class="fa-solid ${t.isArchived ? 'fa-box-open' : 'fa-box-archive'}"></i>
          </button>
          <button class="action-icon-btn delete" onclick="confirmDeleteTask('${t._id}')" title="Delete Task">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ---------------- Kanban Board Rendering & Drag/Drop ----------------
function renderKanbanBoard() {
  const container = document.getElementById('container-kanban-board');
  if (!container) return;

  const columns = ['Todo', 'In Progress', 'Completed'];

  container.innerHTML = columns.map((colName) => {
    const colTasks = allTasks.filter((t) => t.status === colName);

    return `
      <div class="kanban-column" data-status="${colName}">
        <div class="kanban-column-header">
          <div class="kanban-column-title">
            <i class="fa-solid ${colName === 'Todo' ? 'fa-circle-notch' : colName === 'In Progress' ? 'fa-spinner' : 'fa-circle-check'}"></i>
            ${colName}
          </div>
          <span class="kanban-column-count">${colTasks.length}</span>
        </div>

        <div class="kanban-tasks-container" data-status="${colName}">
          ${colTasks.map((t) => renderKanbanCard(t)).join('')}
        </div>
      </div>
    `;
  }).join('');

  bindKanbanDragEvents();
}

function renderKanbanCard(task) {
  const dueStr = task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

  return `
    <div class="kanban-card" draggable="true" data-id="${task._id}">
      <div class="kanban-card-top">
        <span class="badge badge-${task.priority.toLowerCase()}">${task.priority}</span>
        <span class="badge" style="background: ${task.categoryColor || '#6366f1'}1f; color: ${task.categoryColor || '#6366f1'}">
          ${escapeHTML(task.categoryName || 'General')}
        </span>
      </div>

      <div class="kanban-card-title" onclick="openTaskDetails('${task._id}')">${escapeHTML(task.title)}</div>

      ${task.description ? `<p style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 8px; max-height: 40px; overflow: hidden;">${escapeHTML(task.description)}</p>` : ''}

      <div class="kanban-card-footer">
        <span><i class="fa-regular fa-clock"></i> ${dueStr || 'No date'}</span>
        <div style="display: flex; gap: 4px;">
          <button class="action-icon-btn" onclick="openEditTaskModal('${task._id}')" style="width:24px;height:24px;font-size:0.75rem;">
            <i class="fa-regular fa-pen-to-square"></i>
          </button>
          <button class="action-icon-btn delete" onclick="confirmDeleteTask('${task._id}')" style="width:24px;height:24px;font-size:0.75rem;">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

function bindKanbanDragEvents() {
  const cards = document.querySelectorAll('.kanban-card');
  const dropContainers = document.querySelectorAll('.kanban-tasks-container');

  cards.forEach((card) => {
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', card.dataset.id);
      card.classList.add('dragging');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });
  });

  dropContainers.forEach((container) => {
    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      container.classList.add('drag-over');
    });

    container.addEventListener('dragleave', () => {
      container.classList.remove('drag-over');
    });

    container.addEventListener('drop', async (e) => {
      e.preventDefault();
      container.classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('text/plain');
      const targetStatus = container.dataset.status;

      if (!taskId || !targetStatus) return;

      const task = allTasks.find((t) => t._id === taskId);
      if (task && task.status !== targetStatus) {
        try {
          await API.tasks.updateStatus(taskId, targetStatus);
          task.status = targetStatus;
          showToast('Updated', `Moved to ${targetStatus}`, 'success');
          loadTasks();
        } catch (err) {
          showToast('Error', err.message, 'error');
        }
      }
    });
  });
}

// ---------------- Task Actions ----------------
async function toggleTaskStatus(id, currentStatus) {
  const nextStatus = currentStatus === 'Completed' ? 'Todo' : 'Completed';
  try {
    const res = await API.tasks.updateStatus(id, nextStatus);
    showToast('Updated', `Task marked as ${nextStatus}`, 'success');
    if (res.recurringTaskGenerated) {
      showToast('Recurring Task', 'Generated next scheduled occurrence!', 'info');
    }
    loadTasks();
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}

async function duplicateTask(id) {
  try {
    await API.tasks.duplicate(id);
    showToast('Duplicated', 'Task copy created', 'success');
    loadTasks();
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}

async function toggleArchiveTask(id) {
  try {
    await API.tasks.toggleArchive(id);
    showToast('Updated', 'Archive status updated', 'info');
    loadTasks();
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}

async function confirmDeleteTask(id) {
  if (confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
    try {
      await API.tasks.delete(id);
      showToast('Deleted', 'Task removed successfully', 'info');
      loadTasks();
    } catch (err) {
      showToast('Error', err.message, 'error');
    }
  }
}

// ---------------- Live Stopwatch Time Tracking ----------------
function toggleTaskStopwatch(taskId) {
  const btn = document.querySelector(`.task-list-card[data-id="${taskId}"] .task-stopwatch-btn`);
  const display = document.getElementById(`stopwatch-display-${taskId}`);

  if (activeStopwatches[taskId]) {
    // Stop and save
    clearInterval(activeStopwatches[taskId].interval);
    const elapsedSeconds = activeStopwatches[taskId].seconds;
    delete activeStopwatches[taskId];

    if (btn) btn.classList.remove('running');
    if (display) display.textContent = 'Timer';

    if (elapsedSeconds > 0) {
      API.tasks.logTime(taskId, elapsedSeconds)
        .then(() => {
          showToast('Time Logged', `Logged ${Math.round(elapsedSeconds / 60)} min(s) to task`, 'success');
          loadTasks();
        })
        .catch((err) => showToast('Error', err.message, 'error'));
    }
  } else {
    // Start stopwatch
    activeStopwatches[taskId] = {
      seconds: 0,
      interval: setInterval(() => {
        activeStopwatches[taskId].seconds++;
        if (display) {
          display.textContent = formatSeconds(activeStopwatches[taskId].seconds);
        }
      }, 1000)
    };

    if (btn) btn.classList.add('running');
    showToast('Timer Started', 'Tracking active work on task', 'info');
  }
}

function formatSeconds(totalSecs) {
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ---------------- Task Create & Edit Modal ----------------
function initTaskFormModal() {
  const modal = document.getElementById('modal-task-form');
  const form = document.getElementById('form-task');
  const closeBtn = document.getElementById('btn-close-task-modal');
  const openBtn = document.getElementById('btn-create-task');

  if (!modal) return;

  if (openBtn) openBtn.addEventListener('click', openCreateTaskModal);
  if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });

  // Recurring toggle listener
  const recurringCheckbox = document.getElementById('task-is-recurring');
  const recurringOptions = document.getElementById('recurring-options-block');
  if (recurringCheckbox && recurringOptions) {
    recurringCheckbox.addEventListener('change', () => {
      recurringOptions.style.display = recurringCheckbox.checked ? 'block' : 'none';
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('task-edit-id').value;

      const payload = {
        title: document.getElementById('task-title').value,
        description: document.getElementById('task-desc').value,
        priority: document.getElementById('task-priority').value,
        category: document.getElementById('task-category').value || null,
        dueDate: document.getElementById('task-due-date').value || null,
        dueTime: document.getElementById('task-due-time').value || '12:00',
        reminderTime: Number(document.getElementById('task-reminder-offset').value || 30),
        estimatedTime: Number(document.getElementById('task-estimated-time').value || 0),
        tags: document.getElementById('task-tags').value,
        recurring: {
          isRecurring: recurringCheckbox ? recurringCheckbox.checked : false,
          frequency: document.getElementById('task-recurring-freq').value,
          intervalDays: Number(document.getElementById('task-recurring-interval').value || 1)
        }
      };

      try {
        if (id) {
          await API.tasks.update(id, payload);
          showToast('Updated', 'Task updated successfully', 'success');
        } else {
          await API.tasks.create(payload);
          showToast('Created', 'Task created successfully', 'success');
        }
        modal.classList.remove('active');
        loadTasks();
      } catch (err) {
        showToast('Error', err.message, 'error');
      }
    });
  }
}

function openCreateTaskModal() {
  const modal = document.getElementById('modal-task-form');
  const form = document.getElementById('form-task');
  const titleEl = document.getElementById('modal-task-form-title');
  if (!modal || !form) return;

  form.reset();
  document.getElementById('task-edit-id').value = '';
  if (titleEl) titleEl.textContent = 'Create New Task';

  const recurringOptions = document.getElementById('recurring-options-block');
  if (recurringOptions) recurringOptions.style.display = 'none';

  modal.classList.add('active');
}

function openEditTaskModal(id) {
  const task = allTasks.find((t) => t._id === id);
  if (!task) return;

  const modal = document.getElementById('modal-task-form');
  const form = document.getElementById('form-task');
  const titleEl = document.getElementById('modal-task-form-title');

  document.getElementById('task-edit-id').value = task._id;
  document.getElementById('task-title').value = task.title;
  document.getElementById('task-desc').value = task.description || '';
  document.getElementById('task-priority').value = task.priority;
  document.getElementById('task-category').value = task.category ? (task.category._id || task.category) : '';

  if (task.dueDate) {
    const d = new Date(task.dueDate);
    document.getElementById('task-due-date').value = d.toISOString().split('T')[0];
  } else {
    document.getElementById('task-due-date').value = '';
  }

  document.getElementById('task-due-time').value = task.dueTime || '12:00';
  document.getElementById('task-reminder-offset').value = task.reminderTime || 30;
  document.getElementById('task-estimated-time').value = task.estimatedTime || 0;
  document.getElementById('task-tags').value = (task.tags || []).join(', ');

  const recCheck = document.getElementById('task-is-recurring');
  const recOptions = document.getElementById('recurring-options-block');
  if (recCheck && recOptions) {
    recCheck.checked = task.recurring && task.recurring.isRecurring;
    recOptions.style.display = recCheck.checked ? 'block' : 'none';
    if (task.recurring) {
      document.getElementById('task-recurring-freq').value = task.recurring.frequency || 'None';
      document.getElementById('task-recurring-interval').value = task.recurring.intervalDays || 1;
    }
  }

  if (titleEl) titleEl.textContent = 'Edit Task';
  modal.classList.add('active');
}

// ---------------- Task Details Modal (Notes & Timeline) ----------------
function initTaskDetailsModal() {
  const modal = document.getElementById('modal-task-details');
  const closeBtn = document.getElementById('btn-close-details-modal');

  if (!modal) return;
  if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });

  // Details tabs switcher
  const tabNotes = document.getElementById('tab-btn-notes');
  const tabActivity = document.getElementById('tab-btn-activity');
  const contentNotes = document.getElementById('tab-content-notes');
  const contentActivity = document.getElementById('tab-content-activity');

  if (tabNotes && tabActivity) {
    tabNotes.addEventListener('click', () => {
      tabNotes.classList.add('active');
      tabActivity.classList.remove('active');
      contentNotes.style.display = 'block';
      contentActivity.style.display = 'none';
    });

    tabActivity.addEventListener('click', () => {
      tabActivity.classList.add('active');
      tabNotes.classList.remove('active');
      contentNotes.style.display = 'none';
      contentActivity.style.display = 'block';
    });
  }

  // Add Note Form
  const noteForm = document.getElementById('form-add-note');
  if (noteForm) {
    noteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('note-input-content');
      if (!input || !input.value.trim() || !selectedTaskIdForDetails) return;

      try {
        await API.tasks.addNote(selectedTaskIdForDetails, input.value.trim());
        input.value = '';
        showToast('Note Added', 'Saved note to task', 'success');
        openTaskDetails(selectedTaskIdForDetails);
      } catch (err) {
        showToast('Error', err.message, 'error');
      }
    });
  }
}

async function openTaskDetails(id) {
  selectedTaskIdForDetails = id;
  const modal = document.getElementById('modal-task-details');
  if (!modal) return;

  try {
    const res = await API.tasks.getById(id);
    const task = res.data;

    document.getElementById('details-title').textContent = task.title;
    document.getElementById('details-desc').textContent = task.description || 'No description provided.';
    document.getElementById('details-priority').textContent = task.priority;
    document.getElementById('details-priority').className = `badge badge-${task.priority.toLowerCase()}`;
    document.getElementById('details-category').textContent = task.categoryName || 'General';
    document.getElementById('details-status').textContent = task.status;
    document.getElementById('details-due').textContent = task.dueDate
      ? `${new Date(task.dueDate).toLocaleDateString()} at ${task.dueTime || ''}`
      : 'None';
    document.getElementById('details-time-tracked').textContent = `${Math.round((task.actualTime || 0) / 60)} mins`;

    // Render Notes
    renderNotesList(task.notes || []);

    // Render Activity
    renderActivityTimeline(task.activities || []);

    modal.classList.add('active');
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}

function renderNotesList(notes) {
  const container = document.getElementById('notes-list-container');
  if (!container) return;

  if (notes.length === 0) {
    container.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-dim);">No notes added yet.</p>`;
    return;
  }

  container.innerHTML = notes.map((n) => `
    <div class="note-item" data-note-id="${n._id}">
      <div class="note-item-header">
        <span>${new Date(n.createdAt).toLocaleString()}</span>
        <button class="action-icon-btn delete" onclick="deleteTaskNote('${selectedTaskIdForDetails}', '${n._id}')" style="width:20px;height:20px;font-size:0.7rem;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="note-item-text">${escapeHTML(n.content)}</div>
    </div>
  `).join('');
}

async function deleteTaskNote(taskId, noteId) {
  try {
    await API.tasks.deleteNote(taskId, noteId);
    showToast('Deleted', 'Note removed', 'info');
    openTaskDetails(taskId);
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}

function renderActivityTimeline(activities) {
  const container = document.getElementById('activity-timeline-container');
  if (!container) return;

  if (activities.length === 0) {
    container.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-dim);">No activity logged yet.</p>`;
    return;
  }

  container.innerHTML = activities.map((a) => `
    <div class="timeline-item">
      <div class="timeline-dot"></div>
      <div class="timeline-content">
        <div class="timeline-title">${escapeHTML(a.details || a.action)}</div>
        <div class="timeline-time">${new Date(a.createdAt).toLocaleString()}</div>
      </div>
    </div>
  `).join('');
}

// ---------------- Category Management Modal ----------------
function initCategoryModal() {
  const modal = document.getElementById('modal-categories');
  const openBtn = document.getElementById('btn-open-category-modal');
  const closeBtn = document.getElementById('btn-close-category-modal');
  const form = document.getElementById('form-add-category');

  if (!modal) return;
  if (openBtn) openBtn.addEventListener('click', openCategoryModal);
  if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('category-name-input').value;
      const color = document.getElementById('category-color-input').value;

      try {
        await API.categories.create({ name, color });
        showToast('Created', 'Category added', 'success');
        document.getElementById('category-name-input').value = '';
        await loadCategories();
        openCategoryModal();
      } catch (err) {
        showToast('Error', err.message, 'error');
      }
    });
  }
}

function openCategoryModal() {
  const modal = document.getElementById('modal-categories');
  const list = document.getElementById('category-list-management');
  if (!modal || !list) return;

  list.innerHTML = allCategories.map((c) => `
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: var(--bg-input); border-radius: var(--radius-md); margin-bottom: 8px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="width: 14px; height: 14px; border-radius: 50%; background: ${c.color}"></span>
        <span style="font-weight: 600; font-size: 0.9rem;">${escapeHTML(c.name)}</span>
        <span style="font-size: 0.75rem; color: var(--text-dim);">(${c.taskCount || 0} tasks)</span>
      </div>
      <button class="action-icon-btn delete" onclick="deleteCategoryAction('${c._id}')" title="Delete">
        <i class="fa-regular fa-trash-can"></i>
      </button>
    </div>
  `).join('');

  modal.classList.add('active');
}

async function deleteCategoryAction(id) {
  if (confirm('Delete this category? Tasks in this category will be unassigned.')) {
    try {
      await API.categories.delete(id);
      showToast('Deleted', 'Category removed', 'info');
      await loadCategories();
      openCategoryModal();
      loadTasks();
    } catch (err) {
      showToast('Error', err.message, 'error');
    }
  }
}
