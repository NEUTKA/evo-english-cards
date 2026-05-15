(function () {
  if (window.__evoStudentDashboardCardsInit) return;
  window.__evoStudentDashboardCardsInit = true;

  const ROOT_ID = 'student-dashboard-cards-app';

  const state = {
    started: false,
    userId: null,
    student: null,
    teachersById: new Map(),
    assignments: [],
    activeAssignmentId: null,
    cards: [],
    progressByCardId: new Map(),
    filtered: [],
    queue: [],
    baseIds: [],
    known: new Set(),
    idx: 0,
    flipped: false,
    term: '',
    filterStarred: false,
    hasCelebrated: false,
    flash: null,
    mode: 'learn',
    actionBusy: false,
    suppressRealtimeUntil: 0
  };

  let scRealtimeChannel = null;
let scRealtimeTimer = null;
let scRealtimeBusy = false;

function clearStudentCardsRealtime() {
  if (scRealtimeTimer) {
    window.clearTimeout(scRealtimeTimer);
    scRealtimeTimer = null;
  }

  if (scRealtimeChannel && window.supabase?.removeChannel) {
    window.supabase.removeChannel(scRealtimeChannel);
  }

  scRealtimeChannel = null;
}

function getRealtimeRow(payload) {
  if (payload?.new && Object.keys(payload.new).length) return payload.new;
  if (payload?.old && Object.keys(payload.old).length) return payload.old;
  return null;
}

function studentHasModule(moduleId) {
  return !!moduleId && state.assignments.some((a) => a.module_id === moduleId);
}

function studentHasAssignment(assignmentId) {
  return !!assignmentId && state.assignments.some((a) => a.id === assignmentId);
}

function scheduleStudentCardsRealtimeRefresh(reason) {
  if (scRealtimeTimer) window.clearTimeout(scRealtimeTimer);

  scRealtimeTimer = window.setTimeout(async () => {
    if (Date.now() < state.suppressRealtimeUntil && (reason === 'classroom_vocab_card_progress' || reason === 'classroom_vocab_assignments')) {
      return;
    }

    if (scRealtimeBusy) return;
    scRealtimeBusy = true;

    const previousSession = {
      assignmentId: state.activeAssignmentId,
      mode: state.mode,
      term: state.term,
      filterStarred: state.filterStarred,
      known: new Set(state.known || []),
      baseIds: Array.isArray(state.baseIds) ? state.baseIds.slice() : [],
      queueIds: Array.isArray(state.queue) ? state.queue.map((card) => card?.id).filter(Boolean) : [],
      idx: state.idx,
      flipped: state.flipped,
      hasCelebrated: state.hasCelebrated
    };

    try {
      await reloadAll();

      // Realtime updates from Supabase are useful for fresh DB data,
      // but they must not restart the student's current practice session.
      // Without this guard, the completion card can disappear right after the last answer.
      if (previousSession.assignmentId && previousSession.assignmentId === state.activeAssignmentId) {
        state.term = previousSession.term;
        state.filterStarred = previousSession.filterStarred;

        const cardsById = new Map((state.cards || []).map((card) => [card.id, card]));
        const restoredQueue = previousSession.queueIds
          .map((id) => cardsById.get(id))
          .filter(Boolean);
        const restoredBaseIds = previousSession.baseIds.filter((id) => cardsById.has(id));
        const restoredKnown = [...previousSession.known].filter((id) => cardsById.has(id));

        if (restoredQueue.length) state.queue = restoredQueue;
        if (restoredBaseIds.length) state.baseIds = restoredBaseIds;
        state.known = new Set(restoredKnown);
        saveSessionKnown();
        state.idx = Math.min(previousSession.idx, Math.max(0, state.queue.length - 1));
        state.flipped = previousSession.flipped;
        state.hasCelebrated = previousSession.hasCelebrated;
      }

      renderApp();
    } catch (err) {
      console.error('[student-cards] realtime refresh error:', reason, err);
    } finally {
      scRealtimeBusy = false;
    }
  }, 450);
}

function initStudentCardsRealtime() {
  const supabase = window.supabase;
  if (!supabase || !state.userId) return;

  clearStudentCardsRealtime();

  scRealtimeChannel = supabase
    .channel(`student-cards-${state.userId}`)

    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'classroom_vocab_assignments',
        filter: `student_id=eq.${state.userId}`
      },
      () => {
        scheduleStudentCardsRealtimeRefresh('classroom_vocab_assignments');
      }
    )

    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'classroom_vocab_card_progress',
        filter: `student_id=eq.${state.userId}`
      },
      () => {
        scheduleStudentCardsRealtimeRefresh('classroom_vocab_card_progress');
      }
    )

    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'classroom_vocab_cards'
      },
      (payload) => {
        const row = getRealtimeRow(payload);
        if (row?.module_id && studentHasModule(row.module_id)) {
          scheduleStudentCardsRealtimeRefresh('classroom_vocab_cards');
        }
      }
    )

    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'classroom_vocab_modules'
      },
      (payload) => {
        const row = getRealtimeRow(payload);
        if (row?.id && studentHasModule(row.id)) {
          scheduleStudentCardsRealtimeRefresh('classroom_vocab_modules');
        }
      }
    )

    .subscribe((status) => {
      console.log('[student-cards] realtime status:', status);
    });
}

  function rootEl() {
    return document.getElementById(ROOT_ID);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, function (m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[m];
    });
  }

  function when(cond, cb, tries = 100, delay = 150) {
    const t = setInterval(() => {
      if (cond()) {
        clearInterval(t);
        cb();
      } else if (--tries <= 0) {
        clearInterval(t);
      }
    }, delay);
  }

  function formatDateTime(value) {
    if (!value) return 'No date';
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return 'No date';
      return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'No date';
    }
  }

  function statusLabel(status) {
    if (status === 'completed') return 'Completed';
    if (status === 'in_progress') return 'In progress';
    return 'Not started';
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function rememberButton(button) {
    return { text: button?.textContent || '' };
  }

  function paintButton(button, tone, text) {
    if (!button) return;
    button.classList.remove('is-busy', 'is-success', 'is-error');
    if (tone) button.classList.add(`is-${tone}`);
    if (text != null) button.textContent = text;
  }

  function startButtonFeedback(button, busyText) {
    const original = rememberButton(button);
    if (button) {
      button.disabled = true;
      paintButton(button, 'busy', busyText || original.text);
    }
    return original;
  }

  function finishButtonFeedback(button, original, ok, doneText, delay = 650) {
    if (!button) return Promise.resolve();
    paintButton(button, ok ? 'success' : 'error', doneText || (ok ? 'Done' : 'Failed'));
    return wait(delay).then(() => {
      button.disabled = false;
      button.classList.remove('is-busy', 'is-success', 'is-error');
      button.textContent = original?.text || button.textContent;
    });
  }

  function showMiniStatus(message, type = 'success') {
    const root = rootEl();
    if (!root) return;
    const old = root.querySelector('.sc-mini-status');
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = `sc-mini-status ${type === 'error' ? 'sc-error' : 'sc-success'}`;
    el.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:10020;max-width:min(360px,calc(100vw - 32px));box-shadow:0 12px 30px rgba(0,0,0,.18);';
    el.textContent = message;
    document.body.appendChild(el);
    window.setTimeout(() => {
      el.style.transition = 'opacity .25s ease, transform .25s ease';
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      window.setTimeout(() => el.remove(), 280);
    }, 1400);
  }

  function showFlash(type, message) {
    state.flash = { type, message };
    renderApp();
  }

  function injectStyles() {
    if (document.getElementById('student-dashboard-cards-styles')) return;

    const style = document.createElement('style');
    style.id = 'student-dashboard-cards-styles';
    style.textContent = `
      #${ROOT_ID}{max-width:980px;margin:32px auto;padding:0 16px 40px;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#111213}
      #${ROOT_ID} *{box-sizing:border-box}

      .sc-wrap{display:grid;gap:18px}
      .sc-card{background:#fff;border:1px solid #dfe5ec;border-radius:16px;box-shadow:0 10px 24px rgba(0,0,0,.05);overflow:hidden}
      .sc-head{padding:18px 20px;border-bottom:1px solid #eef2f6;background:linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)}
      .sc-kicker{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#4EA9E7;font-weight:700;margin-bottom:6px}
      .sc-title{margin:0;font-size:28px;line-height:1.15}
      .sc-sub{margin-top:8px;color:#667085;font-size:15px}
      .sc-body{padding:18px 20px 20px}
      .sc-meta{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}
      .sc-pill{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:999px;border:1px solid #dbe7f3;background:#f8fbff;color:#0f172a;font-size:14px}

      .sc-grid{display:grid;gap:12px}
      .sc-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .sc-grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}

      .sc-label{display:grid;gap:8px}
      .sc-label span{font-size:14px;font-weight:700;color:#344054}

      .sc-input,.sc-select,.sc-textarea{
        width:100%;
        border:1px solid #d0d5dd;
        border-radius:12px;
        background:#fff;
        color:#111213;
        font:16px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
        padding:12px 14px;
        outline:none
      }
      .sc-input:focus,.sc-select:focus,.sc-textarea:focus{
        border-color:#4EA9E7;
        box-shadow:0 0 0 3px rgba(78,169,231,.18)
      }

      .sc-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
      .sc-btn{
        appearance:none;
        border:none;
        border-radius:12px;
        padding:12px 16px;
        font:700 14px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
        cursor:pointer
      }
      .sc-btn-primary{background:#111213;color:#fff}
      .sc-btn-primary:hover,.sc-link:hover{filter:brightness(1.05)}
      .sc-btn-secondary{background:#f8fbff;color:#175cd3;border:1px solid #dbe7f3}
      .sc-btn-danger{background:#fff2f2;color:#b42318;border:1px solid #fecaca}
      .sc-btn[disabled]{opacity:.65;cursor:not-allowed}
      .sc-btn.is-busy{opacity:.92;cursor:wait}
      .sc-btn.is-success{background:#22c55e !important;border-color:#22c55e !important;color:#fff !important}
      .sc-btn.is-error{background:#ef4444 !important;border-color:#ef4444 !important;color:#fff !important}

      .sc-note{color:#667085;font-size:14px}
      .sc-empty{padding:24px;border:1px dashed #cfd8e3;border-radius:14px;background:#fbfdff;color:#667085;text-align:center}
      .sc-error{padding:16px 18px;border-radius:14px;background:#fff2f2;border:1px solid #fecaca;color:#b42318}
      .sc-success{padding:16px 18px;border-radius:14px;background:#ecfdf3;border:1px solid #b7ebc6;color:#027a48}

      .sc-toolbar{
        display:flex;
        gap:8px;
        align-items:center;
        flex-wrap:wrap;
        padding:12px;
        border:1px solid #e6ebf1;
        border-radius:14px;
        background:#fff
      }
      .sc-toolbar .grow{flex:1}

      .sc-switch{
        display:inline-flex;
        background:#F3F4F6;
        border:1px solid #d0d5dd;
        border-radius:10px;
        overflow:hidden
      }
      .sc-switch button{
        border:none;
        background:transparent;
        padding:8px 12px;
        cursor:pointer;
        font:500 14px system-ui
      }
      .sc-switch button.active{background:#fff}

      .sc-assignment-list{display:grid;gap:10px}
      .sc-assignment-item{
        border:1px solid #e6ebf1;
        border-radius:14px;
        padding:14px 16px;
        background:#fff;
        cursor:pointer
      }
      .sc-assignment-item.active{
        border-color:#4EA9E7;
        box-shadow:0 0 0 3px rgba(78,169,231,.12)
      }
      .sc-assignment-top{
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:12px
      }
      .sc-assignment-title{
        font-size:18px;
        font-weight:700;
        line-height:1.25
      }
      .sc-assignment-desc{
        margin-top:6px;
        color:#475467;
        font-size:14px;
        line-height:1.55;
        white-space:pre-wrap
      }

      .sc-tag{
        display:inline-flex;
        align-items:center;
        padding:7px 10px;
        border-radius:999px;
        background:#f8fbff;
        border:1px solid #dbe7f3;
        color:#0f172a;
        font-size:13px
      }

      .sc-badge{
        display:inline-flex;
        align-items:center;
        padding:6px 10px;
        border-radius:999px;
        font-size:12px;
        font-weight:700;
        white-space:nowrap
      }
      .sc-badge.completed{background:#ecfdf3;border:1px solid #b7ebc6;color:#027a48}
      .sc-badge.not_started{background:#f8fbff;border:1px solid #dbe7f3;color:#175cd3}
      .sc-badge.in_progress{background:#fff7ed;border:1px solid #fed7aa;color:#c2410c}

      .sc-card-stage{width:100%;height:280px;perspective:1000px;outline:none}
      .sc-card-inner{position:relative;width:100%;height:100%;transition:transform .45s;transform-style:preserve-3d}
      .sc-card-inner.is-flipped{transform:rotateY(180deg)}
      .sc-face{
        position:absolute;
        inset:0;
        background:linear-gradient(180deg,#fff,#f9fbff 60%);
        border:1px solid #e8ecf2;
        border-radius:16px;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:28px;
        padding:24px;
        text-align:center;
        backface-visibility:hidden;
        box-shadow:0 12px 24px rgba(0,0,0,.06)
      }
      .sc-back{transform:rotateY(180deg)}

      .sc-under{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:16px;
        margin-top:12px
      }

      .sc-progress{height:8px;background:#eef2f7;border-radius:8px;overflow:hidden}
      .sc-bar{height:100%;width:0;background:#77BEF0;transition:width .25s}

      .sc-table-wrap{overflow:auto}
      .sc-grid-table{width:100%;border-collapse:separate;border-spacing:0}
      .sc-grid-table th,.sc-grid-table td{
        padding:10px 12px;
        border-bottom:1px solid #eef1f5;
        font:14px system-ui;
        vertical-align:middle
      }
      .sc-grid-table th{background:#f8fafc;text-align:left;color:#475569}
      .sc-grid-table tr:last-child td{border-bottom:none}

      .sc-star{
        font-size:18px;
        cursor:pointer;
        user-select:none
      }

      .sc-link{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        text-decoration:none;
        border:none;
        border-radius:12px;
        padding:11px 14px;
        font:700 14px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
        background:#111213;
        color:#fff
      }

      .sc-confetti{position:fixed;inset:0;pointer-events:none;z-index:10000;overflow:hidden}
      .sc-piece{position:absolute;width:8px;height:14px;opacity:.9;animation:sc-fall 1200ms ease-out forwards}
      .sc-complete-card{
        position:relative;
        overflow:hidden;
        border:1px solid #b7ebc6;
        border-radius:18px;
        padding:26px 22px;
        background:radial-gradient(circle at 16% 10%,rgba(119,190,240,.26),transparent 32%),linear-gradient(180deg,#ffffff 0%,#ecfdf3 100%);
        box-shadow:0 16px 34px rgba(17,18,19,.08);
        text-align:center;
      }
      .sc-complete-card:before{
        content:"";
        position:absolute;
        inset:auto -40px -64px auto;
        width:180px;
        height:180px;
        border-radius:999px;
        background:rgba(34,197,94,.12);
      }
      .sc-complete-emoji{
        width:70px;
        height:70px;
        margin:0 auto 12px;
        display:flex;
        align-items:center;
        justify-content:center;
        border-radius:999px;
        background:#111213;
        color:#fff;
        font-size:34px;
        box-shadow:0 12px 28px rgba(17,18,19,.18);
      }
      .sc-complete-title{margin:0;font-size:28px;line-height:1.15;color:#111213}
      .sc-complete-sub{max-width:620px;margin:10px auto 0;color:#475467;font-size:15px;line-height:1.6}
      .sc-complete-stats{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin:18px 0 0}
      .sc-complete-actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:20px}
      @keyframes sc-fall{
        0%{transform:translate3d(var(--x,0),-20px,0) rotate(0deg)}
        100%{transform:translate3d(var(--x-end,0),calc(100vh + 30px),0) rotate(720deg)}
      }

      @media (max-width:760px){
        #${ROOT_ID}{padding:0 12px 28px}
        .sc-head,.sc-body{padding:16px}
        .sc-title{font-size:24px}
        .sc-grid-2,.sc-grid-3{grid-template-columns:1fr}
        .sc-assignment-top,.sc-under{flex-direction:column;align-items:flex-start}
        .sc-toolbar{align-items:stretch}
        .sc-toolbar .grow{display:none}
      }
    `;
    document.head.appendChild(style);
  }

  function setLoading() {
    const root = rootEl();
    if (!root) return;
    root.innerHTML = `<div class="sc-wrap"><div class="sc-card"><div class="sc-head"><div class="sc-kicker">Student cards</div><h1 class="sc-title">Loading cards…</h1><div class="sc-sub">Please wait a moment.</div></div><div class="sc-body"><div class="sc-note">Loading assigned vocabulary modules…</div></div></div></div>`;
  }

  function setError(message) {
    const root = rootEl();
    if (!root) return;
    root.innerHTML = `<div class="sc-wrap"><div class="sc-card"><div class="sc-head"><div class="sc-kicker">Student cards</div><h1 class="sc-title">Something went wrong</h1><div class="sc-sub">The cards tab could not be loaded.</div></div><div class="sc-body"><div class="sc-error">${escapeHtml(message)}</div></div></div></div>`;
  }

  function celebrate() {
    // The completion message is rendered inside the card area.
    // Keep celebrate() only for the visual confetti effect to avoid duplicate congratulations.
    document.querySelectorAll('.sc-toast').forEach((toast) => toast.remove());

    const wrap = document.createElement('div');
    wrap.className = 'sc-confetti';
    document.body.appendChild(wrap);
    const colors = ['#77BEF0', '#22c55e', '#fbbf24', '#60a5fa', '#a78bfa', '#f472b6'];
    const pieces = 140;
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    for (let i = 0; i < pieces; i++) {
      const d = document.createElement('div');
      d.className = 'sc-piece';
      d.style.background = colors[i % colors.length];
      d.style.borderRadius = i % 3 === 0 ? '999px' : '2px';
      const x = Math.random() * vw;
      const offset = (Math.random() * 2 - 1) * 110;
      d.style.left = `${x}px`;
      d.style.setProperty('--x', '0px');
      d.style.setProperty('--x-end', `${offset}px`);
      d.style.animationDelay = `${(Math.random() * 420) | 0}ms`;
      wrap.appendChild(d);
    }
    setTimeout(() => wrap.remove(), 2100);
  }

  function getActiveAssignment() {
    return state.assignments.find((a) => a.id === state.activeAssignmentId) || null;
  }


const SESSION_STORAGE_PREFIX = 'evo-student-cards-session-v2:';

function getSessionStorageKey(assignmentId) {
  return assignmentId ? `${SESSION_STORAGE_PREFIX}${assignmentId}` : null;
}

function getKnownCountForBaseIds() {
  if (!state.baseIds.length || !(state.known instanceof Set)) return 0;
  return state.baseIds.reduce((count, id) => count + (state.known.has(id) ? 1 : 0), 0);
}

function loadSessionKnownForAssignment(assignmentId, allowedIds) {
  const key = getSessionStorageKey(assignmentId);
  const allowed = new Set(allowedIds || []);
  if (!key || !window.sessionStorage) return new Set();

  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(key) || '[]');
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id) => allowed.has(id)));
  } catch (err) {
    console.warn('[student-cards] failed to load session progress:', err);
    return new Set();
  }
}

