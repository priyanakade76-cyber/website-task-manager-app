/**
 * Interactive Monthly & Weekly Productivity Calendar
 */

let currentCalendarDate = new Date();
let calendarTasks = [];
let calendarViewType = 'month'; // 'month' | 'week'

document.addEventListener('DOMContentLoaded', () => {
  if (API.isAuthenticated()) {
    initCalendarApp();
  }
});

async function initCalendarApp() {
  bindCalendarControls();
  await loadCalendarTasks();
  renderCalendar();
}

async function loadCalendarTasks() {
  try {
    const res = await API.tasks.getAll({ isArchived: 'false' });
    calendarTasks = res.data || [];
  } catch (err) {
    showToast('Error', 'Could not load calendar tasks', 'error');
  }
}

function bindCalendarControls() {
  const prevBtn = document.getElementById('btn-cal-prev');
  const nextBtn = document.getElementById('btn-cal-next');
  const todayBtn = document.getElementById('btn-cal-today');
  const monthViewBtn = document.getElementById('btn-cal-month-view');
  const weekViewBtn = document.getElementById('btn-cal-week-view');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (calendarViewType === 'month') {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
      } else {
        currentCalendarDate.setDate(currentCalendarDate.getDate() - 7);
      }
      renderCalendar();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (calendarViewType === 'month') {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
      } else {
        currentCalendarDate.setDate(currentCalendarDate.getDate() + 7);
      }
      renderCalendar();
    });
  }

  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      currentCalendarDate = new Date();
      renderCalendar();
    });
  }

  if (monthViewBtn && weekViewBtn) {
    monthViewBtn.addEventListener('click', () => {
      calendarViewType = 'month';
      monthViewBtn.classList.add('active');
      weekViewBtn.classList.remove('active');
      renderCalendar();
    });

    weekViewBtn.addEventListener('click', () => {
      calendarViewType = 'week';
      weekViewBtn.classList.add('active');
      monthViewBtn.classList.remove('active');
      renderCalendar();
    });
  }
}

function renderCalendar() {
  const titleEl = document.getElementById('cal-month-year-title');
  const gridEl = document.getElementById('calendar-grid');

  if (!gridEl) return;

  if (titleEl) {
    titleEl.textContent = currentCalendarDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  }

  if (calendarViewType === 'month') {
    renderMonthGrid(gridEl);
  } else {
    renderWeekGrid(gridEl);
  }
}

function renderMonthGrid(gridEl) {
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  const todayStr = new Date().toDateString();

  let html = `
    <div class="calendar-header-days">
      <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
    </div>
    <div class="calendar-days-matrix">
  `;

  // Previous month trailing days
  for (let x = firstDayIndex; x > 0; x--) {
    const dayNum = prevMonthTotalDays - x + 1;
    html += `<div class="cal-day-cell other-month"><span class="cal-day-num">${dayNum}</span></div>`;
  }

  // Current month days
  for (let day = 1; day <= totalDays; day++) {
    const thisDate = new Date(year, month, day);
    const isToday = thisDate.toDateString() === todayStr;
    const dateISO = thisDate.toISOString().split('T')[0];

    // Filter tasks due on this day
    const dayTasks = calendarTasks.filter((t) => {
      if (!t.dueDate) return false;
      const tDate = new Date(t.dueDate);
      return (
        tDate.getFullYear() === year &&
        tDate.getMonth() === month &&
        tDate.getDate() === day
      );
    });

    const isPast = thisDate < new Date(new Date().setHours(0,0,0,0));

    html += `
      <div class="cal-day-cell ${isToday ? 'today' : ''}" onclick="onDayCellClick('${dateISO}', event)">
        <div class="cal-cell-header">
          <span class="cal-day-num ${isToday ? 'today-pill' : ''}">${day}</span>
          ${dayTasks.length ? `<span class="cal-task-count">${dayTasks.length}</span>` : ''}
        </div>
        <div class="cal-tasks-wrapper">
          ${dayTasks.map((t) => {
            const isOverdue = isPast && t.status !== 'Completed';
            return `
              <div class="cal-task-pill ${isOverdue ? 'overdue' : ''} ${t.status === 'Completed' ? 'completed' : ''}"
                   style="border-left: 3px solid ${t.categoryColor || '#6366f1'}"
                   onclick="event.stopPropagation(); window.location.href='/tasks.html?id=${t._id}'"
                   title="${escapeHTML(t.title)} (${t.priority})">
                <span class="badge badge-${t.priority.toLowerCase()}" style="font-size:0.6rem;padding:1px 4px;">${t.priority[0]}</span>
                <span class="cal-task-title-text">${escapeHTML(t.title)}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // Trailing next month days to fill 7 columns
  const remainingCells = 42 - (firstDayIndex + totalDays);
  for (let nextDay = 1; nextDay <= (remainingCells % 7); nextDay++) {
    html += `<div class="cal-day-cell other-month"><span class="cal-day-num">${nextDay}</span></div>`;
  }

  html += `</div>`;
  gridEl.innerHTML = html;
}

function renderWeekGrid(gridEl) {
  const curr = new Date(currentCalendarDate);
  const first = curr.getDate() - curr.getDay(); // Sunday
  const todayStr = new Date().toDateString();

  let html = `
    <div class="calendar-header-days">
      <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
    </div>
    <div class="calendar-days-matrix week-view">
  `;

  for (let i = 0; i < 7; i++) {
    const nextDate = new Date(curr.setDate(first + i));
    const isToday = nextDate.toDateString() === todayStr;
    const dateISO = nextDate.toISOString().split('T')[0];

    const dayTasks = calendarTasks.filter((t) => {
      if (!t.dueDate) return false;
      const tDate = new Date(t.dueDate);
      return tDate.toDateString() === nextDate.toDateString();
    });

    html += `
      <div class="cal-day-cell week-col ${isToday ? 'today' : ''}" onclick="onDayCellClick('${dateISO}', event)">
        <div class="cal-cell-header">
          <span class="cal-day-num ${isToday ? 'today-pill' : ''}">
            ${nextDate.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}
          </span>
        </div>
        <div class="cal-tasks-wrapper">
          ${dayTasks.map((t) => `
            <div class="cal-task-pill ${t.status === 'Completed' ? 'completed' : ''}"
                 style="border-left: 3px solid ${t.categoryColor || '#6366f1'}"
                 onclick="event.stopPropagation(); window.location.href='/tasks.html?id=${t._id}'">
              <span class="badge badge-${t.priority.toLowerCase()}">${t.priority}</span>
              <span class="cal-task-title-text">${escapeHTML(t.title)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  html += `</div>`;
  gridEl.innerHTML = html;
}

function onDayCellClick(dateISO, event) {
  // If user clicked directly on empty cell, navigate to tasks page with date or open create modal
  window.location.href = `/tasks.html?createDate=${dateISO}`;
}
