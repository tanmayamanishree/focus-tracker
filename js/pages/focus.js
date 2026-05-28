/* ============================================
   pages/focus.js
   Pomodoro + Stopwatch + Immediate list + Stats
   ============================================ */

const FocusPage = (() => {

  // ---------- Timer state (shared between pomodoro & stopwatch) ----------
  let mode = 'pomodoro';            // 'pomodoro' | 'stopwatch'
  let pomoPhase = 'work';           // 'work' | 'break' | 'longBreak'
  let pomoSession = 1;
  let running = false;
  let intervalId = null;

  // Pomodoro: counts DOWN from a duration
  let pomoEndsAt = 0;
  let pomoRemainingMs = 0;          // when paused

  // Stopwatch: counts UP
  let swStartedAt = 0;
  let swElapsedBeforePause = 0;
  let swLaps = [];                  // [{label, durationMs, totalMs}]
  let swLastLapTotal = 0;

  let container = null;
  let keyHandler = null;

  // ---------- Render ----------
  function render(root) {
    container = root;
    container.className = 'page active focus-page';
    container.innerHTML = template();
    bind();
    updateAll();
  }

  function template() {
    return `
      <div class="focus-header">
        <div class="focus-date">${Utils.formatDateLong()}</div>
        <div class="focus-stats-row" id="focus-stats-row"></div>
      </div>

      <div class="current-task">
        <div class="current-task-label">Now Working On</div>
        <input class="current-task-input" id="current-task" placeholder="What are you focused on?" />
      </div>

      <div class="timer-tabs">
        <button class="timer-tab" data-mode="pomodoro">Pomodoro</button>
        <button class="timer-tab" data-mode="stopwatch">Stopwatch</button>
      </div>

      <div class="timer-shell">
        <div class="timer-circle">
          <svg viewBox="0 0 320 320">
            <circle class="timer-track" cx="160" cy="160" r="150" />
            <circle class="timer-progress" id="timer-progress" cx="160" cy="160" r="150"
                    stroke-dasharray="942" stroke-dashoffset="0" />
          </svg>
          <div class="timer-content">
            <div class="timer-mode" id="timer-mode">Focus</div>
            <div class="timer-time" id="timer-time">25:00</div>
            <div class="timer-session" id="timer-session">Session 1 of ${State.getSettings().sessionsBeforeLongBreak}</div>
          </div>
        </div>
      </div>

      <div id="stopwatch-laps" class="stopwatch-laps" style="display:none;"></div>

      <div class="timer-controls" id="timer-controls"></div>

      <div class="kbd-hint">
        <kbd>Space</kbd> start/pause &nbsp;·&nbsp; <kbd>R</kbd> reset &nbsp;·&nbsp; <kbd>L</kbd> lap (stopwatch)
      </div>

      <div class="focus-grid">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">Today's Immediate</div>
            <button class="panel-action" id="add-from-projects">+ from Projects</button>
          </div>
          <div id="immediate-list"></div>
          <input class="add-btn" id="add-immediate-input" placeholder="+ Add task and press Enter" />
        </div>

        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">Focus This Week</div>
            <span class="panel-action">Last 7 days</span>
          </div>
          <div class="stats-graph" id="stats-graph"></div>
          <div class="stats-summary" id="stats-summary"></div>
        </div>
      </div>
    `;
  }

  // ---------- Bind ----------
  function bind() {
    // Mode tabs
    container.querySelectorAll('.timer-tab').forEach(tab => {
      tab.addEventListener('click', () => setMode(tab.dataset.mode));
    });

    // Immediate input
    const input = container.querySelector('#add-immediate-input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim()) {
        State.addImmediate(input.value.trim());
        input.value = '';
      }
    });

    // From projects
    container.querySelector('#add-from-projects').addEventListener('click', openProjectPicker);

    // React to state changes
    State.on('immediate:changed', renderImmediate);
    State.on('focus:logged', updateStats);
    State.on('tasks:changed', renderImmediate);

    // Keyboard shortcuts
    keyHandler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); toggleRun(); }
      else if (e.key === 'r' || e.key === 'R') reset();
      else if ((e.key === 'l' || e.key === 'L') && mode === 'stopwatch') addLap('lap');
    };
    document.addEventListener('keydown', keyHandler);

    setMode('pomodoro');
  }

  function onLeave() {
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
    // Keep timer running in background? We stop the visual interval but
    // for simplicity, we keep state intact. If user navigates back, it resumes.
  }

  // ---------- Mode switching ----------
  function setMode(m) {
    if (running) toggleRun();  // pause before switching
    mode = m;
    container.querySelectorAll('.timer-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.mode === m);
    });
    const laps = container.querySelector('#stopwatch-laps');
    laps.style.display = (m === 'stopwatch') ? 'block' : 'none';

    if (m === 'pomodoro') {
      resetPomodoro();
    } else {
      resetStopwatch();
    }
    renderControls();
    updateDisplay();
  }

  // ---------- Pomodoro ----------
  function startPomodoro() {
    if (pomoRemainingMs <= 0) {
      // Fresh start
      const mins = pomoPhase === 'work'
        ? State.getSettings().pomodoroWork
        : (pomoPhase === 'longBreak' ? State.getSettings().pomodoroLongBreak : State.getSettings().pomodoroBreak);
      pomoRemainingMs = mins * 60 * 1000;
    }
    pomoEndsAt = Date.now() + pomoRemainingMs;
    running = true;
    intervalId = setInterval(tickPomodoro, 250);
    renderControls();
  }

  function tickPomodoro() {
    const remaining = pomoEndsAt - Date.now();
    if (remaining <= 0) {
      completePomodoroPhase();
    } else {
      pomoRemainingMs = remaining;
      updateDisplay();
    }
  }

  function completePomodoroPhase() {
    clearInterval(intervalId);
    running = false;

    if (pomoPhase === 'work') {
      // Log focus session
      const taskTitle = container.querySelector('#current-task').value.trim() || 'Focus session';
      State.logFocusSession(taskTitle, State.getSettings().pomodoroWork * 60 * 1000);

      // Notify
      notify('Pomodoro complete', 'Time for a break.');

      // Move to break
      const isLong = pomoSession % State.getSettings().sessionsBeforeLongBreak === 0;
      pomoPhase = isLong ? 'longBreak' : 'break';
    } else {
      notify('Break over', 'Ready to focus?');
      pomoPhase = 'work';
      pomoSession++;
    }
    pomoRemainingMs = 0;
    updateDisplay();
    renderControls();
  }

  function resetPomodoro() {
    clearInterval(intervalId);
    running = false;
    pomoPhase = 'work';
    pomoSession = 1;
    pomoRemainingMs = 0;
    updateDisplay();
    renderControls();
  }

  function skipPomodoro() {
    if (running) clearInterval(intervalId);
    running = false;
    pomoRemainingMs = 0;
    completePomodoroPhase();
  }

  // ---------- Stopwatch ----------
  function startStopwatch() {
    swStartedAt = Date.now();
    running = true;
    intervalId = setInterval(tickStopwatch, 100);
    renderControls();
  }

  function tickStopwatch() {
    updateDisplay();
  }

  function getStopwatchTotal() {
    if (running) {
      return swElapsedBeforePause + (Date.now() - swStartedAt);
    }
    return swElapsedBeforePause;
  }

  function pauseStopwatch() {
    swElapsedBeforePause += Date.now() - swStartedAt;
    running = false;
    clearInterval(intervalId);
    renderControls();
  }

  function addLap(label) {
    const total = getStopwatchTotal();
    const duration = total - swLastLapTotal;
    swLaps.push({ label, durationMs: duration, totalMs: total });
    swLastLapTotal = total;

    // Log work laps to focus log
    if (label === 'work') {
      const taskTitle = container.querySelector('#current-task').value.trim() || 'Focus session';
      State.logFocusSession(taskTitle, duration);
    }
    renderLaps();
  }

  function resetStopwatch() {
    clearInterval(intervalId);
    running = false;
    swStartedAt = 0;
    swElapsedBeforePause = 0;
    swLaps = [];
    swLastLapTotal = 0;
    renderLaps();
    updateDisplay();
    renderControls();
  }

  // ---------- Shared controls ----------
  function toggleRun() {
    if (mode === 'pomodoro') {
      if (running) {
        pomoRemainingMs = pomoEndsAt - Date.now();
        clearInterval(intervalId);
        running = false;
        renderControls();
      } else {
        startPomodoro();
      }
    } else {
      if (running) pauseStopwatch();
      else startStopwatch();
    }
  }

  function reset() {
    if (mode === 'pomodoro') resetPomodoro();
    else resetStopwatch();
  }

  // ---------- Render parts ----------
  function updateAll() {
    updateDisplay();
    renderControls();
    renderImmediate();
    updateStats();
  }

  function updateDisplay() {
    if (!container) return;
    const timeEl = container.querySelector('#timer-time');
    const modeEl = container.querySelector('#timer-mode');
    const sessionEl = container.querySelector('#timer-session');
    const progressEl = container.querySelector('#timer-progress');

    if (mode === 'pomodoro') {
      const totalMs = (pomoPhase === 'work'
        ? State.getSettings().pomodoroWork
        : (pomoPhase === 'longBreak' ? State.getSettings().pomodoroLongBreak : State.getSettings().pomodoroBreak)
      ) * 60 * 1000;
      const display = pomoRemainingMs > 0 ? pomoRemainingMs : totalMs;
      timeEl.textContent = Utils.formatTime(display);
      modeEl.textContent = pomoPhase === 'work' ? 'Focus' : (pomoPhase === 'longBreak' ? 'Long Break' : 'Break');
      sessionEl.textContent = `Session ${pomoSession} of ${State.getSettings().sessionsBeforeLongBreak}`;

      const pct = (display / totalMs);
      const circumference = 2 * Math.PI * 150;
      progressEl.setAttribute('stroke-dasharray', circumference);
      progressEl.setAttribute('stroke-dashoffset', circumference * (1 - pct));
    } else {
      const ms = getStopwatchTotal();
      timeEl.textContent = Utils.formatTime(ms, true);
      modeEl.textContent = running ? 'Running' : 'Stopwatch';
      sessionEl.textContent = swLaps.length === 0 ? '' : `${swLaps.length} lap${swLaps.length > 1 ? 's' : ''}`;

      // Subtle pulse: fill based on current lap (mod 60s)
      const circumference = 2 * Math.PI * 150;
      const pct = (ms % 60000) / 60000;
      progressEl.setAttribute('stroke-dasharray', circumference);
      progressEl.setAttribute('stroke-dashoffset', circumference * (1 - pct));
    }
  }

  function renderControls() {
    if (!container) return;
    const c = container.querySelector('#timer-controls');
    if (mode === 'pomodoro') {
      c.innerHTML = `
        <button class="btn primary" id="btn-play">${running ? '⏸ Pause' : '▶ Start'}</button>
        <button class="btn" id="btn-skip">Skip</button>
        <button class="btn subtle" id="btn-reset">Reset</button>
      `;
      c.querySelector('#btn-play').onclick = toggleRun;
      c.querySelector('#btn-skip').onclick = skipPomodoro;
      c.querySelector('#btn-reset').onclick = reset;
    } else {
      c.innerHTML = `
        <button class="btn primary" id="btn-play">${running ? '⏸ Pause' : '▶ Start'}</button>
        <button class="btn lap-work" id="btn-lap-work">Work Lap</button>
        <button class="btn lap-break" id="btn-lap-break">Break Lap</button>
        <button class="btn" id="btn-lap">+ Lap</button>
        <button class="btn subtle" id="btn-reset">Reset</button>
      `;
      c.querySelector('#btn-play').onclick = toggleRun;
      c.querySelector('#btn-lap-work').onclick = () => running && addLap('work');
      c.querySelector('#btn-lap-break').onclick = () => running && addLap('break');
      c.querySelector('#btn-lap').onclick = () => running && addLap('lap');
      c.querySelector('#btn-reset').onclick = reset;
    }
  }

  function renderLaps() {
    if (!container) return;
    const el = container.querySelector('#stopwatch-laps');
    if (!swLaps.length) {
      el.innerHTML = `<div style="color: var(--ink-3); font-size: 11px; text-align: center; padding: 8px; font-family: var(--font-mono);">No laps yet — press Work/Break/Lap while running</div>`;
      return;
    }
    el.innerHTML = swLaps.slice().reverse().map((lap, i) => {
      const num = swLaps.length - i;
      return `
        <div class="lap-row">
          <span class="lap-num">#${num}</span>
          <span class="lap-label ${lap.label}">${lap.label}</span>
          <span class="lap-time">${Utils.formatTime(lap.durationMs, true)}</span>
          <span style="color: var(--ink-3); font-size: 10px;">${Utils.formatTime(lap.totalMs, true)}</span>
        </div>
      `;
    }).join('');
  }

  function renderImmediate() {
    if (!container) return;
    const list = container.querySelector('#immediate-list');
    if (!list) return;
    const items = State.get('immediate');
    if (!items.length) {
      list.innerHTML = `<div style="color: var(--ink-3); padding: 12px 0; font-style: italic;">Nothing here yet. Add a task below or pull one from Projects.</div>`;
      return;
    }
    list.innerHTML = items.map(item => {
      const projects = State.get('projects');
      const proj = item.projectId ? projects.find(p => p.id === item.projectId) : null;
      return `
        <div class="task-item ${item.done ? 'done' : ''}" data-id="${item.id}">
          <div class="checkbox" data-toggle="${item.id}"></div>
          <span class="text">${Utils.esc(item.title)}</span>
          ${proj ? `<span class="task-source">${Utils.esc(proj.name)}</span>` : ''}
          <button class="delete-x" data-del="${item.id}" title="Remove">×</button>
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-toggle]').forEach(el => {
      el.parentElement.onclick = (e) => {
        if (e.target.dataset.del) return;
        State.toggleImmediate(el.dataset.toggle);
      };
    });
    list.querySelectorAll('[data-del]').forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        State.removeImmediate(el.dataset.del);
      };
    });
  }

  function updateStats() {
    if (!container) return;
    const row = container.querySelector('#focus-stats-row');
    const todayMs = State.focusMsForDate(Utils.dateKey());
    const sessions = State.sessionsForDate(Utils.dateKey());
    const streak = State.currentStreak();
    row.innerHTML = `
      <span>Today<b>${Utils.formatDuration(todayMs) || '0m'}</b></span>
      <span>Sessions<b>${sessions}</b></span>
      <span>Streak<b>${streak} day${streak === 1 ? '' : 's'}</b></span>
    `;

    // Graph: last 7 days
    const graph = container.querySelector('#stats-graph');
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        date: d,
        key: Utils.dateKey(d),
        ms: State.focusMsForDate(Utils.dateKey(d))
      });
    }
    const maxMs = Math.max(...days.map(d => d.ms), 60 * 60 * 1000); // at least 1h for scale
    const todayKey = Utils.dateKey();
    graph.innerHTML = days.map(d => {
      const h = Math.max(4, (d.ms / maxMs) * 100);
      return `<div class="bar ${d.key === todayKey ? 'today' : ''}" style="height: ${h}%" title="${Utils.formatDuration(d.ms)}"><div class="bar-label">${Utils.shortDay(d.date)}</div></div>`;
    }).join('');

    // Summary
    const total = days.reduce((s, d) => s + d.ms, 0);
    const avg = total / 7;
    const best = days.slice().sort((a, b) => b.ms - a.ms)[0];
    const summary = container.querySelector('#stats-summary');
    summary.innerHTML = `
      <div>Total<br><b>${Utils.formatDuration(total) || '—'}</b></div>
      <div>Avg/day<br><b>${Utils.formatDuration(avg) || '—'}</b></div>
      <div>Best day<br><b>${best.ms > 0 ? Utils.shortDay(best.date) + ' · ' + Utils.formatDuration(best.ms) : '—'}</b></div>
    `;
  }

  // ---------- Project picker modal ----------
  function openProjectPicker() {
    const tasks = State.get('tasks').filter(t => !t.done);
    const projects = State.get('projects');

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h3>Pull from Projects</h3>
        ${tasks.length === 0
          ? `<div style="color: var(--ink-3); font-style: italic; padding: 20px 0;">No open tasks. Add some on the Projects page.</div>`
          : tasks.map(t => {
              const p = projects.find(x => x.id === t.projectId);
              return `
                <div class="picker-item" data-task="${t.id}">
                  <div class="checkbox"></div>
                  <span>${Utils.esc(t.title)}</span>
                  ${p ? `<span class="picker-project">${Utils.esc(p.name)}</span>` : ''}
                </div>
              `;
            }).join('')
        }
        <div style="display:flex; justify-content:flex-end; margin-top: 16px;">
          <button class="btn subtle" id="cancel-picker">Close</button>
        </div>
      </div>
    `;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    overlay.querySelector('#cancel-picker').onclick = () => overlay.remove();
    overlay.querySelectorAll('[data-task]').forEach(el => {
      el.onclick = () => {
        const task = tasks.find(t => t.id === el.dataset.task);
        State.addImmediate(task.title, task.id, task.projectId);
        overlay.remove();
      };
    });
    document.body.appendChild(overlay);
  }

  function notify(title, body) {
    // Try browser notification, otherwise just play a soft beep
    try {
      if (Notification && Notification.permission === 'granted') {
        new Notification(title, { body });
      } else if (Notification && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    } catch (_) {}
    // Soft audio cue
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 660;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (_) {}
  }

  return { render, onLeave };
})();
