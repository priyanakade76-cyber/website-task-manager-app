/**
 * Data formatters to transform PostgreSQL relational snake_case rows
 * into the camelCase structures and dual _id/id shapes expected by
 * the frontend UI, API contracts, and client JavaScript.
 */

const formatUser = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    name: row.name,
    email: row.email,
    profileImage: row.profile_image || '',
    theme: row.theme || 'dark',
    notificationSettings: row.notification_settings || {
      emailAlerts: true,
      browserAlerts: true,
      dueSoonHours: 24
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const formatCategory = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color || '#6366f1',
    icon: row.icon || 'fa-folder',
    isDefault: !!row.is_default,
    taskCount: row.taskCount !== undefined ? row.taskCount : 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const formatNote = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    taskId: row.task_id,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const formatTask = (row, notes = [], categoryObj = null) => {
  if (!row) return null;

  let tagsArray = [];
  if (Array.isArray(row.tags)) {
    tagsArray = row.tags;
  } else if (typeof row.tags === 'string') {
    try {
      tagsArray = JSON.parse(row.tags);
    } catch (e) {
      tagsArray = [row.tags];
    }
  }

  let recurringObj = { isRecurring: false, frequency: 'None', intervalDays: 1, nextOccurrence: null };
  if (typeof row.recurring === 'object' && row.recurring !== null) {
    recurringObj = row.recurring;
  } else if (typeof row.recurring === 'string') {
    try {
      recurringObj = JSON.parse(row.recurring);
    } catch (e) {
      // fallback default
    }
  }

  // Populate category if object provided or joined from query
  let categoryField = row.category_id || null;
  if (categoryObj) {
    categoryField = formatCategory(categoryObj);
  } else if (row.categories && typeof row.categories === 'object') {
    categoryField = formatCategory(row.categories);
  }

  const formattedNotes = (notes && notes.length > 0 ? notes : (row.task_notes || [])).map(formatNote);

  return {
    id: row.id,
    _id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description || '',
    status: row.status || 'Todo',
    priority: row.priority || 'Medium',
    category: categoryField,
    categoryName: row.category_name || (categoryField && categoryField.name) || 'General',
    categoryColor: row.category_color || (categoryField && categoryField.color) || '#6366f1',
    tags: tagsArray,
    dueDate: row.due_date,
    dueTime: row.due_time || '12:00',
    reminderTime: row.reminder_time !== undefined ? Number(row.reminder_time) : 30,
    estimatedTime: row.estimated_time !== undefined ? Number(row.estimated_time) : 0,
    actualTime: row.actual_time !== undefined ? Number(row.actual_time) : 0,
    recurring: recurringObj,
    isArchived: !!row.is_archived,
    completedAt: row.completed_at,
    pomodoroSessions: row.pomodoro_sessions || 0,
    order: row.task_order !== undefined ? Number(row.task_order) : 0,
    notes: formattedNotes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const formatActivity = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    userId: row.user_id,
    taskId: row.task_id,
    taskTitle: row.task_title || '',
    action: row.action,
    details: row.details || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const formatNotification = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    userId: row.user_id,
    taskId: row.task_id,
    title: row.title,
    message: row.message,
    type: row.type || 'general',
    isRead: !!row.is_read,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

module.exports = {
  formatUser,
  formatCategory,
  formatTask,
  formatNote,
  formatActivity,
  formatNotification
};
