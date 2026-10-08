# TaskFlow - Modern Task & Productivity Platform

A responsive, portfolio-level **Full-Stack Task Management & Productivity Web Application** built with **HTML5, CSS3, Vanilla JavaScript, Node.js, Express.js, and MongoDB with Mongoose**.

Featuring a sleek SaaS aesthetic with dual themes (Dark/Light), interactive drag-and-drop Kanban boards, live task stopwatches, Pomodoro focus timer, deep Chart.js productivity analytics, recurring task automation, and JWT authentication.

---

## 🌟 Key Features

### 1. 🔐 User Authentication & Security
- **JWT-Based Authentication** with HTTP Authorization header handling.
- **Bcrypt Password Hashing** (10 salt rounds), never storing plain-text passwords.
- **Protected Routes** on frontend and backend API endpoints.
- **Rate Limiting** via `express-rate-limit` to prevent brute force attacks.
- **Strict Data Isolation**: Users can only read, update, and manage their own tasks, categories, and notifications.
- **One-Click Demo Account**: Test and demo the platform instantly without manual registration.

### 2. 📋 Comprehensive Task Management
- **Full CRUD**: Create, view, edit, duplicate, archive, restore, and delete tasks.
- **Rich Task Attributes**:
  - Title, description, status (`Todo`, `In Progress`, `Completed`, `Archived`).
  - Priority levels (`Low`, `Medium`, `High`, `Urgent`) with color badges.
  - Custom categories with custom color indicators.
  - Due dates and times with overdue/due today highlights.
  - Estimated time vs. actual time spent.
  - Multi-tag support (`#javascript`, `#urgent`).
  - Sub-notes management (create, view, delete notes).
  - Activity audit timeline (task created, priority changed, moved, completed).
- **Recurring Tasks Automation**: Automatically generates the next occurrence (`Daily`, `Weekly`, `Monthly`, `Custom interval`) upon task completion.

### 3. 📊 Productivity Dashboard & Chart.js Analytics
- **8 Metric Cards**: Total tasks, Completed, Pending, In Progress, Overdue, Due Today, High-Priority, and Completion Percentage progress bar.
- **Productivity Summary**: Dynamic weekly achievement summary (*"You completed 12 tasks this week"*).
- **Interactive Chart.js Visualizations**:
  - **Daily Completions**: Smooth gradient area chart of tasks finished over the last 7 days.
  - **Weekly Performance**: Bar chart tracking completion counts across the last 4 weeks.
  - **Tasks by Priority**: Doughnut breakdown by priority level.
  - **Tasks by Category**: Horizontal bar chart comparing category distributions.
  - **Status Distribution**: Doughnut chart comparing Completed vs In Progress vs Todo.

### 4. 🗂️ Drag-and-Drop Kanban Board
- Seamlessly switch between **List View** and **Kanban Board**.
- Fluid HTML5 drag-and-drop between columns (`Todo`, `In Progress`, `Completed`).
- Instant automatic status synchronization with MongoDB on drop.

### 5. ⏱️ Integrated Productivity Tools
- **Pomodoro Timer**:
  - 25-minute focus work session, 5-minute short break, 15-minute long break.
  - Link Pomodoro session directly to an active task.
  - Tracks total completed Pomodoro sessions.
  - Pleasant Web Audio API synthesized audio chime when timer completes.
- **Live Task Stopwatch**:
  - Start and stop active work timers directly on task cards.
  - Live ticking timer updates `actualTime` in the database upon stopping.

### 6. 📅 Interactive Calendar View
- Monthly and Weekly calendar layouts.
- Day cells displaying scheduled tasks color-coded by category and priority.
- Quick navigation (Previous, Today, Next).
- Click any date to schedule a new task.
- Click any task pill to open its details modal.

### 7. 🔔 In-App Alerts & Reminders
- Notifications panel for:
  - Task Due Soon (configured reminder offsets).
  - Task Overdue alerts.
  - Task Completed affirmations.
  - Auto-generated recurring task announcements.
