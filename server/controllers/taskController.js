const { supabase } = require('../config/supabase');
const { formatTask, formatNote, formatActivity, formatCategory } = require('../utils/formatters');

// Helper to log task activity
const logActivity = async (userId, taskId, taskTitle, action, details) => {
  try {
    await supabase.from('activities').insert({
      user_id: userId,
      task_id: taskId,
      task_title: taskTitle,
      action,
      details
    });
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
};

// Helper for recurring task generation
const handleRecurringTask = async (task, userId) => {
  const recurring = task.recurring || {};
  if (!recurring.isRecurring || recurring.frequency === 'None') {
    return null;
  }

  const baseDate = task.due_date ? new Date(task.due_date) : new Date();
  let nextDate = new Date(baseDate);

  switch (recurring.frequency) {
    case 'Daily':
      nextDate.setDate(nextDate.getDate() + (recurring.intervalDays || 1));
      break;
    case 'Weekly':
      nextDate.setDate(nextDate.getDate() + 7 * (recurring.intervalDays || 1));
      break;
    case 'Monthly':
      nextDate.setMonth(nextDate.getMonth() + (recurring.intervalDays || 1));
      break;
    case 'Custom':
      nextDate.setDate(nextDate.getDate() + (recurring.intervalDays || 1));
      break;
    default:
      return null;
  }

  const { data: nextTask, error } = await supabase
    .from('tasks')
    .insert({
      user_id: userId,
      title: task.title,
      description: task.description || '',
      status: 'Todo',
      priority: task.priority || 'Medium',
      category_id: task.category_id || null,
      category_name: task.category_name || 'General',
      category_color: task.category_color || '#6366f1',
      tags: task.tags || [],
      due_date: nextDate.toISOString(),
      due_time: task.due_time || '12:00',
      reminder_time: task.reminder_time !== undefined ? task.reminder_time : 30,
      estimated_time: task.estimated_time !== undefined ? task.estimated_time : 0,
      actual_time: 0,
      recurring: {
        ...recurring,
        nextOccurrence: null
      },
      is_archived: false,
      task_order: 0
    })
    .select()
    .single();

  if (error || !nextTask) {
    console.error('Error generating recurring task:', error?.message);
    return null;
  }

  await logActivity(
    userId,
    nextTask.id,
    nextTask.title,
    'created',
    `Auto-generated recurring task from previous completed instance (Due: ${nextDate.toISOString().split('T')[0]})`
  );

  await supabase.from('notifications').insert({
    user_id: userId,
    title: 'Recurring Task Created',
    message: `New instance for "${task.title}" scheduled for ${nextDate.toISOString().split('T')[0]}`,
    type: 'recurring_created',
    task_id: nextTask.id
  });

  return formatTask(nextTask);
};

// @desc    Get all tasks with filtering, search, sorting
// @route   GET /api/tasks
// @access  Private
const getTasks = async (req, res, next) => {
  try {
    const {
      search,
      status,
      priority,
      category,
      tag,
      isArchived,
      dueDateFilter,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const isArchivedBool = isArchived === 'true';

    // Fetch user tasks
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('is_archived', isArchivedBool);

    // Status filter
    if (status && status !== 'All') {
      query = query.eq('status', status);
    }

    // Priority filter
    if (priority && priority !== 'All') {
      query = query.eq('priority', priority);
    }

    // Category filter
    if (category && category !== 'All') {
      query = query.eq('category_id', category);
    }

    // Due date presets
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (dueDateFilter === 'today') {
      query = query.gte('due_date', startOfToday.toISOString()).lte('due_date', endOfToday.toISOString());
    } else if (dueDateFilter === 'overdue') {
      query = query.lt('due_date', startOfToday.toISOString()).neq('status', 'Completed');
    } else if (dueDateFilter === 'week') {
      const startOfWeek = new Date(startOfToday);
      const endOfWeek = new Date(startOfToday);
      endOfWeek.setDate(endOfWeek.getDate() + 7);
      query = query.gte('due_date', startOfWeek.toISOString()).lte('due_date', endOfWeek.toISOString());
    } else if (dueDateFilter === 'upcoming') {
      query = query.gt('due_date', endOfToday.toISOString());
    }

    // Sorting
    const isAsc = sortOrder === 'asc';
    switch (sortBy) {
      case 'dueDate':
        query = query.order('due_date', { ascending: isAsc });
        break;
      case 'priority':
        query = query.order('priority', { ascending: isAsc });
        break;
      case 'title':
        query = query.order('title', { ascending: isAsc });
        break;
      case 'updatedAt':
        query = query.order('updated_at', { ascending: isAsc });
        break;
      case 'order':
        query = query.order('task_order', { ascending: true });
        break;
      case 'createdAt':
      default:
        query = query.order('created_at', { ascending: isAsc });
        break;
    }

    const { data: rawTasks, error } = await query;

    if (error) {
      return next(error);
    }

    let tasks = rawTasks || [];

    // Tag filter & Search in memory for array fields and combined search
    if (tag) {
      const cleanTag = tag.replace('#', '').trim().toLowerCase();
      tasks = tasks.filter((t) => {
        const tTags = Array.isArray(t.tags) ? t.tags : [];
        return tTags.some((x) => x.toLowerCase() === cleanTag);
      });
    }

    if (search && search.trim() !== '') {
      const s = search.trim().toLowerCase();
      tasks = tasks.filter((t) => {
        const inTitle = (t.title || '').toLowerCase().includes(s);
        const inDesc = (t.description || '').toLowerCase().includes(s);
        const inTags = Array.isArray(t.tags) && t.tags.some((x) => x.toLowerCase().includes(s));
        return inTitle || inDesc || inTags;
      });
    }

    // Fetch user categories for population
    const { data: userCategories } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', req.user.id);

    const categoryMap = {};
    if (userCategories) {
      userCategories.forEach((c) => {
        categoryMap[c.id] = c;
      });
    }

    // Fetch notes for tasks
    const taskIds = tasks.map((t) => t.id);
    let notesMap = {};
    if (taskIds.length > 0) {
      const { data: allNotes } = await supabase
        .from('task_notes')
        .select('*');

      if (allNotes) {
        allNotes.forEach((n) => {
          if (!notesMap[n.task_id]) notesMap[n.task_id] = [];
          notesMap[n.task_id].push(n);
        });
      }
    }

    const formattedTasks = tasks.map((t) => {
      const catObj = t.category_id ? categoryMap[t.category_id] : null;
      const tNotes = notesMap[t.id] || [];
      return formatTask(t, tNotes, catObj);
    });

    res.status(200).json({
      success: true,
      count: formattedTasks.length,
      data: formattedTasks
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get dashboard metrics & Chart.js productivity analytics
// @route   GET /api/tasks/stats
// @access  Private
const getTaskStats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const { data: allTasksRaw, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('is_archived', false);

    if (error) {
      return next(error);
    }

    const allTasks = allTasksRaw || [];

    const total = allTasks.length;
    const completed = allTasks.filter((t) => t.status === 'Completed').length;
    const inProgress = allTasks.filter((t) => t.status === 'In Progress').length;
    const todo = allTasks.filter((t) => t.status === 'Todo').length;
    const pending = total - completed;

    const overdue = allTasks.filter(
      (t) => t.due_date && new Date(t.due_date) < startOfToday && t.status !== 'Completed'
    ).length;

    const dueToday = allTasks.filter((t) => {
      if (!t.due_date) return false;
      const d = new Date(t.due_date);
      return d >= startOfToday && d <= endOfToday;
    }).length;

    const highPriority = allTasks.filter(
      (t) => (t.priority === 'High' || t.priority === 'Urgent') && t.status !== 'Completed'
    ).length;

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const completedThisWeek = allTasks.filter((t) => {
      if (t.status !== 'Completed' || !t.completed_at) return false;
      return new Date(t.completed_at) >= sevenDaysAgo;
    }).length;

    // Daily completed (last 7 days)
    const daysLabels = [];
    const dailyCompletedCounts = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(startOfToday);
      d.setDate(d.getDate() - i);
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
      const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
      daysLabels.push(label);

      const count = allTasks.filter((t) => {
        if (t.status !== 'Completed' || !t.completed_at) return false;
        const compDate = new Date(t.completed_at);
        return compDate >= d && compDate <= dayEnd;
      }).length;
      dailyCompletedCounts.push(count);
    }

    // Weekly completed (last 4 weeks)
    const weeksLabels = ['3 Weeks Ago', '2 Weeks Ago', 'Last Week', 'This Week'];
    const weeklyCompletedCounts = [0, 0, 0, 0];
    for (let w = 0; w < 4; w++) {
      const weekStart = new Date(startOfToday);
      weekStart.setDate(weekStart.getDate() - (3 - w) * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      weeklyCompletedCounts[w] = allTasks.filter((t) => {
        if (t.status !== 'Completed' || !t.completed_at) return false;
        const compDate = new Date(t.completed_at);
        return compDate >= weekStart && compDate < weekEnd;
      }).length;
    }

    // Tasks by priority
    const priorityCounts = {
      Low: allTasks.filter((t) => t.priority === 'Low').length,
      Medium: allTasks.filter((t) => t.priority === 'Medium').length,
      High: allTasks.filter((t) => t.priority === 'High').length,
      Urgent: allTasks.filter((t) => t.priority === 'Urgent').length
    };

    // Tasks by category
    const categoryCountsMap = {};
    allTasks.forEach((t) => {
      const cat = t.category_name || 'General';
      categoryCountsMap[cat] = (categoryCountsMap[cat] || 0) + 1;
    });

    const categoryLabels = Object.keys(categoryCountsMap);
    const categoryCounts = Object.values(categoryCountsMap);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          total,
          completed,
          pending,
          inProgress,
          todo,
          overdue,
          dueToday,
          highPriority,
          completionRate,
          completedThisWeek,
          productivityMessage: `You completed ${completedThisWeek} task${completedThisWeek === 1 ? '' : 's'} this week.`
        },
        charts: {
          dailyCompleted: {
            labels: daysLabels,
            data: dailyCompletedCounts
          },
          weeklyCompleted: {
            labels: weeksLabels,
            data: weeklyCompletedCounts
          },
          byPriority: {
            labels: ['Low', 'Medium', 'High', 'Urgent'],
            data: [
              priorityCounts.Low,
              priorityCounts.Medium,
              priorityCounts.High,
              priorityCounts.Urgent
            ]
          },
          byCategory: {
            labels: categoryLabels,
            data: categoryCounts
          },
          statusDistribution: {
            labels: ['Completed', 'In Progress', 'Todo'],
            data: [completed, inProgress, todo]
          }
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single task by ID with activities & notes
// @route   GET /api/tasks/:id
// @access  Private
const getTaskById = async (req, res, next) => {
  try {
    const { data: task, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (error || !task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    let categoryObj = null;
    if (task.category_id) {
      const { data: cat } = await supabase
        .from('categories')
        .select('*')
        .eq('id', task.category_id)
        .maybeSingle();
      categoryObj = cat;
    }

    const { data: notes } = await supabase
      .from('task_notes')
      .select('*')
      .eq('task_id', task.id)
      .order('created_at', { ascending: true });

    const { data: activities } = await supabase
      .from('activities')
      .select('*')
      .eq('task_id', task.id)
      .order('created_at', { ascending: false })
      .limit(30);

    const formattedTask = formatTask(task, notes || [], categoryObj);

    res.status(200).json({
      success: true,
      data: {
        ...formattedTask,
        activities: (activities || []).map(formatActivity)
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create a new task
// @route   POST /api/tasks
// @access  Private
const createTask = async (req, res, next) => {
  try {
    const {
      title,
      description,
      status,
      priority,
      category,
      tags,
      dueDate,
      dueTime,
      reminderTime,
      estimatedTime,
      recurring
    } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Task title is required'
      });
    }

    let categoryDoc = null;
    let categoryName = 'General';
    let categoryColor = '#6366f1';

    if (category) {
      const { data: cat } = await supabase
        .from('categories')
        .select('*')
        .eq('id', category)
        .eq('user_id', req.user.id)
        .maybeSingle();
      if (cat) {
        categoryDoc = cat;
        categoryName = cat.name;
        categoryColor = cat.color;
      }
    }

    let formattedTags = [];
    if (Array.isArray(tags)) {
      formattedTags = tags.map((t) => t.trim().replace(/^#/, '')).filter(Boolean);
    } else if (typeof tags === 'string' && tags.trim()) {
      formattedTags = tags
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);
    }

    const isCompleted = status === 'Completed';

    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        user_id: req.user.id,
        title: title.trim(),
        description: description ? description.trim() : '',
        status: status || 'Todo',
        priority: priority || 'Medium',
        category_id: categoryDoc ? categoryDoc.id : null,
        category_name: categoryName,
        category_color: categoryColor,
        tags: formattedTags,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        due_time: dueTime || '12:00',
        reminder_time: reminderTime !== undefined ? Number(reminderTime) : 30,
        estimated_time: estimatedTime !== undefined ? Number(estimatedTime) : 0,
        actual_time: 0,
        recurring: recurring || { isRecurring: false, frequency: 'None', intervalDays: 1, nextOccurrence: null },
        completed_at: isCompleted ? new Date().toISOString() : null,
        is_archived: false,
        task_order: 0
      })
      .select()
      .single();

    if (error) {
      return next(error);
    }

    await logActivity(req.user.id, task.id, task.title, 'created', 'Task created');

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: formatTask(task, [], categoryDoc)
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private
const updateTask = async (req, res, next) => {
  try {
    const { data: task, error: findError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (findError || !task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const {
      title,
      description,
      status,
      priority,
      category,
      tags,
      dueDate,
      dueTime,
      reminderTime,
      estimatedTime,
      actualTime,
      recurring
    } = req.body;

    const previousStatus = task.status;
    const previousPriority = task.priority;
    const updates = {};

    if (title) updates.title = title.trim();
    if (description !== undefined) updates.description = description.trim();
    if (priority) updates.priority = priority;

    let categoryDoc = null;
    if (category !== undefined) {
      if (category) {
        const { data: cat } = await supabase
          .from('categories')
          .select('*')
          .eq('id', category)
          .eq('user_id', req.user.id)
          .maybeSingle();
        if (cat) {
          categoryDoc = cat;
          updates.category_id = cat.id;
          updates.category_name = cat.name;
          updates.category_color = cat.color;
        }
      } else {
        updates.category_id = null;
        updates.category_name = 'General';
        updates.category_color = '#6366f1';
      }
    }

    if (tags !== undefined) {
      if (Array.isArray(tags)) {
        updates.tags = tags.map((t) => t.trim().replace(/^#/, '')).filter(Boolean);
      } else if (typeof tags === 'string') {
        updates.tags = tags
          .split(',')
          .map((t) => t.trim().replace(/^#/, ''))
          .filter(Boolean);
      }
    }

    if (dueDate !== undefined) updates.due_date = dueDate ? new Date(dueDate).toISOString() : null;
    if (dueTime !== undefined) updates.due_time = dueTime;
    if (reminderTime !== undefined) updates.reminder_time = Number(reminderTime);
    if (estimatedTime !== undefined) updates.estimated_time = Number(estimatedTime);
    if (actualTime !== undefined) updates.actual_time = Number(actualTime);
    if (recurring !== undefined) updates.recurring = recurring;

    if (status && status !== previousStatus) {
      updates.status = status;
      updates.completed_at = status === 'Completed' ? new Date().toISOString() : null;
    }

    const { data: updatedTask, error: updateError } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (updateError) {
      return next(updateError);
    }

    // Status change activity & recurring handler
    if (status && status !== previousStatus) {
      await logActivity(
        req.user.id,
        updatedTask.id,
        updatedTask.title,
        'status_changed',
        `Status changed from ${previousStatus} to ${status}`
      );

      if (status === 'Completed') {
        await logActivity(req.user.id, updatedTask.id, updatedTask.title, 'completed', 'Task marked as completed');
        await handleRecurringTask(updatedTask, req.user.id);
      }
    }

    if (priority && priority !== previousPriority) {
      await logActivity(
        req.user.id,
        updatedTask.id,
        updatedTask.title,
        'priority_changed',
        `Priority changed from ${previousPriority} to ${priority}`
      );
    }

    // Fetch notes to return complete task
    const { data: notes } = await supabase
      .from('task_notes')
      .select('*')
      .eq('task_id', updatedTask.id);

    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      data: formatTask(updatedTask, notes || [], categoryDoc)
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Patch task status (e.g. quick toggle or Kanban drag-and-drop)
// @route   PATCH /api/tasks/:id/status
// @access  Private
const updateTaskStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!['Todo', 'In Progress', 'Completed', 'Archived'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task status'
      });
    }

    const { data: task, error: findError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (findError || !task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const previousStatus = task.status;
    const completedAt = status === 'Completed' ? new Date().toISOString() : null;

    const { data: updatedTask, error: updateError } = await supabase
      .from('tasks')
      .update({
        status,
        completed_at: completedAt
      })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (updateError) {
      return next(updateError);
    }

    await logActivity(
      req.user.id,
      updatedTask.id,
      updatedTask.title,
      'status_changed',
      `Moved from ${previousStatus} to ${status}`
    );

    let recurringTask = null;
    if (status === 'Completed') {
      await logActivity(req.user.id, updatedTask.id, updatedTask.title, 'completed', 'Task marked as completed');
      recurringTask = await handleRecurringTask(updatedTask, req.user.id);

      await supabase.from('notifications').insert({
        user_id: req.user.id,
        title: 'Task Completed',
        message: `Great job! You finished "${updatedTask.title}"`,
        type: 'completed',
        task_id: updatedTask.id
      });
    }

    res.status(200).json({
      success: true,
      message: `Status updated to ${status}`,
      data: formatTask(updatedTask),
      recurringTaskGenerated: !!recurringTask
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Archive / unarchive task
// @route   PATCH /api/tasks/:id/archive
// @access  Private
const toggleArchive = async (req, res, next) => {
  try {
    const { data: task, error: findError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (findError || !task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const newArchived = !task.is_archived;
    const { data: updatedTask, error: updateError } = await supabase
      .from('tasks')
      .update({ is_archived: newArchived })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (updateError) {
      return next(updateError);
    }

    const action = newArchived ? 'archived' : 'restored';
    await logActivity(req.user.id, updatedTask.id, updatedTask.title, action, `Task ${action}`);

    res.status(200).json({
      success: true,
      message: `Task ${action} successfully`,
      data: formatTask(updatedTask)
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Duplicate a task
// @route   POST /api/tasks/:id/duplicate
// @access  Private
const duplicateTask = async (req, res, next) => {
  try {
    const { data: task, error: findError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (findError || !task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const { data: newTask, error: insertError } = await supabase
      .from('tasks')
      .insert({
        user_id: req.user.id,
        title: `${task.title} (Copy)`,
        description: task.description,
        status: 'Todo',
        priority: task.priority,
        category_id: task.category_id,
        category_name: task.category_name,
        category_color: task.category_color,
        tags: Array.isArray(task.tags) ? [...task.tags] : [],
        due_date: task.due_date,
        due_time: task.due_time,
        reminder_time: task.reminder_time,
        estimated_time: task.estimated_time,
        actual_time: 0,
        recurring: { ...(task.recurring || {}), nextOccurrence: null },
        is_archived: false,
        task_order: (task.task_order || 0) + 1
      })
      .select()
      .single();

    if (insertError) {
      return next(insertError);
    }

    // Duplicate notes
    const { data: notes } = await supabase
      .from('task_notes')
      .select('content')
      .eq('task_id', task.id);

    let createdNotes = [];
    if (notes && notes.length > 0) {
      const noteInserts = notes.map((n) => ({
        task_id: newTask.id,
        content: n.content
      }));
      const { data: insertedNotes } = await supabase
        .from('task_notes')
        .insert(noteInserts)
        .select();
      createdNotes = insertedNotes || [];
    }

    await logActivity(
      req.user.id,
      newTask.id,
      newTask.title,
      'duplicated',
      `Duplicated from "${task.title}"`
    );

    res.status(201).json({
      success: true,
      message: 'Task duplicated successfully',
      data: formatTask(newTask, createdNotes)
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete a task
// @route   DELETE /api/tasks/:id
// @access  Private
const deleteTask = async (req, res, next) => {
  try {
    const { data: task, error: findError } = await supabase
      .from('tasks')
      .select('id, title')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (findError || !task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Clean up activities & notifications & notes (or cascade handles it)
    await supabase.from('activities').delete().eq('task_id', task.id);
    await supabase.from('notifications').delete().eq('task_id', task.id);
    await supabase.from('task_notes').delete().eq('task_id', task.id);

    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .eq('id', task.id)
      .eq('user_id', req.user.id);

    if (deleteError) {
      return next(deleteError);
    }

    res.status(200).json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Reorder tasks for Kanban drag-and-drop
// @route   PATCH /api/tasks/reorder
// @access  Private
const reorderTasks = async (req, res, next) => {
  try {
    const { items } = req.body; // array of { id, order, status }

    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'Items array is required'
      });
    }

    for (const item of items) {
      const updates = { task_order: item.order };
      if (item.status) {
        updates.status = item.status;
        if (item.status === 'Completed') {
          updates.completed_at = new Date().toISOString();
        }
      }
      await supabase
        .from('tasks')
        .update(updates)
        .eq('id', item.id)
        .eq('user_id', req.user.id);
    }

    res.status(200).json({
      success: true,
      message: 'Tasks reordered successfully'
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Track time / live stopwatch session
// @route   POST /api/tasks/:id/time
// @access  Private
const trackTime = async (req, res, next) => {
  try {
    const { seconds } = req.body;
    const { data: task, error: findError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (findError || !task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const additionalSeconds = Math.max(0, Number(seconds) || 0);
    const newActualTime = (task.actual_time || 0) + additionalSeconds;

    const { data: updatedTask, error: updateError } = await supabase
      .from('tasks')
      .update({ actual_time: newActualTime })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (updateError) {
      return next(updateError);
    }

    const mins = Math.round(additionalSeconds / 60);
    await logActivity(
      req.user.id,
      task.id,
      task.title,
      'timer_recorded',
      `Logged ${mins > 0 ? `${mins} min(s)` : `${additionalSeconds} sec(s)`} of active work`
    );

    res.status(200).json({
      success: true,
      message: 'Time tracked successfully',
      data: formatTask(updatedTask)
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Record completed Pomodoro session
// @route   POST /api/tasks/:id/pomodoro
// @access  Private
const recordPomodoro = async (req, res, next) => {
  try {
    const { data: task, error: findError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (findError || !task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const newSessions = (task.pomodoro_sessions || 0) + 1;
    const newActualTime = (task.actual_time || 0) + 1500;

    const { data: updatedTask, error: updateError } = await supabase
      .from('tasks')
      .update({
        pomodoro_sessions: newSessions,
        actual_time: newActualTime
      })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (updateError) {
      return next(updateError);
    }

    await logActivity(
      req.user.id,
      task.id,
      task.title,
      'timer_recorded',
      `Completed Pomodoro session #${newSessions} (25 min)`
    );

    res.status(200).json({
      success: true,
      message: 'Pomodoro session recorded successfully',
      data: formatTask(updatedTask)
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add note to task
// @route   POST /api/tasks/:id/notes
// @access  Private
const addNote = async (req, res, next) => {
  try {
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Note content cannot be empty'
      });
    }

    const { data: task, error: findError } = await supabase
      .from('tasks')
      .select('id, title')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (findError || !task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const { data: note, error: insertError } = await supabase
      .from('task_notes')
      .insert({
        task_id: task.id,
        content: content.trim()
      })
      .select()
      .single();

    if (insertError) {
      return next(insertError);
    }

    await logActivity(
      req.user.id,
      task.id,
      task.title,
      'note_added',
      'Added a note to the task'
    );

    res.status(201).json({
      success: true,
      message: 'Note added successfully',
      data: formatNote(note)
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update note in task
// @route   PUT /api/tasks/:id/notes/:noteId
// @access  Private
const updateNote = async (req, res, next) => {
  try {
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Note content cannot be empty'
      });
    }

    const { data: note, error } = await supabase
      .from('task_notes')
      .update({ content: content.trim() })
      .eq('id', req.params.noteId)
      .eq('task_id', req.params.id)
      .select()
      .maybeSingle();

    if (error || !note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Note updated successfully',
      data: formatNote(note)
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete note from task
// @route   DELETE /api/tasks/:id/notes/:noteId
// @access  Private
const deleteNote = async (req, res, next) => {
  try {
    const { data: task } = await supabase
      .from('tasks')
      .select('id, title')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const { error } = await supabase
      .from('task_notes')
      .delete()
      .eq('id', req.params.noteId)
      .eq('task_id', req.params.id);

    if (error) {
      return next(error);
    }

    await logActivity(
      req.user.id,
      task.id,
      task.title,
      'note_deleted',
      'Deleted a note from the task'
    );

    res.status(200).json({
      success: true,
      message: 'Note deleted successfully'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getTasks,
  getTaskStats,
  getTaskById,
  createTask,
  updateTask,
  updateTaskStatus,
  toggleArchive,
  duplicateTask,
  deleteTask,
  reorderTasks,
  trackTime,
  recordPomodoro,
  addNote,
  updateNote,
  deleteNote
};
