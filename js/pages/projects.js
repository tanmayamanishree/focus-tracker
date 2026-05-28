/* ============================================
   pages/projects.js
   Three-pane: Projects | Tasks | Detail (subtasks + notes)
   ============================================ */

const ProjectsPage = (() => {

  let activeProjectId = null;
  let activeTaskId = null;
  let container = null;
  let notesSaveTimer = null;

  const COLORS = ['#d4a574', '#7fa67f', '#7c9fc4', '#c47c9f', '#c4a87c', '#9f7cc4'];

  function render(root) {
    container = root;
    container.className = 'page active projects-page';

    // Default selection
    const projects = State.get('projects');
    if (!activeProjectId && projects.length) activeProjectId = projects[0].id;
    if (activeProjectId) {
      const tasks = State.tasksForProject(activeProjectId);
      if (!activeTaskId && tasks.length) activeTaskId = tasks[0].id;
    }

    container.innerHTML = `
      <div class="col" id="col-projects"></div>
      <div class="col" id="col-tasks"></div>
      <div class="col" id="col-detail"></div>
    `;
    renderAll();

    State.on('projects:changed', renderAll);
    State.on('tasks:changed', renderAll);
  }

  function renderAll() {
    if (!container) return;
    renderProjects();
    renderTasks();
    renderDetail();
  }

  // ---------- Column 1: Projects ----------
  function renderProjects() {
    const col = container.querySelector('#col-projects');
    const projects = State.get('projects');
    col.innerHTML = `
      <div class="col-title">Projects</div>
      <div class="col-subtitle">${projects.length} project${projects.length === 1 ? '' : 's'}</div>
      <div id="project-list"></div>
      <button class="add-btn" id="add-project">+ New Project</button>
    `;
    const list = col.querySelector('#project-list');
    list.innerHTML = projects.map(p => {
      const count = State.tasksForProject(p.id).filter(t => !t.done).length;
      return `
        <div class="project-item ${p.id === activeProjectId ? 'active' : ''}" data-id="${p.id}">
          <div class="project-dot" style="background: ${p.color}"></div>
          <span>${Utils.esc(p.name)}</span>
          <span class="task-count">${count}</span>
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-id]').forEach(el => {
      el.onclick = () => {
        activeProjectId = el.dataset.id;
        const tasks = State.tasksForProject(activeProjectId);
        activeTaskId = tasks.length ? tasks[0].id : null;
        renderAll();
      };
    });

    col.querySelector('#add-project').onclick = () => {
      promptInline('New project name', '', (name) => {
        if (!name) return;
        const color = COLORS[State.get('projects').length % COLORS.length];
        const p = State.addProject(name, color);
        activeProjectId = p.id;
        activeTaskId = null;
      });
    };
  }

  // ---------- Column 2: Tasks ----------
  function renderTasks() {
    const col = container.querySelector('#col-tasks');
    const projects = State.get('projects');
    const project = projects.find(p => p.id === activeProjectId);

    if (!project) {
      col.innerHTML = `<div class="empty-state">Select or create a project</div>`;
      return;
    }

    const tasks = State.tasksForProject(project.id);
    const open = tasks.filter(t => !t.done).length;

    col.innerHTML = `
      <div class="col-title">${Utils.esc(project.name)}</div>
      <div class="col-subtitle">${tasks.length} task${tasks.length === 1 ? '' : 's'} · ${open} open</div>
      <div id="task-list"></div>
      <button class="add-btn" id="add-task">+ Add Task</button>
      <button class="btn subtle danger small" style="margin-top: 24px; width: 100%;" id="delete-project">Delete project</button>
    `;

    const list = col.querySelector('#task-list');
    list.innerHTML = tasks.map(t => `
      <div class="task-list-item ${t.id === activeTaskId ? 'active' : ''} ${t.done ? 'done' : ''}" data-id="${t.id}">
        <div class="checkbox" data-toggle="${t.id}"></div>
        <span class="text">${Utils.esc(t.title)}</span>
      </div>
    `).join('');

    list.querySelectorAll('.task-list-item').forEach(el => {
      el.onclick = (e) => {
        if (e.target.dataset.toggle) {
          State.toggleTaskDone(e.target.dataset.toggle);
          return;
        }
        activeTaskId = el.dataset.id;
        renderAll();
      };
    });

    col.querySelector('#add-task').onclick = () => {
      promptInline('New task title', '', (title) => {
        if (!title) return;
        const t = State.addTask(activeProjectId, title);
        activeTaskId = t.id;
      });
    };

    col.querySelector('#delete-project').onclick = () => {
      if (confirm(`Delete "${project.name}" and all its tasks?`)) {
        State.deleteProject(project.id);
        activeProjectId = State.get('projects')[0]?.id || null;
        activeTaskId = null;
      }
    };
  }

  // ---------- Column 3: Detail ----------
  function renderDetail() {
    const col = container.querySelector('#col-detail');
    const task = State.get('tasks').find(t => t.id === activeTaskId);
    const project = task ? State.get('projects').find(p => p.id === task.projectId) : null;

    if (!task) {
      col.innerHTML = `<div class="empty-state">Select a task to see details</div>`;
      return;
    }

    col.innerHTML = `
      <div class="task-detail-header">
        <div class="task-meta">${Utils.esc(project.name)} · ${task.done ? 'Completed' : 'Task'}</div>
        <input class="task-detail-title" id="task-title" value="${Utils.esc(task.title)}" />
        <div class="task-detail-actions">
          <button class="btn small" id="focus-on">→ Focus on this</button>
          <button class="btn small subtle" id="toggle-done">${task.done ? 'Mark open' : 'Mark complete'}</button>
          <button class="btn small subtle danger" id="delete-task">Delete</button>
        </div>
      </div>

      <div class="section-label">Subtasks</div>
      <div id="subtasks"></div>
      <input class="add-btn" id="add-subtask-input" placeholder="+ Add subtask and press Enter" />

      <div class="section-label">Notes</div>
      <textarea class="notes-area" id="notes" placeholder="Capture thoughts, links, decisions...">${Utils.esc(task.notes || '')}</textarea>
    `;

    // Title editing
    const titleEl = col.querySelector('#task-title');
    titleEl.addEventListener('blur', () => {
      const val = titleEl.value.trim();
      if (val && val !== task.title) State.updateTask(task.id, { title: val });
    });
    titleEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') titleEl.blur();
    });

    // Actions
    col.querySelector('#focus-on').onclick = () => {
      State.addImmediate(task.title, task.id, task.projectId);
      Router.go('focus');
    };
    col.querySelector('#toggle-done').onclick = () => State.toggleTaskDone(task.id);
    col.querySelector('#delete-task').onclick = () => {
      if (confirm(`Delete "${task.title}"?`)) {
        State.deleteTask(task.id);
        const remaining = State.tasksForProject(activeProjectId);
        activeTaskId = remaining[0]?.id || null;
      }
    };

    // Subtasks
    renderSubtasks(task);

    const subInput = col.querySelector('#add-subtask-input');
    subInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && subInput.value.trim()) {
        State.addSubtask(task.id, subInput.value.trim());
        subInput.value = '';
      }
    });

    // Notes — debounced save
    const notes = col.querySelector('#notes');
    notes.addEventListener('input', () => {
      clearTimeout(notesSaveTimer);
      notesSaveTimer = setTimeout(() => {
        State.updateTask(task.id, { notes: notes.value });
      }, 400);
    });
  }

  function renderSubtasks(task) {
    const wrap = container.querySelector('#subtasks');
    if (!wrap) return;
    if (!task.subtasks.length) {
      wrap.innerHTML = `<div style="color: var(--ink-3); font-style: italic; padding: 6px 0; font-size: 12px;">No subtasks yet.</div>`;
      return;
    }
    wrap.innerHTML = task.subtasks.map(s => `
      <div class="subtask ${s.done ? 'done' : ''}" data-id="${s.id}">
        <div class="checkbox" data-toggle="${s.id}"></div>
        <span class="text">${Utils.esc(s.title)}</span>
        <button class="delete-x" data-del="${s.id}">×</button>
      </div>
    `).join('');

    wrap.querySelectorAll('[data-toggle]').forEach(el => {
      el.onclick = () => State.toggleSubtask(task.id, el.dataset.toggle);
    });
    wrap.querySelectorAll('[data-del]').forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        State.deleteSubtask(task.id, el.dataset.del);
      };
    });
  }

  // ---------- Inline prompt helper ----------
  function promptInline(label, initial, callback) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width: 380px;">
        <h3>${Utils.esc(label)}</h3>
        <input class="inline-input" id="prompt-input" value="${Utils.esc(initial)}" />
        <div style="display:flex; gap: 8px; justify-content:flex-end; margin-top: 16px;">
          <button class="btn subtle" id="prompt-cancel">Cancel</button>
          <button class="btn primary" id="prompt-ok">Create</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('#prompt-input');
    input.focus();
    input.select();

    const submit = () => {
      const val = input.value.trim();
      overlay.remove();
      callback(val);
    };
    overlay.querySelector('#prompt-ok').onclick = submit;
    overlay.querySelector('#prompt-cancel').onclick = () => overlay.remove();
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
      if (e.key === 'Escape') overlay.remove();
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  return { render };
})();