- Web Notification API integration for desktop notifications.
- Unread badge counter, mark as read, and clear all controls.

### 8. 🎨 Design & Accessibility
- Clean SaaS design system with CSS custom properties.
- **Dark and Light Theme Modes** with persistent preference in `localStorage` and User profile.
- Fully responsive across desktop, laptop, tablet, and mobile screens.
- Mobile off-canvas navigation drawer with backdrop blur.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | HTML5, CSS3 (Vanilla), JavaScript (ES6+), Font Awesome 6, Chart.js 4.4 |
| **Backend** | Node.js, Express.js 5 |
| **Database** | MongoDB with Mongoose ODM |
| **Database Fallback** | `mongodb-memory-server` (automatic in-memory fallback for zero-configuration startup) |
| **Authentication** | JSON Web Tokens (`jsonwebtoken`), Bcrypt (`bcryptjs`) |
| **Security & Middleware**| CORS, `express-rate-limit`, Custom Error Handling, JWT Auth Guard |

---

## 📁 Project Structure

```
task-manager/
├── public/
│   ├── index.html              # Landing showcase page
│   ├── login.html              # Sign in with One-Click demo login
│   ├── register.html           # User registration
│   ├── dashboard.html          # Main dashboard & analytics
│   ├── tasks.html              # Tasks list & Kanban board
│   ├── calendar.html           # Monthly/Weekly interactive calendar
│   ├── profile.html            # Profile, theme, avatar, password settings
│   ├── css/
│   │   ├── style.css           # Core design system & CSS variables
│   │   ├── dashboard.css       # Dashboard metrics & charts
│   │   ├── tasks.css           # Task cards, Kanban, stopwatch
│   │   └── responsive.css      # Mobile breakpoints & drawer
│   └── js/
│       ├── api.js              # Centralized REST client with JWT handling
│       ├── auth.js             # Session verification & theme state
│       ├── dashboard.js        # Chart.js graphs & Pomodoro timer
│       ├── tasks.js            # Kanban drag-and-drop & task actions
│       ├── calendar.js         # Interactive calendar renderer
│       ├── notifications.js    # In-app toasts & audio chimes
│       └── profile.js          # Profile forms & password updater
│
├── server/
│   ├── server.js               # Express application entry point
│   ├── config/
│   │   └── db.js               # MongoDB connection with memory-server fallback
│   ├── models/
│   │   ├── User.js             # User model with bcrypt & JWT methods
│   │   ├── Task.js             # Task model with indexing & sub-notes
│   │   ├── Category.js         # Custom category schema
│   │   ├── Notification.js     # Alert notifications schema
│   │   └── Activity.js         # Activity history timeline schema
│   ├── routes/
│   │   ├── authRoutes.js       # Auth endpoints
│   │   ├── taskRoutes.js       # Task CRUD, stats, time, reorder endpoints
│   │   ├── categoryRoutes.js   # Category management endpoints
│   │   └── notificationRoutes.js # Notification & reminder check endpoints
│   ├── controllers/
│   │   ├── authController.js   # Auth business logic
│   │   ├── taskController.js   # Task logic, stats aggregation, recurring engine
│   │   ├── categoryController.js # Category operations
│   │   └── notificationController.js # Notifications and due check
│   ├── middleware/
│   │   ├── auth.js             # JWT bearer verification middleware
│   │   └── errorHandler.js     # Centralized error handler
│   └── utils/
│       └── seedCategories.js   # Auto-seeds default categories for new users
│
├── .env.example                # Example environment variables
├── .env                        # Local environment configuration
├── package.json                # Project dependencies and npm scripts
└── README.md                   # Complete documentation
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18.0.0 or higher recommended)
- **npm** (v9.0.0 or higher)
- **MongoDB** *(Optional)*: If local MongoDB is running, it connects automatically. If not found, the app automatically initializes an embedded in-memory MongoDB instance!

### Installation

1. Clone or navigate to the project directory:
   ```bash
   cd "C:\Users\ENET30\TASK MANAGER"
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Setup environment variables:
   Copy `.env.example` to `.env` if not already present:
   ```bash
   PORT=5000
   MONGODB_URI=mongodb://127.0.0.1:27017/taskmanager
   JWT_SECRET=supersecretjwtkey_taskmanager_prod_2026_secured
   JWT_EXPIRES_IN=7d
   NODE_ENV=development
   ```

