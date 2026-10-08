const { supabase } = require('../config/supabase');
const { formatNotification } = require('../utils/formatters');

// @desc    Get all notifications for user
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res, next) => {
  try {
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return next(error);
    }

    const { count: unreadCount, error: countError } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false);

    if (countError) {
      return next(countError);
    }

    const formattedList = (notifications || []).map(formatNotification);

    res.status(200).json({
      success: true,
      unreadCount: unreadCount || 0,
      count: formattedList.length,
      data: formattedList
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Mark single notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res, next) => {
  try {
    const { data: notification, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .maybeSingle();

    if (error || !notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: formatNotification(notification)
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Mark all notifications as read
// @route   PATCH /api/notifications/read-all
// @access  Private
const markAllAsRead = async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false);

    if (error) {
      return next(error);
    }

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = async (req, res, next) => {
  try {
    const { data: notification } = await supabase
      .from('notifications')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) {
      return next(error);
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Clear all notifications
// @route   DELETE /api/notifications
// @access  Private
const clearAll = async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', req.user.id);

    if (error) {
      return next(error);
    }

    res.status(200).json({
      success: true,
      message: 'All notifications cleared'
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Check tasks for upcoming deadlines and overdue status
// @route   POST /api/notifications/check-due
// @access  Private
const checkDueReminders = async (req, res, next) => {
  try {
    const now = new Date();
    const { data: allTasks, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', req.user.id)
      .neq('status', 'Completed')
      .eq('is_archived', false);

    if (taskError) {
      return next(taskError);
    }

    const tasks = (allTasks || []).filter((t) => t.due_date);
    const newNotifications = [];

    for (const task of tasks) {
      const due = new Date(task.due_date);
      const diffMinutes = Math.round((due.getTime() - now.getTime()) / (1000 * 60));

      // Overdue check
      if (diffMinutes < 0) {
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const { data: alreadyNotified } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', req.user.id)
          .eq('task_id', task.id)
          .eq('type', 'overdue')
          .gte('created_at', dayAgo.toISOString())
          .maybeSingle();

        if (!alreadyNotified) {
          const { data: doc } = await supabase
            .from('notifications')
            .insert({
              user_id: req.user.id,
              task_id: task.id,
              title: 'Task Overdue',
              message: `"${task.title}" was due on ${due.toLocaleDateString()}. Please take action!`,
              type: 'overdue'
            })
            .select()
            .single();

          if (doc) newNotifications.push(formatNotification(doc));
        }
      }
      // Due soon check
      else if (diffMinutes <= (task.reminder_time || 60) && diffMinutes >= 0) {
        const halfDayAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
        const { data: alreadyNotified } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', req.user.id)
          .eq('task_id', task.id)
          .eq('type', 'due_soon')
          .gte('created_at', halfDayAgo.toISOString())
          .maybeSingle();

        if (!alreadyNotified) {
          const { data: doc } = await supabase
            .from('notifications')
            .insert({
              user_id: req.user.id,
              task_id: task.id,
              title: 'Task Due Soon',
              message: `"${task.title}" is due in approximately ${diffMinutes} minutes!`,
              type: 'due_soon'
            })
            .select()
            .single();

          if (doc) newNotifications.push(formatNotification(doc));
        }
      }
    }

    res.status(200).json({
      success: true,
      generatedCount: newNotifications.length,
      data: newNotifications
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAll,
  checkDueReminders
};