function saveSessionKnown() {
  const assignment = getActiveAssignment();
  const key = getSessionStorageKey(assignment?.id);
  if (!key || !window.sessionStorage || !(state.known instanceof Set)) return;

  const allowed = new Set(state.baseIds || []);
  const values = [...state.known].filter((id) => allowed.has(id));

  try {
    window.sessionStorage.setItem(key, JSON.stringify(values));
  } catch (err) {
    console.warn('[student-cards] failed to save session progress:', err);
  }
}

function clearSessionKnown(assignmentId) {
  const key = getSessionStorageKey(assignmentId || state.activeAssignmentId);
  if (!key || !window.sessionStorage) return;

  try {
    window.sessionStorage.removeItem(key);
  } catch (err) {
    console.warn('[student-cards] failed to clear session progress:', err);
  }
}

function syncKnownFromProgress() {
  // В student cards saved progress и session progress должны быть раздельны.
  // progressByCardId = что уже сохранено в БД
  // state.known = что выучено в ТЕКУЩЕЙ сессии
  if (!(state.known instanceof Set)) {
    state.known = new Set();
  }
}

  function rebuildQueue(resetView) {
    state.filtered = state.cards.filter((c) => {
      const progress = state.progressByCardId.get(c.id);
      const starred = !!progress?.starred;

      if (state.filterStarred && !starred) return false;

      if (!state.term) return true;

      const term = state.term.toLowerCase();
      return (c.word || '').toLowerCase().includes(term) ||
        (c.translation || '').toLowerCase().includes(term) ||
        (c.example || '').toLowerCase().includes(term) ||
        (c.note || '').toLowerCase().includes(term);
    });

    state.baseIds = [...new Set(state.filtered.map((c) => c.id))];
    state.queue = state.filtered.slice();

    if (resetView) {
      state.idx = 0;
      state.flipped = false;
      state.hasCelebrated = false;
    }
  }