4. Start the application:
   ```bash
   npm run dev
   # or
   npm start
   ```

5. Open your browser and navigate to:
   ```
   http://localhost:5000
   ```

---

## 📡 REST API Reference

All protected endpoints require an `Authorization: Bearer <JWT_TOKEN>` header.

### Authentication Endpoints (`/api/auth`)
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register new user | Public |
| `POST` | `/api/auth/login` | Login user and receive token | Public |
| `POST` | `/api/auth/logout` | Invalidate session | Private |
| `GET` | `/api/auth/me` | Get current user profile | Private |
| `PUT` | `/api/auth/profile` | Update profile info, avatar, theme | Private |
| `PUT` | `/api/auth/change-password` | Update account password | Private |

### Task Endpoints (`/api/tasks`)
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/tasks` | Get tasks with search, filter, and sort | Private |
| `POST` | `/api/tasks` | Create a new task | Private |
| `GET` | `/api/tasks/stats` | Aggregated analytics & Chart.js data | Private |
| `GET` | `/api/tasks/:id` | Get task by ID with sub-notes and activity | Private |
| `PUT` | `/api/tasks/:id` | Update task details | Private |
| `DELETE` | `/api/tasks/:id` | Delete task | Private |
| `PATCH` | `/api/tasks/:id/status` | Update status (handles recurring tasks) | Private |
| `PATCH` | `/api/tasks/:id/archive` | Toggle archive status | Private |
| `POST` | `/api/tasks/:id/duplicate`| Clone existing task | Private |
| `PATCH` | `/api/tasks/reorder` | Bulk reorder tasks for Kanban | Private |
| `POST` | `/api/tasks/:id/time` | Log stopwatch elapsed time | Private |
| `POST` | `/api/tasks/:id/pomodoro`| Record completed Pomodoro session | Private |
| `POST` | `/api/tasks/:id/notes` | Add sub-note to task | Private |
| `DELETE`| `/api/tasks/:id/notes/:noteId` | Delete sub-note | Private |

### Category Endpoints (`/api/categories`)
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/categories` | List user categories with task counts | Private |
| `POST` | `/api/categories` | Create custom category | Private |
| `PUT` | `/api/categories/:id` | Update category name and color | Private |
| `DELETE`| `/api/categories/:id` | Delete category and unassign tasks | Private |

### Notification Endpoints (`/api/notifications`)
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/notifications` | List user notifications & unread count | Private |
| `PATCH` | `/api/notifications/:id/read` | Mark single notification as read | Private |
| `PATCH` | `/api/notifications/read-all` | Mark all notifications as read | Private |
| `DELETE`| `/api/notifications/:id` | Delete notification | Private |
| `DELETE`| `/api/notifications` | Clear all notifications | Private |
| `POST` | `/api/notifications/check-due` | Trigger reminder and overdue checks | Private |

---

## 🔒 Security Best Practices Implemented
- **Password Hashing**: Bcrypt with salt generation before database save.
- **Token Verification**: Cryptographic JWT signature check on every protected endpoint.
- **Strict User Isolation**: All MongoDB queries are scoped to `req.user.id`.
- **Input Sanitization**: MongoDB injection protection and XSS escaping on rendered data.
- **Rate Limiting**: Throttles brute force requests against `/api/auth`.
- **Environment Isolation**: Secrets stored in `.env` and kept out of version control.

---

## 💡 Future Enhancements
- Export / Import tasks to CSV and JSON formats.
- Offline sync using IndexedDB with Progressive Web App (PWA) manifest and Service Worker.
- Team collaboration and task sharing with role-based permissions.
- Webhooks and third-party integrations (Slack, Google Calendar).

---

## 📄 License
This project is licensed under the ISC License.
