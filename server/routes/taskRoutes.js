const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/taskController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/stats', getTaskStats);
router.patch('/reorder', reorderTasks);

router.route('/')
  .get(getTasks)
  .post(createTask);

router.route('/:id')
  .get(getTaskById)
  .put(updateTask)
  .delete(deleteTask);

router.patch('/:id/status', updateTaskStatus);
router.patch('/:id/archive', toggleArchive);
router.post('/:id/duplicate', duplicateTask);
router.post('/:id/time', trackTime);
router.post('/:id/pomodoro', recordPomodoro);

router.post('/:id/notes', addNote);
router.route('/:id/notes/:noteId')
  .put(updateNote)
  .delete(deleteNote);

module.exports = router;