function progressPct() {
  return state.baseIds.length
    ? (getKnownCountForBaseIds() / state.baseIds.length) * 100
    : 0;
}

function isSessionComplete() {
  return state.baseIds.length > 0 && getKnownCountForBaseIds() >= state.baseIds.length;
}

function clearStudentCardsKeydown() {
  if (window.__studentCardsKeydown) {
    document.removeEventListener('keydown', window.__studentCardsKeydown);
    window.__studentCardsKeydown = null;
  }
}

function resetPracticeSession(options = {}) {
  const shouldClearSavedSession = options.clearSavedSession !== false;
  if (shouldClearSavedSession) clearSessionKnown();

  state.known = new Set();
  state.idx = 0;
  state.flipped = false;
  state.hasCelebrated = false;
  state.actionBusy = false;
}

function restartPracticeFromBeginning() {
  state.queue = state.filtered.slice();
  state.baseIds = [...new Set(state.queue.map((card) => card.id))];
  resetPracticeSession({ clearSavedSession: true });
}

function moveToNextCard() {
  state.idx += 1;
  state.flipped = false;

  if (state.idx >= state.queue.length && !isSessionComplete()) {
    const nextUnknown = state.queue.findIndex((card) => !state.known.has(card.id));
    state.idx = nextUnknown >= 0 ? nextUnknown : Math.max(0, state.queue.length - 1);
  }
}

