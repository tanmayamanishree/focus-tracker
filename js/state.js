/* ============================================
   state.js — central state + pub/sub
   ============================================ */

const State = {
  // ----- In-memory cache -----
  _data: {
    projects: [],          // [{id, name, color, description}]
    tasks: [],             // [{id, projectId, title, notes, done, subtasks:[{id,title,done}], completedAt}]
    immediate: [],         // [{id, title, taskId?, projectId?, done}]  — Focus page list
    focusLog: [],          // [{date, taskTitle, taskId?, projectId?, ms}]
    diary: {},             // { 'YYYY-Www': 'text' }
    settings: {
      pomodoroWork: 25,
      pomodoroBreak: 5,
      pomodoroLongBreak: 15,
      sessionsBeforeLongBreak: 4
    }
  },

  // ----- Subscribers -----
  _subs: {},

  // Load everything from storage on boot
  init() {
    this._data.projects   = Storage.get('projects', this._seedProjects());
    this._data.tasks      = Storage.get('tasks', this._seedTasks());
    this._data.immediate  = Storage.get('immediate', []);
    this._data.focusLog   = Storage.get('focusLog', []);
    this._data.diary      = Storage.get('diary', {});
    this._data.settings   = { ...this._data.settings, ...Storage.get('settings', {}) };

    // Persist seeds on first run
    Storage.set('projects', this._data.projects);
    Storage.set('tasks', this._data.tasks);
  },

  // ----- Pub/sub -----
  on(event, callback) {
    (this._subs[event] = this._subs[event] || []).push(callback);
  },
  emit(event, payload) {
    (this._subs[event] || []).forEach(cb => cb(payload));
  },

  // ----- Getters -----
  get(key) { return this._data[key]; },
  getSettings() { return this._data.settings; },

  // ----- Projects -----
  addProject(name, color = '#d4a574') {
    const p = { id: Utils.uid(), name, color, description: '' };
    this._data.projects.push(p);
    Storage.set('projects', this._data.projects);
    this.emit('projects:changed');
    return p;
  },
  updateProject(id, patch) {
    const p = this._data.projects.find(x => x.id === id);
    if (!p) return;
    Object.assign(p, patch);
    Storage.set('projects', this._data.projects);
    this.emit('projects:changed');
  },
  deleteProject(id) {
    this._data.projects = this._data.projects.filter(p => p.id !== id);
    this._data.tasks    = this._data.tasks.filter(t => t.projectId !== id);
    Storage.set('projects', this._data.projects);
    Storage.set('tasks', this._data.tasks);
    this.emit('projects:changed');
    this.emit('tasks:changed');
  },

  // ----- Tasks -----
  addTask(projectId, title) {
    const t = {
      id: Utils.uid(),
      projectId,
      title,
      notes: '',
      done: false,
      subtasks: [],
      completedAt: null,
      createdAt: Date.now()
    };
    this._data.tasks.push(t);
    Storage.set('tasks', this._data.tasks);
    this.emit('tasks:changed');
    return t;
  },
  updateTask(id, patch) {
    const t = this._data.tasks.find(x => x.id === id);
    if (!t) return;
    Object.assign(t, patch);
    Storage.set('tasks', this._data.tasks);
    this.emit('tasks:changed');
  },
  toggleTaskDone(id) {
    const t = this._data.tasks.find(x => x.id === id);
    if (!t) return;
    t.done = !t.done;
    t.completedAt = t.done ? Date.now() : null;
    Storage.set('tasks', this._data.tasks);
    this.emit('tasks:changed');
  },
  deleteTask(id) {
    this._data.tasks = this._data.tasks.filter(t => t.id !== id);
    this._data.immediate = this._data.immediate.filter(i => i.taskId !== id);
    Storage.set('tasks', this._data.tasks);
    Storage.set('immediate', this._data.immediate);
    this.emit('tasks:changed');
    this.emit('immediate:changed');
  },
  tasksForProject(projectId) {
    return this._data.tasks.filter(t => t.projectId === projectId);
  },

  // ----- Subtasks -----
  addSubtask(taskId, title) {
    const t = this._data.tasks.find(x => x.id === taskId);
    if (!t) return;
    t.subtasks.push({ id: Utils.uid(), title, done: false });
    Storage.set('tasks', this._data.tasks);
    this.emit('tasks:changed');
  },
  toggleSubtask(taskId, subtaskId) {
    const t = this._data.tasks.find(x => x.id === taskId);
    if (!t) return;
    const s = t.subtasks.find(x => x.id === subtaskId);
    if (!s) return;
    s.done = !s.done;
    Storage.set('tasks', this._data.tasks);
    this.emit('tasks:changed');
  },
  deleteSubtask(taskId, subtaskId) {
    const t = this._data.tasks.find(x => x.id === taskId);
    if (!t) return;
    t.subtasks = t.subtasks.filter(s => s.id !== subtaskId);
    Storage.set('tasks', this._data.tasks);
    this.emit('tasks:changed');
  },

  // ----- Immediate list (Focus page) -----
  addImmediate(title, taskId = null, projectId = null) {
    const item = { id: Utils.uid(), title, taskId, projectId, done: false };
    this._data.immediate.push(item);
    Storage.set('immediate', this._data.immediate);
    this.emit('immediate:changed');
    return item;
  },
  toggleImmediate(id) {
    const i = this._data.immediate.find(x => x.id === id);
    if (!i) return;
    i.done = !i.done;
    // If linked to a project task, also toggle it there
    if (i.taskId) {
      const t = this._data.tasks.find(x => x.id === i.taskId);
      if (t) {
        t.done = i.done;
        t.completedAt = i.done ? Date.now() : null;
        Storage.set('tasks', this._data.tasks);
        this.emit('tasks:changed');
      }
    }
    Storage.set('immediate', this._data.immediate);
    this.emit('immediate:changed');
  },
  removeImmediate(id) {
    this._data.immediate = this._data.immediate.filter(x => x.id !== id);
    Storage.set('immediate', this._data.immediate);
    this.emit('immediate:changed');
  },

  // ----- Focus log -----
  logFocusSession(taskTitle, ms, taskId = null, projectId = null) {
    const entry = {
      date: Utils.dateKey(),
      timestamp: Date.now(),
      taskTitle,
      taskId,
      projectId,
      ms
    };
    this._data.focusLog.push(entry);
    Storage.set('focusLog', this._data.focusLog);
    this.emit('focus:logged', entry);
  },

  // Total focus ms for a given date string
  focusMsForDate(dateKey) {
    return this._data.focusLog
      .filter(e => e.date === dateKey)
      .reduce((sum, e) => sum + e.ms, 0);
  },

  // Sessions count for date
  sessionsForDate(dateKey) {
    return this._data.focusLog.filter(e => e.date === dateKey).length;
  },

  // Streak in days
  currentStreak() {
    let streak = 0;
    const day = new Date();
    while (true) {
      const key = Utils.dateKey(day);
      if (this.focusMsForDate(key) > 0) {
        streak++;
        day.setDate(day.getDate() - 1);
      } else {
        // If today has nothing, don't break the streak yet
        if (streak === 0 && Utils.dateKey() === key) {
          day.setDate(day.getDate() - 1);
          continue;
        }
        break;
      }
      if (streak > 365) break;
    }
    return streak;
  },

  // Focus log entries within a week
  focusLogForWeek(date = new Date()) {
    const { start, end } = Utils.weekRange(date);
    return this._data.focusLog.filter(e => {
      const t = e.timestamp;
      return t >= start.getTime() && t <= end.getTime();
    });
  },

  // ----- Diary -----
  getDiary(weekKey) {
    return this._data.diary[weekKey] || '';
  },
  setDiary(weekKey, text) {
    this._data.diary[weekKey] = text;
    Storage.set('diary', this._data.diary);
    this.emit('diary:changed');
  },

  // ----- Settings -----
  updateSettings(patch) {
    this._data.settings = { ...this._data.settings, ...patch };
    Storage.set('settings', this._data.settings);
    this.emit('settings:changed');
  },

  // ----- Seed data for first run -----
  _seedProjects() {
    return [
      { id: 'demo-1', name: 'Getting Started', color: '#d4a574', description: 'Welcome to your notebook' }
    ];
  },
  _seedTasks() {
    return [
      {
        id: 'demo-t1',
        projectId: 'demo-1',
        title: 'Try the Pomodoro timer',
        notes: 'Head to the Focus page and press Space to start a 25-minute session.\n\nYou can switch to Stopwatch mode if you want to track time freely instead.',
        done: false,
        subtasks: [
          { id: 'demo-s1', title: 'Press Space to start', done: false },
          { id: 'demo-s2', title: 'Try the Stopwatch tab', done: false }
        ],
        completedAt: null,
        createdAt: Date.now()
      },
      {
        id: 'demo-t2',
        projectId: 'demo-1',
        title: 'Create your first real project',
        notes: 'Replace this demo project with something you\'re actually working on.',
        done: false,
        subtasks: [],
        completedAt: null,
        createdAt: Date.now()
      }
    ];
  }
};
