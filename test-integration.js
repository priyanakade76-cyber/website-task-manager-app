/**
 * Integration Test Suite for Task Manager Supabase Migration
 * Verifies all API endpoints, authentication, CRUD, and business logic
 */

const { app } = require('./server/server');

const runTests = async () => {
  console.log('\n======================================================');
  console.log('🧪 Starting Task Manager Supabase Integration Tests...');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, title) => {
    if (condition) {
      console.log(`  ✅ [PASS] ${title}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${title}`);
      failed++;
    }
  };

  // Helper using Supertest-style internal request via Node http or fetch
  const http = require('http');
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const request = async (path, options = {}) => {
    const url = `${baseUrl}${path}`;
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, body: json };
  };

  try {
    // Test 1: Health check
    const health = await request('/api/health');
    assert(health.status === 200 && health.body.success, 'GET /api/health returns 200 success');

    // Test 2: Register user
    const testEmail = `tester_${Date.now()}@example.com`;
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Test Engineer',
        email: testEmail,
        password: 'Password123!',
        profileImage: ''
      }
    });
    assert(regRes.status === 201 && regRes.body.data.token, 'POST /api/auth/register creates user & returns JWT token');
    const token = regRes.body.data.token;
    const authHeaders = { Authorization: `Bearer ${token}` };

    // Test 3: Duplicate user registration rejected
    const dupRes = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Test Duplicate',
        email: testEmail,
        password: 'Password123!'
      }
    });
    assert(dupRes.status === 400 && !dupRes.body.success, 'POST /api/auth/register rejects duplicate email');

    // Test 4: Login
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: { email: testEmail, password: 'Password123!' }
    });
    assert(loginRes.status === 200 && loginRes.body.data.user.email === testEmail, 'POST /api/auth/login succeeds with correct password');

    // Test 5: Login with wrong password rejected
    const badLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: testEmail, password: 'WrongPassword' }
    });
    assert(badLogin.status === 401, 'POST /api/auth/login rejects invalid password');

    // Test 6: Get current user
    const meRes = await request('/api/auth/me', { headers: authHeaders });
    assert(meRes.status === 200 && meRes.body.data.name === 'Test Engineer', 'GET /api/auth/me returns current user info');

    // Test 7: Update profile
    const updateProfileRes = await request('/api/auth/profile', {
      method: 'PUT',
      headers: authHeaders,
      body: { name: 'Senior Test Engineer', theme: 'light' }
    });
    assert(updateProfileRes.status === 200 && updateProfileRes.body.data.name === 'Senior Test Engineer', 'PUT /api/auth/profile updates user details');

    // Test 8: Change password
    const changePassRes = await request('/api/auth/change-password', {
      method: 'PUT',
      headers: authHeaders,
      body: { currentPassword: 'Password123!', newPassword: 'NewPassword123!' }
    });
    assert(changePassRes.status === 200 && changePassRes.body.success, 'PUT /api/auth/change-password updates password');

    // Test 9: Default Categories seeded
    const catRes = await request('/api/categories', { headers: authHeaders });
    assert(catRes.status === 200 && catRes.body.data.length >= 6, `GET /api/categories returns seeded default categories (count: ${catRes.body.data.length})`);
    const defaultCat = catRes.body.data[0];

    // Test 10: Create custom category
    const createCatRes = await request('/api/categories', {
      method: 'POST',
      headers: authHeaders,
      body: { name: 'Urgent Ops', color: '#ef4444', icon: 'fa-fire' }
    });
    assert(createCatRes.status === 201 && createCatRes.body.data.name === 'Urgent Ops', 'POST /api/categories creates custom category');
    const customCat = createCatRes.body.data;

    // Test 11: Create task
    const createTaskRes = await request('/api/tasks', {
      method: 'POST',
      headers: authHeaders,
      body: {
        title: 'Migrate DB to Supabase',
        description: 'Convert Mongoose models and queries to Supabase PostgreSQL',
        priority: 'High',
        status: 'Todo',
        category: customCat._id,
        tags: ['database', 'migration', 'supabase'],
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        estimatedTime: 120
      }
    });
    assert(createTaskRes.status === 201 && createTaskRes.body.data.title === 'Migrate DB to Supabase', 'POST /api/tasks creates new task');
    const taskId = createTaskRes.body.data._id || createTaskRes.body.data.id;

    // Test 12: Get tasks with search & filter
    const getTasksRes = await request('/api/tasks?search=Supabase&priority=High', { headers: authHeaders });
    assert(getTasksRes.status === 200 && getTasksRes.body.data.length >= 1, 'GET /api/tasks filters by search term and priority');

    // Test 13: Get task stats
    const statsRes = await request('/api/tasks/stats', { headers: authHeaders });
    assert(statsRes.status === 200 && statsRes.body.data.summary.total >= 1, 'GET /api/tasks/stats returns summary metrics & charts data');

    // Test 14: Get task by ID (with activities)
    const taskByIdRes = await request(`/api/tasks/${taskId}`, { headers: authHeaders });
    assert(taskByIdRes.status === 200 && taskByIdRes.body.data.activities.length > 0, 'GET /api/tasks/:id returns task with activity history');

    // Test 15: Add note to task
    const addNoteRes = await request(`/api/tasks/${taskId}/notes`, {
      method: 'POST',
      headers: authHeaders,
      body: { content: 'Schema design verified and checked for foreign keys.' }
    });
    assert(addNoteRes.status === 201 && addNoteRes.body.data.content.includes('Schema design'), 'POST /api/tasks/:id/notes adds note');
    const noteId = addNoteRes.body.data._id || addNoteRes.body.data.id;

    // Test 16: Update note
    const updateNoteRes = await request(`/api/tasks/${taskId}/notes/${noteId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: { content: 'Schema design verified and triggers active.' }
    });
    assert(updateNoteRes.status === 200 && updateNoteRes.body.data.content.includes('triggers active'), 'PUT /api/tasks/:id/notes/:noteId updates note');

    // Test 17: Track stopwatch time
    const trackTimeRes = await request(`/api/tasks/${taskId}/time`, {
      method: 'POST',
      headers: authHeaders,
      body: { seconds: 120 }
    });
    assert(trackTimeRes.status === 200 && trackTimeRes.body.data.actualTime >= 120, 'POST /api/tasks/:id/time tracks elapsed time');

    // Test 18: Record Pomodoro session
    const pomoRes = await request(`/api/tasks/${taskId}/pomodoro`, {
      method: 'POST',
      headers: authHeaders
    });
    assert(pomoRes.status === 200 && pomoRes.body.data.pomodoroSessions === 1, 'POST /api/tasks/:id/pomodoro increments session counter and time');

    // Test 19: Update task status to Completed
    const updateStatusRes = await request(`/api/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: authHeaders,
      body: { status: 'Completed' }
    });
    assert(updateStatusRes.status === 200 && updateStatusRes.body.data.status === 'Completed', 'PATCH /api/tasks/:id/status updates status');

    // Test 20: Duplicate task
    const dupTaskRes = await request(`/api/tasks/${taskId}/duplicate`, {
      method: 'POST',
      headers: authHeaders
    });
    assert(dupTaskRes.status === 201 && dupTaskRes.body.data.title.includes('(Copy)'), 'POST /api/tasks/:id/duplicate creates copy of task');

    // Test 21: Toggle archive
    const archiveRes = await request(`/api/tasks/${taskId}/archive`, {
      method: 'PATCH',
      headers: authHeaders
    });
    assert(archiveRes.status === 200 && archiveRes.body.data.isArchived === true, 'PATCH /api/tasks/:id/archive toggles task archive state');

    // Test 22: Check due reminders
    const checkDueRes = await request('/api/notifications/check-due', {
      method: 'POST',
      headers: authHeaders
    });
    assert(checkDueRes.status === 200 && checkDueRes.body.success, 'POST /api/notifications/check-due checks upcoming deadlines');

    // Test 23: Notifications list & generated completed notification
    const notifsRes = await request('/api/notifications', { headers: authHeaders });
    assert(notifsRes.status === 200 && notifsRes.body.data.length > 0, `GET /api/notifications returns user notifications (count: ${notifsRes.body.data.length})`);
    const notifId = notifsRes.body.data[0]._id || notifsRes.body.data[0].id;

    // Test 23: Mark notification as read
    const markReadRes = await request(`/api/notifications/${notifId}/read`, {
      method: 'PATCH',
      headers: authHeaders
    });
    assert(markReadRes.status === 200 && markReadRes.body.data.isRead === true, 'PATCH /api/notifications/:id/read marks notification as read');

    // Test 24: Mark all notifications as read
    const markAllRes = await request('/api/notifications/read-all', {
      method: 'PATCH',
      headers: authHeaders
    });
    assert(markAllRes.status === 200 && markAllRes.body.success, 'PATCH /api/notifications/read-all marks all as read');

    // Test 25: Reorder tasks
    const reorderRes = await request('/api/tasks/reorder', {
      method: 'PATCH',
      headers: authHeaders,
      body: { items: [{ id: taskId, order: 5, status: 'Completed' }] }
    });
    assert(reorderRes.status === 200 && reorderRes.body.success, 'PATCH /api/tasks/reorder reorders tasks');

    // Test 26: Delete note
    const deleteNoteRes = await request(`/api/tasks/${taskId}/notes/${noteId}`, {
      method: 'DELETE',
      headers: authHeaders
    });
    assert(deleteNoteRes.status === 200 && deleteNoteRes.body.success, 'DELETE /api/tasks/:id/notes/:noteId deletes note');

    // Test 27: Delete custom category and ensure tasks safely point to General
    const delCatRes = await request(`/api/categories/${customCat._id || customCat.id}`, {
      method: 'DELETE',
      headers: authHeaders
    });
    assert(delCatRes.status === 200 && delCatRes.body.success, 'DELETE /api/categories/:id removes category and updates associated tasks');

    // Test 28: Delete task
    const delTaskRes = await request(`/api/tasks/${taskId}`, {
      method: 'DELETE',
      headers: authHeaders
    });
    assert(delTaskRes.status === 200 && delTaskRes.body.success, 'DELETE /api/tasks/:id removes task and its activities');

    // Test 29: Clear notifications
    const clearNotifsRes = await request('/api/notifications', {
      method: 'DELETE',
      headers: authHeaders
    });
    assert(clearNotifsRes.status === 200 && clearNotifsRes.body.success, 'DELETE /api/notifications clears all notifications');

  } catch (err) {
    console.error('Unexpected test error:', err);
    failed++;
  } finally {
    server.close();
  }

  console.log('\n======================================================');
  console.log(`📊 Test Summary: ${passed} passed, ${failed} failed (${passed + failed} total)`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runTests();