function applyProgressLocally(cardId, patch) {
  const assignment = getActiveAssignment();
  const existing = state.progressByCardId.get(cardId) || null;
  const now = new Date().toISOString();

  state.progressByCardId.set(cardId, {
    id: existing?.id || `local-${cardId}`,
    assignment_id: existing?.assignment_id || assignment?.id || null,
    card_id: cardId,
    student_id: existing?.student_id || state.userId,
    is_known: Object.prototype.hasOwnProperty.call(patch, 'is_known')
      ? !!patch.is_known
      : !!existing?.is_known,
    starred: Object.prototype.hasOwnProperty.call(patch, 'starred')
      ? !!patch.starred
      : !!existing?.starred,
    last_reviewed_at: patch.touch ? now : (existing?.last_reviewed_at || null),
    created_at: existing?.created_at || now,
    updated_at: now
  });

  syncActiveAssignmentLocalProgress();
}

function saveCardProgressInBackground(cardId, patch) {
  state.suppressRealtimeUntil = Date.now() + 1800;

  saveCardProgress(cardId, patch).catch((err) => {
    console.error('[student-cards] background progress save error:', err);
    showMiniStatus('Progress was updated on screen, but it was not synced. Please check your connection.', 'error');
  });
}

function shuffleFilteredCards() {
  const source = state.filtered.slice();
  for (let i = source.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [source[i], source[j]] = [source[j], source[i]];
  }

  state.baseIds = [...new Set(source.map((c) => c.id))];
  state.queue = source;
  resetPracticeSession();
}
  function skipKnownForward() {
    while (state.idx < state.queue.length && state.known.has(state.queue[state.idx].id)) {
      state.idx += 1;
    }
  }

