# Notebook

A personal professional notebook — Focus, Projects, and Weekly Diary in one place.

Plain HTML, CSS, JavaScript. No build step. No dependencies to install.

## Run it

Just open `index.html` in a browser. That's it.

For GitHub Pages: push to a repo, enable Pages in settings, point at the root. Done.

For a local dev server (recommended for development so the browser doesn't complain about `file://`):

```bash
# Python
python3 -m http.server 8000

# Or Node
npx serve .
```

Then visit `http://localhost:8000`.

## Features

**Focus page** — Pomodoro timer (work/break cycles) and Stopwatch (with labeled Work/Break/custom laps), an immediate task list, daily stats graph for the last 7 days. Keyboard shortcuts: `Space` start/pause, `R` reset, `L` lap (stopwatch).

**Projects page** — Three-pane: Projects → Tasks → Detail (subtasks + free-form notes). "Focus on this" button sends a task to the Focus page's immediate list.

**Weekly Diary** — Free-form weekly entry with optional prompts (Wins / Challenges / Learnings / Next week). Auto-pulls focus-logged tasks into a sidebar so you can reference what you actually shipped. Export to PDF or copy as text. Browse past weeks with the arrows.

All data is stored locally in your browser (localStorage). Nothing is sent anywhere.

## Project structure

```
notebook/
├── index.html              App shell, sidebar, page containers
├── css/
│   ├── theme.css           Design tokens (colors, fonts, spacing) — restyle here
│   ├── layout.css          App shell, sidebar, page layouts
│   └── components.css      Buttons, panels, timer, tasks, etc.
├── js/
│   ├── utils.js            Date/time/formatting helpers
│   ├── storage.js          localStorage wrapper — swap for a real backend later
│   ├── state.js            Central state + pub/sub
│   ├── router.js           Page switching
│   ├── pages/
│   │   ├── focus.js        Pomodoro, stopwatch, immediate list, stats
│   │   ├── projects.js     Projects/tasks/subtasks/notes
│   │   └── diary.js        Weekly diary + PDF export
│   └── app.js              Boot
└── README.md
```

## Adding a fourth page (e.g. Habits, Goals, Knowledge Base)

1. Create `js/pages/habits.js` following the pattern of the existing pages — expose a module with a `render(container)` function (and optional `onEnter` / `onLeave`).
2. Add a `<script src="js/pages/habits.js"></script>` line in `index.html` (after the other page scripts).
3. Add a nav item in `index.html`:
   ```html
   <div class="nav-item" data-page="habits">
     <svg>...</svg>
     <span>Habits</span>
   </div>
   ```
4. Add a container: `<main class="page" id="page-habits"></main>`.
5. Register in `js/app.js`: `Router.register('habits', HabitsPage);`.

That's it. The sidebar, routing, theme, and storage all work without further changes.

## Adding new state (e.g. habits data)

In `js/state.js`:
1. Add to `_data` defaults.
2. Add loader in `init()`.
3. Add getter/mutator methods that call `Storage.set` and `this.emit('habits:changed')`.

Other pages can subscribe via `State.on('habits:changed', ...)`.

## Restyling

Edit `css/theme.css`. The CSS variables there control colors, fonts, spacing, and radii across the whole app. The default is a warm-amber-on-charcoal dark theme.

Want a light mode toggle? Add a `.light-mode` class to `<body>` and override the variables under that selector — every component picks it up automatically.

## Moving off localStorage

When you outgrow localStorage (multi-device sync, backup, etc.) edit `js/storage.js`. The `get` / `set` / `remove` methods are the only place storage is touched. Swap the localStorage calls for `fetch` calls to your backend and you're done — no page code needs to change.

## License

Personal use. Build whatever you want with it.
