/* ============================================
   pages/diary.js
   Weekly diary with auto-log + PDF export
   ============================================ */

const DiaryPage = (() => {

  let viewDate = new Date();
  let container = null;
  let saveTimer = null;

  function render(root) {
    container = root;
    container.className = 'page active diary-page';
    renderAll();
  }

  function renderAll() {
    if (!container) return;
    const weekKey = Utils.weekKey(viewDate);
    const weekNum = weekKey.split('-W')[1];
    const text = State.getDiary(weekKey);
    const completed = getCompletedThisWeek();

    const isThisWeek = Utils.weekKey() === weekKey;

    container.innerHTML = `
      <div class="diary-header">
        <div>
          <div class="diary-title">Week ${weekNum}</div>
          <div class="diary-subtitle">${Utils.formatWeekRange(viewDate)}</div>
        </div>
        <div class="diary-week-nav">
          <button class="week-arrow" id="prev-week" title="Previous week">←</button>
          <span>${isThisWeek ? 'This week' : 'Past week'}</span>
          <button class="week-arrow" id="next-week" title="Next week">→</button>
        </div>
      </div>

      <div class="diary-grid">
        <div>
          <div class="diary-prompts">
            <span class="prompt-chip" data-prompt="Wins">+ Wins</span>
            <span class="prompt-chip" data-prompt="Challenges">+ Challenges</span>
            <span class="prompt-chip" data-prompt="Learnings">+ Learnings</span>
            <span class="prompt-chip" data-prompt="Next week">+ Next week</span>
          </div>

          <textarea class="diary-editor" id="diary-editor" placeholder="What did this week look like? Use the chips above as gentle prompts, or write freely...">${Utils.esc(text)}</textarea>

          <div class="diary-actions">
            <button class="btn subtle" id="export-pdf">Export PDF</button>
            <button class="btn subtle" id="copy-text">Copy text</button>
            <span id="save-indicator" style="color: var(--ink-3); font-family: var(--font-mono); font-size: 11px; align-self: center; margin-right: 8px;"></span>
          </div>
        </div>

        <aside class="completed-panel">
          <h3>Completed this week</h3>
          <div class="hint">Auto-logged from Focus</div>
          ${completed.length === 0
            ? `<div style="color: var(--ink-3); font-style: italic; font-size: 12px;">No focus sessions logged yet this week.</div>`
            : completed.map(c => `
                <div class="completed-task">
                  <span class="day">${Utils.shortDay(new Date(c.timestamp))}</span>
                  ${Utils.esc(c.taskTitle)}<span class="mins">· ${Utils.formatDuration(c.ms)}</span>
                </div>
              `).join('')
          }
          ${completed.length > 0 ? `
            <button class="btn subtle small" id="insert-completed" style="margin-top: 16px; width: 100%;">
              Insert into entry
            </button>
          ` : ''}
        </aside>
      </div>
    `;

    bind();
  }

  function bind() {
    const editor = container.querySelector('#diary-editor');
    const indicator = container.querySelector('#save-indicator');

    // Debounced save
    editor.addEventListener('input', () => {
      indicator.textContent = 'Saving…';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        State.setDiary(Utils.weekKey(viewDate), editor.value);
        indicator.textContent = 'Saved';
        setTimeout(() => indicator.textContent = '', 1200);
      }, 400);
    });

    // Prompt chips: append a heading + newline
    container.querySelectorAll('.prompt-chip').forEach(chip => {
      chip.onclick = () => {
        const label = chip.dataset.prompt;
        const cur = editor.value;
        const sep = cur && !cur.endsWith('\n\n') ? '\n\n' : '';
        editor.value = `${cur}${sep}${label}:\n`;
        editor.focus();
        editor.setSelectionRange(editor.value.length, editor.value.length);
        editor.dispatchEvent(new Event('input'));
      };
    });

    // Week navigation
    container.querySelector('#prev-week').onclick = () => {
      const d = new Date(viewDate);
      d.setDate(d.getDate() - 7);
      viewDate = d;
      renderAll();
    };
    container.querySelector('#next-week').onclick = () => {
      const d = new Date(viewDate);
      d.setDate(d.getDate() + 7);
      viewDate = d;
      renderAll();
    };

    // Insert completed list
    const insertBtn = container.querySelector('#insert-completed');
    if (insertBtn) {
      insertBtn.onclick = () => {
        const completed = getCompletedThisWeek();
        const lines = completed.map(c =>
          `• ${c.taskTitle} (${Utils.shortDay(new Date(c.timestamp))}, ${Utils.formatDuration(c.ms)})`
        ).join('\n');
        const cur = editor.value;
        const sep = cur && !cur.endsWith('\n\n') ? '\n\n' : '';
        editor.value = `${cur}${sep}Completed this week:\n${lines}`;
        editor.dispatchEvent(new Event('input'));
      };
    }

    // Export
    container.querySelector('#export-pdf').onclick = exportPDF;
    container.querySelector('#copy-text').onclick = () => {
      const completed = getCompletedThisWeek();
      const completedList = completed.map(c =>
        `• ${c.taskTitle} (${Utils.shortDay(new Date(c.timestamp))}, ${Utils.formatDuration(c.ms)})`
      ).join('\n');
      const fullText = [
        `Week ${Utils.weekKey(viewDate).split('-W')[1]} · ${Utils.formatWeekRange(viewDate)}`,
        '',
        editor.value || '(no entry)',
        '',
        '--- Completed this week ---',
        completedList || '(none)'
      ].join('\n');
      navigator.clipboard.writeText(fullText).then(() => {
        const ind = container.querySelector('#save-indicator');
        ind.textContent = 'Copied!';
        setTimeout(() => ind.textContent = '', 1500);
      });
    };
  }

  function getCompletedThisWeek() {
    const focusLog = State.focusLogForWeek(viewDate);
    // Sort newest first
    return focusLog.slice().sort((a, b) => b.timestamp - a.timestamp);
  }

  function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    const weekKey = Utils.weekKey(viewDate);
    const weekNum = weekKey.split('-W')[1];
    const text = State.getDiary(weekKey) || '';
    const completed = getCompletedThisWeek();

    const margin = 56;
    const pageWidth = doc.internal.pageSize.getWidth();
    const usableWidth = pageWidth - margin * 2;
    let y = margin;

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text(`Week ${weekNum}`, margin, y);
    y += 26;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(120);
    doc.text(Utils.formatWeekRange(viewDate), margin, y);
    y += 28;

    // Body
    doc.setTextColor(20);
    doc.setFontSize(11);
    const bodyLines = doc.splitTextToSize(text || '(no entry)', usableWidth);
    bodyLines.forEach(line => {
      if (y > 760) { doc.addPage(); y = margin; }
      doc.text(line, margin, y);
      y += 16;
    });

    // Completed section
    y += 16;
    if (y > 720) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Completed this week', margin, y);
    y += 18;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    if (completed.length === 0) {
      doc.setTextColor(150);
      doc.text('(none)', margin, y);
    } else {
      completed.forEach(c => {
        if (y > 760) { doc.addPage(); y = margin; }
        const line = `• ${c.taskTitle}  (${Utils.shortDay(new Date(c.timestamp))}, ${Utils.formatDuration(c.ms)})`;
        const wrapped = doc.splitTextToSize(line, usableWidth);
        wrapped.forEach(w => {
          if (y > 760) { doc.addPage(); y = margin; }
          doc.text(w, margin, y);
          y += 14;
        });
      });
    }

    doc.save(`notebook-week-${weekNum}.pdf`);
  }

  return { render };
})();