function syncActiveAssignmentLocalProgress() {
  const assignment = getActiveAssignment();
  if (!assignment) return;

  const total = state.cards.length;
  const knownCount = [...state.progressByCardId.values()].filter((p) => !!p.is_known).length;
  const touched = state.progressByCardId.size;

  let status = 'not_started';
  if (total > 0 && knownCount >= total) {
    status = 'completed';
  } else if (touched > 0 || assignment.started_at) {
    status = 'in_progress';
  }

  assignment.progress_percent = total > 0
    ? Number(((knownCount * 100) / total).toFixed(2))
    : 0;

  assignment.status = status;

  if ((status === 'in_progress' || status === 'completed') && !assignment.started_at) {
    assignment.started_at = new Date().toISOString();
  }

  if (status === 'completed' && !assignment.completed_at) {
    assignment.completed_at = new Date().toISOString();
  }

  if (status !== 'completed') {
    assignment.completed_at = null;
  }
}

  async function fetchBase() {
    const supabase = window.supabase;
    if (!supabase) throw new Error('Supabase is not available on this page.');

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    const user = userData?.user;
    if (!user) throw new Error('User session not found.');

    state.userId = user.id;

    const { data: studentProfile, error: studentErr } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', user.id)
      .single();
    if (studentErr) throw studentErr;
if (!['student', 'self_study'].includes(studentProfile.role)) {
  throw new Error('Only learner accounts can access this cards tab.');
}
    const { data: assignmentRows, error: assignmentsErr } = await supabase
      .from('classroom_vocab_assignments')
      .select('id, module_id, teacher_id, student_id, status, progress_percent, assigned_at, started_at, completed_at, last_opened_at, created_at, updated_at')
      .eq('student_id', user.id)
      .order('assigned_at', { ascending: false });
    if (assignmentsErr) throw assignmentsErr;

    const moduleIds = [...new Set((assignmentRows || []).map((r) => r.module_id).filter(Boolean))];
    const teacherIds = [...new Set((assignmentRows || []).map((r) => r.teacher_id).filter(Boolean))];

    let modulesRows = [];
    if (moduleIds.length) {
      const { data, error } = await supabase
        .from('classroom_vocab_modules')
        .select('id, teacher_id, title, description, is_archived, created_at, updated_at')
        .in('id', moduleIds);
      if (error) throw error;
      modulesRows = data || [];
    }

    let teacherProfiles = [];
    if (teacherIds.length) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .in('id', teacherIds);
      if (error) throw error;
      teacherProfiles = data || [];
    }

    const modulesById = new Map(modulesRows.map((m) => [m.id, m]));
    const teachersById = new Map(teacherProfiles.map((t) => [t.id, t]));

    state.student = studentProfile;
    state.teachersById = teachersById;
    state.assignments = (assignmentRows || [])
      .map((a) => ({
        ...a,
        module: modulesById.get(a.module_id) || null,
        teacher: teachersById.get(a.teacher_id) || null
      }))
      .filter((a) => !!a.module);

    if (!state.activeAssignmentId) {
      state.activeAssignmentId = state.assignments[0]?.id || null;
    } else if (!state.assignments.some((a) => a.id === state.activeAssignmentId)) {
      state.activeAssignmentId = state.assignments[0]?.id || null;
    }
  }

  async function touchActiveAssignment() {
    const assignment = getActiveAssignment();
    if (!assignment) return;

    try {
      const { data, error } = await window.supabase.rpc('classroom_vocab_touch_assignment', {
        _assignment_id: assignment.id
      });
      if (error) throw error;

      if (data) {
        assignment.status = data.status || assignment.status;
        assignment.progress_percent = data.progress_percent ?? assignment.progress_percent;
        assignment.assigned_at = data.assigned_at || assignment.assigned_at;
        assignment.started_at = data.started_at || assignment.started_at;
        assignment.completed_at = data.completed_at || assignment.completed_at;
        assignment.last_opened_at = data.last_opened_at || assignment.last_opened_at;
      }
    } catch (err) {
      console.warn('[student-cards] touch assignment:', err?.message || err);
    }
  }

async function fetchCardsAndProgress() {
  const assignment = getActiveAssignment();
  if (!assignment) {
    state.cards = [];
    state.progressByCardId = new Map();
    state.known = new Set();
    rebuildQueue(true);
    return;
  }

  await touchActiveAssignment();

  const { data: cardsRows, error: cardsErr } = await window.supabase
    .from('classroom_vocab_cards')
    .select('id, module_id, word, translation, example, note, sort_order, created_at, updated_at')
    .eq('module_id', assignment.module_id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (cardsErr) throw cardsErr;

  const { data: progressRows, error: progressErr } = await window.supabase
    .from('classroom_vocab_card_progress')
    .select('id, assignment_id, card_id, student_id, is_known, starred, last_reviewed_at, created_at, updated_at')
    .eq('assignment_id', assignment.id)
    .eq('student_id', state.userId);
  if (progressErr) throw progressErr;

  state.cards = cardsRows || [];
  state.progressByCardId = new Map((progressRows || []).map((p) => [p.card_id, p]));

  const allowedIds = state.cards.map((card) => card.id);
  state.known = loadSessionKnownForAssignment(assignment.id, allowedIds);
  state.idx = 0;
  state.flipped = false;
  state.hasCelebrated = false;

  rebuildQueue(true);
  saveSessionKnown();
  syncActiveAssignmentLocalProgress();
}

  async function reloadAll() {
    await fetchBase();
    await fetchCardsAndProgress();
  }

  async function saveCardProgress(cardId, patch) {
    const assignment = getActiveAssignment();
    if (!assignment) return;

    const existing = state.progressByCardId.get(cardId) || null;
    const payload = {
      assignment_id: assignment.id,
      card_id: cardId,
      student_id: state.userId,
      is_known: existing?.is_known ?? false,
      starred: existing?.starred ?? false,
      last_reviewed_at: existing?.last_reviewed_at ?? null
    };

    if (Object.prototype.hasOwnProperty.call(patch, 'is_known')) {
      payload.is_known = !!patch.is_known;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'starred')) {
      payload.starred = !!patch.starred;
    }
    if (patch.touch) {
      payload.last_reviewed_at = new Date().toISOString();
    }

    const { data, error } = await window.supabase
      .from('classroom_vocab_card_progress')
      .upsert(payload, { onConflict: 'assignment_id,card_id,student_id' })
      .select('id, assignment_id, card_id, student_id, is_known, starred, last_reviewed_at, created_at, updated_at')
      .single();

    if (error) throw error;

    state.progressByCardId.set(cardId, data);
    syncKnownFromProgress();
    syncActiveAssignmentLocalProgress();
  }

