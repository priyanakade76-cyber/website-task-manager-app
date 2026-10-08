/**
 * Centralized API Client with JWT Auth & Session Handling
 */
const API_BASE = '/api';

const API = {
  // Token Management
  getToken() {
    return localStorage.getItem('taskmanager_token');
  },
  setToken(token) {
    localStorage.setItem('taskmanager_token', token);
  },
  getUser() {
    const u = localStorage.getItem('taskmanager_user');
    return u ? JSON.parse(u) : null;
  },
  setUser(user) {
    localStorage.setItem('taskmanager_user', JSON.stringify(user));
  },
  clearSession() {
    localStorage.removeItem('taskmanager_token');
    localStorage.removeItem('taskmanager_user');
  },
  isAuthenticated() {
    return !!this.getToken();
  },

  // Base Request Method
  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      method: options.method || 'GET',
      headers,
      ...options
    };

    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, config);
      const contentType = response.headers.get('content-type') || '';
      let data;

      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        const cleanMessage = text.replace(/<[^>]*>/g, '').trim().slice(0, 150);
        if (!response.ok) {
          throw new Error(cleanMessage || `Server returned error ${response.status}`);
        }
        data = { success: true, message: cleanMessage };
      }

      if (!response.ok) {
        if (response.status === 401) {
          this.clearSession();
          if (!window.location.pathname.includes('login') && !window.location.pathname.includes('register') && window.location.pathname !== '/') {
            window.location.href = '/login.html';
          }
        }
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  },

  // Authentication APIs
  auth: {
    async login(email, password) {
      const res = await API.request('/auth/login', {
        method: 'POST',
        body: { email, password }
      });
      if (res.success && res.data.token) {
        API.setToken(res.data.token);
        API.setUser(res.data.user);
      }
      return res;
    },
    async register(name, email, password, profileImage) {
      const res = await API.request('/auth/register', {
        method: 'POST',
        body: { name, email, password, profileImage }
      });
      if (res.success && res.data.token) {
        API.setToken(res.data.token);
        API.setUser(res.data.user);
      }
      return res;
    },
    async logout() {
      try {
        await API.request('/auth/logout', { method: 'POST' });
      } catch (e) {
        // Ignore network errors on logout
      } finally {
        API.clearSession();
        window.location.href = '/login.html';
      }
    },
    async getMe() {
      const res = await API.request('/auth/me');
      if (res.success && res.data) {
        API.setUser(res.data);
      }
      return res;
    },
    async updateProfile(profileData) {
      const res = await API.request('/auth/profile', {
        method: 'PUT',
        body: profileData
      });
      if (res.success && res.data) {
        API.setUser(res.data);
      }
      return res;
    },
    async changePassword(currentPassword, newPassword) {
      return await API.request('/auth/change-password', {
        method: 'PUT',
        body: { currentPassword, newPassword }
      });
    }
  },

  // Tasks APIs
  tasks: {
    async getAll(params = {}) {
      const query = new URLSearchParams();
      Object.keys(params).forEach((key) => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
          query.append(key, params[key]);
        }
      });
      const qs = query.toString() ? `?${query.toString()}` : '';
      return await API.request(`/tasks${qs}`);
    },
    async getStats() {
      return await API.request('/tasks/stats');
    },
    async getById(id) {
      return await API.request(`/tasks/${id}`);
    },
    async create(taskData) {
      return await API.request('/tasks', {
        method: 'POST',
        body: taskData
      });
    },
    async update(id, taskData) {
      return await API.request(`/tasks/${id}`, {
        method: 'PUT',
        body: taskData
      });
    },
    async updateStatus(id, status) {
      return await API.request(`/tasks/${id}/status`, {
        method: 'PATCH',
        body: { status }
      });
    },
    async toggleArchive(id) {
      return await API.request(`/tasks/${id}/archive`, {
        method: 'PATCH'
      });
    },
    async duplicate(id) {
      return await API.request(`/tasks/${id}/duplicate`, {
        method: 'POST'
      });
    },
    async delete(id) {
      return await API.request(`/tasks/${id}`, {
        method: 'DELETE'
      });
    },
    async reorder(items) {
      return await API.request('/tasks/reorder', {
        method: 'PATCH',
        body: { items }
      });
    },
    async logTime(id, seconds) {
      return await API.request(`/tasks/${id}/time`, {
        method: 'POST',
        body: { seconds }
      });
    },
    async recordPomodoro(id) {
      return await API.request(`/tasks/${id}/pomodoro`, {
        method: 'POST'
      });
    },
    async addNote(id, content) {
      return await API.request(`/tasks/${id}/notes`, {
        method: 'POST',
        body: { content }
      });
    },
    async updateNote(id, noteId, content) {
      return await API.request(`/tasks/${id}/notes/${noteId}`, {
        method: 'PUT',
        body: { content }
      });
    },
    async deleteNote(id, noteId) {
      return await API.request(`/tasks/${id}/notes/${noteId}`, {
        method: 'DELETE'
      });
    }
  },

  // Categories APIs
  categories: {
    async getAll() {
      return await API.request('/categories');
    },
    async create(data) {
      return await API.request('/categories', {
        method: 'POST',
        body: data
      });
    },
    async update(id, data) {
      return await API.request(`/categories/${id}`, {
        method: 'PUT',
        body: data
      });
    },
    async delete(id) {
      return await API.request(`/categories/${id}`, {
        method: 'DELETE'
      });
    }
  },

  // Notifications APIs
  notifications: {
    async getAll() {
      return await API.request('/notifications');
    },
    async markAsRead(id) {
      return await API.request(`/notifications/${id}/read`, {
        method: 'PATCH'
      });
    },
    async markAllAsRead() {
      return await API.request('/notifications/read-all', {
        method: 'PATCH'
      });
    },
    async delete(id) {
      return await API.request(`/notifications/${id}`, {
        method: 'DELETE'
      });
    },
    async clearAll() {
      return await API.request('/notifications', {
        method: 'DELETE'
      });
    },
    async checkDue() {
      return await API.request('/notifications/check-due', {
        method: 'POST'
      });
    }
  }
};