function renderCompletion(content, bar) {
  clearStudentCardsKeydown();
  bar.style.width = '100%';

  if (!state.hasCelebrated) {
    celebrate();
    state.hasCelebrated = true;
  }

  const moduleTitle = getActiveAssignment()?.module?.title || 'this module';
  const total = state.baseIds.length;

  content.innerHTML = `
    <div class="sc-complete-card">
      <div class="sc-complete-emoji">🎉</div>
      <h3 class="sc-complete-title">Module completed!</h3>
      <div class="sc-complete-sub">
        Great work. You finished all ${escapeHtml(String(total))} card${total === 1 ? '' : 's'} in <strong>${escapeHtml(moduleTitle)}</strong> for this practice session.
      </div>
      <div class="sc-complete-stats">
        <span class="sc-pill">Session progress: 100%</span>
        <span class="sc-pill">Cards learned: ${escapeHtml(String(total))}</span>
      </div>
      <div class="sc-complete-actions">
        <button class="sc-btn sc-btn-primary" type="button" id="sc-practice-again">Practice again</button>
      </div>
    </div>
  `;

  content.querySelector('#sc-practice-again').onclick = () => {
    restartPracticeFromBeginning();
    renderLearn();
  };
}

function renderLearn() {
  const content = rootEl()?.querySelector('#sc-content');
  const bar = rootEl()?.querySelector('#sc-bar');
  if (!content || !bar) return;

  if (!state.queue.length || !state.baseIds.length) {
    clearStudentCardsKeydown();
    content.innerHTML = `<div class="sc-empty">No cards match the current filter.</div>`;
    bar.style.width = '0%';
    return;
  }

  if (isSessionComplete()) {
    renderCompletion(content, bar);
    return;
  }

  if (state.idx >= state.queue.length) {
    const nextUnknown = state.queue.findIndex((card) => !state.known.has(card.id));
    state.idx = nextUnknown >= 0 ? nextUnknown : Math.max(0, state.queue.length - 1);
  }

  if (state.idx < 0) state.idx = 0;

  const c = state.queue[state.idx];
  const progress = state.progressByCardId.get(c.id);
  const starred = !!progress?.starred;

  // progress bar = прогресс текущей сессии
  bar.style.width = `${progressPct()}%`;

  content.innerHTML = `
    <div class="sc-card-stage" tabindex="0" aria-live="polite">
      <div class="sc-card-inner ${state.flipped ? 'is-flipped' : ''}">
        <div class="sc-face sc-front">${escapeHtml(c.word || '')}</div>
        <div class="sc-face sc-back">${escapeHtml(c.translation || '')}</div>
      </div>
    </div>

    <div class="sc-under">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <button class="sc-btn sc-btn-secondary" type="button" id="sc-prev">←</button>
        <button class="sc-btn sc-btn-secondary" type="button" id="sc-flip">Flip</button>
        <button class="sc-btn sc-btn-secondary" type="button" id="sc-next">→</button>
        <span class="sc-note" style="margin-left:12px;">${Math.min(getKnownCountForBaseIds() + 1, state.baseIds.length)} / ${state.baseIds.length}</span>
      </div>

      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span class="sc-star" id="sc-star" title="Star/Unstar">${starred ? '★' : '☆'}</span>
        <button class="sc-btn sc-btn-secondary" type="button" id="sc-bad">Don't know</button>
        <button class="sc-btn sc-btn-primary" type="button" id="sc-good">I know</button>
      </div>
    </div>

    ${(c.example || c.note) ? `
      <div class="sc-grid" style="margin-top:14px;">
        ${c.example ? `<div class="sc-card"><div class="sc-body"><div class="sc-label"><span>Example</span></div><div class="sc-note" style="white-space:pre-wrap;line-height:1.55;color:#111213;">${escapeHtml(c.example)}</div></div></div>` : ''}
        ${c.note ? `<div class="sc-card"><div class="sc-body"><div class="sc-label"><span>Note</span></div><div class="sc-note" style="white-space:pre-wrap;line-height:1.55;color:#111213;">${escapeHtml(c.note)}</div></div></div>` : ''}
      </div>
    ` : ''}
  `;

  content.querySelector('#sc-flip').onclick = () => {
    state.flipped = !state.flipped;
    renderLearn();
  };

  content.querySelector('#sc-prev').onclick = () => {
    if (state.idx > 0) state.idx -= 1;
    state.flipped = false;
    renderLearn();
  };

  content.querySelector('#sc-next').onclick = () => {
    if (state.idx < state.queue.length - 1) state.idx += 1;
    state.flipped = false;
    renderLearn();
  };

  content.querySelector('#sc-star').onclick = async (event) => {
    const btn = event.currentTarget;
    const original = startButtonFeedback(btn, starred ? 'Unstarring...' : 'Starring...');
    try {
      await saveCardProgress(c.id, { starred: !starred });
      await finishButtonFeedback(btn, original, true, !starred ? 'Starred' : 'Unstarred', 420);
      renderApp();
    } catch (err) {
      console.error('[student-cards] star error:', err);
      await finishButtonFeedback(btn, original, false, 'Failed', 650);
      showFlash('error', err?.message || 'Failed to update starred state.');
    }
  };

  content.querySelector('#sc-good').onclick = () => {
    if (state.actionBusy) return;
    state.actionBusy = true;

    const cardId = c.id;

    // Fast optimistic UI: the student moves to the next card immediately.
    // Supabase sync happens in the background, so the button no longer feels unstable.
    applyProgressLocally(cardId, { is_known: true, touch: true });
    state.known.add(cardId);
    saveSessionKnown();
    moveToNextCard();

    state.actionBusy = false;
    renderLearn();

    saveCardProgressInBackground(cardId, { is_known: true, touch: true });
  };

  content.querySelector('#sc-bad').onclick = () => {
    if (state.actionBusy) return;
    state.actionBusy = true;

    // “Don't know” is only a practice navigation action.
    // It does not save anything and does not show a misleading “Saved” status.
    moveToNextCard();

    state.actionBusy = false;
    renderLearn();
  };

  clearStudentCardsKeydown();

  const keyHandler = (e) => {
    if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

    if (e.code === 'Space') {
      e.preventDefault();
      state.flipped = !state.flipped;
      renderLearn();
    }

    if (e.key === 'ArrowRight') {
      if (state.idx < state.queue.length - 1) state.idx += 1;
      state.flipped = false;
      renderLearn();
    }

    if (e.key === 'ArrowLeft') {
      if (state.idx > 0) state.idx -= 1;
      state.flipped = false;
      renderLearn();
    }
  };

  window.__studentCardsKeydown = keyHandler;
  document.addEventListener('keydown', keyHandler);
}

  function renderList() {
    const content = rootEl()?.querySelector('#sc-content');
    const bar = rootEl()?.querySelector('#sc-bar');
    if (!content || !bar) return;

    bar.style.width = `${progressPct()}%`;

    if (!state.filtered.length) {
      content.innerHTML = `<div class="sc-empty">No cards match the current filter.</div>`;
      return;
    }

    content.innerHTML = `
      <div class="sc-card">
        <div class="sc-body">
          <div class="sc-table-wrap">
            <table class="sc-grid-table">
              <thead>
                <tr>
                  <th style="width:20%;">Word</th>
                  <th style="width:20%;">Translation</th>
                  <th style="width:22%;">Example</th>
                  <th style="width:22%;">Note</th>
                  <th style="width:8%;">Known</th>
                  <th style="width:8%;">★</th>
                </tr>
              </thead>
              <tbody>
                ${state.filtered.map((card) => {
                  const progress = state.progressByCardId.get(card.id);
                  const known = !!progress?.is_known;
                  const starred = !!progress?.starred;
                  return `
                    <tr data-card-id="${escapeHtml(card.id)}">
                      <td>${escapeHtml(card.word || '')}</td>
                      <td>${escapeHtml(card.translation || '')}</td>
                      <td style="white-space:pre-wrap;">${escapeHtml(card.example || '')}</td>
                      <td style="white-space:pre-wrap;">${escapeHtml(card.note || '')}</td>
                      <td>
                        <button class="sc-btn ${known ? 'sc-btn-primary' : 'sc-btn-secondary'}" type="button" data-action="toggle-known">
                          ${known ? 'Yes' : 'No'}
                        </button>
                      </td>
                      <td>
                        <button class="sc-btn sc-btn-secondary" type="button" data-action="toggle-star">
                          ${starred ? '★' : '☆'}
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    content.querySelectorAll('[data-action="toggle-known"]').forEach((btn) => {
      btn.onclick = async (event) => {
        const button = event.currentTarget;
        const original = startButtonFeedback(button, 'Saving...');
        const tr = button.closest('tr');
        const cardId = tr?.getAttribute('data-card-id');
        if (!cardId) return;
        const progress = state.progressByCardId.get(cardId);
        try {
          await saveCardProgress(cardId, {
            is_known: !(progress?.is_known),
            touch: true
          });
          await finishButtonFeedback(button, original, true, 'Saved', 420);
          renderApp();
        } catch (err) {
          console.error('[student-cards] toggle known error:', err);
          await finishButtonFeedback(button, original, false, 'Failed', 650);
          showFlash('error', err?.message || 'Failed to update known state.');
        }
      };
    });

    content.querySelectorAll('[data-action="toggle-star"]').forEach((btn) => {
      btn.onclick = async (event) => {
        const button = event.currentTarget;
        const original = startButtonFeedback(button, 'Saving...');
        const tr = button.closest('tr');
        const cardId = tr?.getAttribute('data-card-id');
        if (!cardId) return;
        const progress = state.progressByCardId.get(cardId);
        try {
          await saveCardProgress(cardId, {
            starred: !(progress?.starred)
          });
          await finishButtonFeedback(button, original, true, 'Saved', 420);
          renderApp();
        } catch (err) {
          console.error('[student-cards] toggle star error:', err);
          await finishButtonFeedback(button, original, false, 'Failed', 650);
          showFlash('error', err?.message || 'Failed to update starred state.');
        }
      };
    });
  }

  function renderAssignmentsPanel() {
    const listHtml = state.assignments.length
      ? state.assignments.map((a) => {
          const teacherName = (a.teacher?.full_name || '').trim() || a.teacher?.email || 'Teacher';
          return `
            <div class="sc-assignment-item ${a.id === state.activeAssignmentId ? 'active' : ''}" data-assignment-id="${escapeHtml(a.id)}">
              <div class="sc-assignment-top">
                <div>
                  <div class="sc-assignment-title">${escapeHtml(a.module?.title || 'Cards module')}</div>
                  <div class="sc-assignment-desc">${escapeHtml(a.module?.description || 'No description')}</div>
                </div>
                <div class="sc-badge ${escapeHtml(a.status || 'not_started')}">${escapeHtml(statusLabel(a.status))}</div>
              </div>

              <div class="sc-meta">
                <div class="sc-pill">Teacher: ${escapeHtml(teacherName)}</div>
                <div class="sc-pill">Progress: ${escapeHtml(String(Number(a.progress_percent || 0).toFixed(0)))}%</div>
                <div class="sc-pill">Assigned: ${escapeHtml(formatDateTime(a.assigned_at))}</div>
              </div>
            </div>
          `;
        }).join('')
: `<div class="sc-empty">
    You don’t have a teacher yet.<br>
    When a teacher adds your email, your vocabulary card modules will appear here.
  </div>`;
    return `
      <div class="sc-card">
        <div class="sc-head">
          <div class="sc-kicker">Assigned cards</div>
          <h2 class="sc-title" style="font-size:24px;">Vocabulary from teacher</h2>
          <div class="sc-sub">Open a module to study words sent by your teacher.</div>
        </div>
        <div class="sc-body">
          <div class="sc-assignment-list">${listHtml}</div>
        </div>
      </div>
    `;
  }

  function renderApp() {
    const root = rootEl();
    if (!root) return;

    const studentName = ((state.student?.full_name || '').trim() || state.student?.email || 'Student');
    const studentEmail = state.student?.email || '';
    const activeAssignment = getActiveAssignment();
    const activeTeacher = activeAssignment?.teacher;
    const activeTeacherLabel = (activeTeacher?.full_name || '').trim() || activeTeacher?.email || 'Teacher';

    const flashHtml = state.flash
      ? `<div class="${state.flash.type === 'error' ? 'sc-error' : 'sc-success'}">${escapeHtml(state.flash.message)}</div>`
      : '';

    root.innerHTML = `
      <div class="sc-wrap">
        ${flashHtml}

        <div class="sc-card">
          <div class="sc-head">
            <div class="sc-kicker">Student cards</div>
            <h1 class="sc-title">Welcome, ${escapeHtml(studentName)}</h1>
            <div class="sc-sub">Study vocabulary modules sent to you by your teacher.</div>
            <div class="sc-meta">
              <div class="sc-pill">Mode: student</div>              <div class="sc-pill">${state.assignments.length} module${state.assignments.length === 1 ? '' : 's'}</div>
              <div class="sc-pill">${escapeHtml(studentEmail)}</div>
            </div>
          </div>
        </div>

        ${renderAssignmentsPanel()}

        <div class="sc-card">
          <div class="sc-head">
            <div class="sc-kicker">Cards study area</div>
            <h2 class="sc-title" style="font-size:24px;">${escapeHtml(activeAssignment?.module?.title || 'Cards')}</h2>
            <div class="sc-sub">
              ${activeAssignment ? `Teacher: ${escapeHtml(activeTeacherLabel)}` : 'Choose an assigned cards module to start learning.'}
            </div>
          </div>

          <div class="sc-body">
            <div class="sc-toolbar">
              <div class="sc-switch" role="tablist" aria-label="Cards mode">
                <button id="sc-mode-learn" type="button" class="${state.mode === 'learn' ? 'active' : ''}" ${activeAssignment ? '' : 'disabled'}>Learn</button>
                <button id="sc-mode-list" type="button" class="${state.mode === 'list' ? 'active' : ''}" ${activeAssignment ? '' : 'disabled'}>List</button>
              </div>

              <button class="sc-btn sc-btn-secondary" type="button" id="sc-shuffle" ${state.mode === 'learn' && state.cards.length ? '' : 'disabled'}>Shuffle</button>
              <button class="sc-btn sc-btn-secondary" type="button" id="sc-star-filter" ${activeAssignment ? '' : 'disabled'}>Starred: ${state.filterStarred ? 'on' : 'off'}</button>

              <div class="grow"></div>

              <input class="sc-input" id="sc-search" placeholder="Search cards…" value="${escapeHtml(state.term)}" ${activeAssignment ? '' : 'disabled'} />
            </div>

            <div id="sc-content" style="margin-top:14px;"></div>
            <div class="sc-progress" style="margin-top:12px;"><div class="sc-bar" id="sc-bar"></div></div>

            ${activeAssignment ? `
              <div class="sc-meta" style="margin-top:14px;">
                <div class="sc-pill">Status: ${escapeHtml(statusLabel(activeAssignment.status))}</div>
                <div class="sc-pill">Progress: ${escapeHtml(String(Number(activeAssignment.progress_percent || 0).toFixed(0)))}%</div>
                <div class="sc-pill">Assigned: ${escapeHtml(formatDateTime(activeAssignment.assigned_at))}</div>
                <div class="sc-pill">Started: ${escapeHtml(formatDateTime(activeAssignment.started_at))}</div>
                <div class="sc-pill">Last opened: ${escapeHtml(formatDateTime(activeAssignment.last_opened_at))}</div>
                <div class="sc-pill">Completed: ${escapeHtml(formatDateTime(activeAssignment.completed_at))}</div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    bindEvents();

    if (!activeAssignment) {
      const content = root.querySelector('#sc-content');
      const bar = root.querySelector('#sc-bar');
      if (content) content.innerHTML = `<div class="sc-empty">No cards module selected.</div>`;
      if (bar) bar.style.width = '0%';
    } else {
      if (state.mode === 'learn') renderLearn();
      else renderList();
    }

    state.flash = null;
  }

  function bindEvents() {
    const root = rootEl();
    if (!root) return;

    root.querySelectorAll('[data-assignment-id]').forEach((el) => {
      el.onclick = async () => {
        const assignmentId = el.getAttribute('data-assignment-id');
        if (!assignmentId || assignmentId === state.activeAssignmentId) return;
        state.activeAssignmentId = assignmentId;
        state.term = '';
        state.filterStarred = false;
        await fetchCardsAndProgress();
        renderApp();
      };
    });

    const learnBtn = root.querySelector('#sc-mode-learn');
    const listBtn = root.querySelector('#sc-mode-list');
    if (learnBtn) {
      learnBtn.onclick = () => {
        state.mode = 'learn';
        renderApp();
      };
    }
    if (listBtn) {
      listBtn.onclick = () => {
        state.mode = 'list';
        renderApp();
      };
    }

    const shuffleBtn = root.querySelector('#sc-shuffle');
    if (shuffleBtn) {
      shuffleBtn.onclick = async () => {
        const original = startButtonFeedback(shuffleBtn, 'Shuffling...');
        shuffleFilteredCards();
        await finishButtonFeedback(shuffleBtn, original, true, 'Shuffled', 420);
        renderLearn();
        showMiniStatus('Cards shuffled. Practice starts from the first card.');
      };
    }

    const searchEl = root.querySelector('#sc-search');
    if (searchEl) {
      searchEl.oninput = (event) => {
        state.term = event.target.value || '';
        rebuildQueue(true);
        if (state.mode === 'learn') renderLearn();
        else renderList();
      };
    }
  }

async function startApp() {
  if (state.started) return;
  state.started = true;

  injectStyles();
  setLoading();

  try {
    await reloadAll();
    renderApp();
    initStudentCardsRealtime();
  } catch (err) {
    console.error('[student-cards] load error:', err);
    setError(err?.message || 'Failed to load student cards app.');
  }
}

  function startWhenReady() {
    const ready = () => !!rootEl() && !!window.supabase;
    if (ready()) {
      startApp();
      return;
    }
    when(ready, startApp);
  }

window.addEventListener('beforeunload', clearStudentCardsRealtime);

  if (window.__evoAllowStudentApp) {
    startWhenReady();
  } else {
    window.addEventListener('evo:student-ready', startWhenReady, { once: true });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startWhenReady, { once: true });
    } else {
      startWhenReady();
    }
  }
})();