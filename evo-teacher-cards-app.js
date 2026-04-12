(function () {
if (window.__evoTeacherDashboardCardsInit) return;
window.__evoTeacherDashboardCardsInit = true;

const ROOT_ID = 'teacher-dashboard-cards-app';
const state = {
teacher: null,
userId: null,
students: [],
studentsById: new Map(),
modules: [],
assignmentsByModule: new Map(),
activeModuleId: null,
cards: [],
filtered: [],
queue: [],
baseIds: [],
known: new Set(),
idx: 0,
flipped: false,
term: '',
hasCelebrated: false,
flash: null,
mode: 'learn'
};

function rootEl() {
return document.getElementById(ROOT_ID);
}

function escapeHtml(value) {
return String(value ?? '').replace(/[&<>"']/g, function (m) {
  return {
  '&': '&amp;',
  '<': '&lt;' , '>' : '&gt;' , '"' : '&quot;' , "'" : '&#39;' }[m]; }); } function when(cond, cb, tries=80, delay=150) {
    const t=setInterval(()=> {
    if (cond()) {
    clearInterval(t);
    cb();
    } else if (--tries <= 0) { clearInterval(t); } }, delay); } function showFlash(type, message) { state.flash={ type,
      message }; renderApp(); } function formatDateTime(value) { if (!value) return 'No date' ; try { const d=new
      Date(value); if (Number.isNaN(d.getTime())) return 'No date' ; return d.toLocaleString(undefined, {
      year: 'numeric' , month: 'short' , day: 'numeric' , hour: '2-digit' , minute: '2-digit' }); } catch {
      return 'No date' ; } } function statusLabel(status) { if (status==='completed' ) return 'Completed' ; if
      (status==='in_progress' ) return 'In progress' ; return 'Not started' ; } function injectStyles() { if
      (document.getElementById('teacher-dashboard-cards-styles')) return; const style=document.createElement('style');
      style.id='teacher-dashboard-cards-styles' ; style.textContent=` #${ROOT_ID}{max-width:980px;margin:32px
      auto;padding:0 16px 40px;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe
      UI",Roboto,sans-serif;color:#111213} #${ROOT_ID} *{box-sizing:border-box} .tc-wrap{display:grid;gap:18px}
      .tc-card{background:#fff;border:1px solid #dfe5ec;border-radius:16px;box-shadow:0 10px 24px
      rgba(0,0,0,.05);overflow:hidden} .tc-head{padding:18px 20px;border-bottom:1px solid
      #eef2f6;background:linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)}
      .tc-kicker{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#4EA9E7;font-weight:700;margin-bottom:6px}
      .tc-title{margin:0;font-size:28px;line-height:1.15} .tc-sub{margin-top:8px;color:#667085;font-size:15px}
      .tc-body{padding:18px 20px 20px} .tc-meta{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}
      .tc-pill{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:999px;border:1px solid
      #dbe7f3;background:#f8fbff;color:#0f172a;font-size:14px} .tc-grid{display:grid;gap:12px}
      .tc-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px} .tc-grid-3{display:grid;grid-template-columns:1fr
      1fr 1fr;gap:12px} .tc-label{display:grid;gap:8px} .tc-label span{font-size:14px;font-weight:700;color:#344054}
      .tc-input,.tc-select,.tc-textarea{width:100%;border:1px solid
      #d0d5dd;border-radius:12px;background:#fff;color:#111213;font:16px
      system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:12px 14px;outline:none}
      .tc-input:focus,.tc-select:focus,.tc-textarea:focus{border-color:#4EA9E7;box-shadow:0 0 0 3px
      rgba(78,169,231,.18)} .tc-textarea{min-height:110px;resize:vertical}
      .tc-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
      .tc-btn{appearance:none;border:none;border-radius:12px;padding:12px 16px;font:700 14px
      system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;cursor:pointer}
      .tc-btn-primary{background:#111213;color:#fff} .tc-btn-primary:hover,.tc-link:hover{filter:brightness(1.05)}
      .tc-btn-secondary{background:#f8fbff;color:#175cd3;border:1px solid #dbe7f3}
      .tc-btn-danger{background:#fff2f2;color:#b42318;border:1px solid #fecaca}
      .tc-btn:disabled{opacity:.65;cursor:not-allowed} .tc-note{color:#667085;font-size:14px}
      .tc-empty{padding:24px;border:1px dashed
      #cfd8e3;border-radius:14px;background:#fbfdff;color:#667085;text-align:center} .tc-error{padding:16px
      18px;border-radius:14px;background:#fff2f2;border:1px solid #fecaca;color:#b42318} .tc-success{padding:16px
      18px;border-radius:14px;background:#ecfdf3;border:1px solid #b7ebc6;color:#027a48}
      .tc-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:12px;border:1px solid
      #e6ebf1;border-radius:14px;background:#fff} .tc-toolbar .grow{flex:1}
      .tc-switch{display:inline-flex;background:#F3F4F6;border:1px solid #d0d5dd;border-radius:10px;overflow:hidden}
      .tc-switch button{border:none;background:transparent;padding:8px 12px;cursor:pointer;font:500 14px system-ui}
      .tc-switch button.active{background:#fff} .tc-module-list,.tc-assignment-list{display:grid;gap:10px}
      .tc-module-item,.tc-assignment-item{border:1px solid #e6ebf1;border-radius:14px;padding:14px 16px;background:#fff}
      .tc-module-item.active{border-color:#4EA9E7;box-shadow:0 0 0 3px rgba(78,169,231,.12)}
      .tc-module-top,.tc-assignment-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
      .tc-module-title,.tc-assignment-title{font-size:18px;font-weight:700;line-height:1.25}
      .tc-module-desc{margin-top:6px;color:#475467;font-size:14px;line-height:1.55;white-space:pre-wrap}
      .tc-tag{display:inline-flex;align-items:center;padding:7px 10px;border-radius:999px;background:#f8fbff;border:1px
      solid #dbe7f3;color:#0f172a;font-size:13px} .tc-badge{display:inline-flex;align-items:center;padding:6px
      10px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap}
      .tc-badge.completed{background:#ecfdf3;border:1px solid #b7ebc6;color:#027a48}
      .tc-badge.not_started{background:#f8fbff;border:1px solid #dbe7f3;color:#175cd3}
      .tc-badge.in_progress{background:#fff7ed;border:1px solid #fed7aa;color:#c2410c}
      .tc-card-stage{width:100%;height:280px;perspective:1000px;outline:none}
      .tc-card-inner{position:relative;width:100%;height:100%;transition:transform .45s;transform-style:preserve-3d}
      .tc-card-inner.is-flipped{transform:rotateY(180deg)}
      .tc-face{position:absolute;inset:0;background:linear-gradient(180deg,#fff,#f9fbff 60%);border:1px solid
      #e8ecf2;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:28px;padding:24px;text-align:center;backface-visibility:hidden;box-shadow:0
      12px 24px rgba(0,0,0,.06)} .tc-back{transform:rotateY(180deg)}
      .tc-under{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:12px}
      .tc-progress{height:8px;background:#eef2f7;border-radius:8px;overflow:hidden}
      .tc-bar{height:100%;width:0;background:#77BEF0;transition:width .25s} .tc-manage{background:#fff;border:1px solid
      #d0d5dd;border-radius:14px;overflow:hidden}
      .tc-manage-head{display:flex;align-items:center;gap:8px;padding:12px;border-bottom:1px solid #eef1f5}
      .tc-manage-head .grow{flex:1} .tc-table-wrap{overflow:auto}
      .tc-grid-table{width:100%;border-collapse:separate;border-spacing:0} .tc-grid-table th,.tc-grid-table
      td{padding:10px 12px;border-bottom:1px solid #eef1f5;font:14px system-ui;vertical-align:middle} .tc-grid-table
      th{background:#f8fafc;text-align:left;color:#475569} .tc-grid-table tr:last-child td{border-bottom:none}
      .tc-link{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;border:none;border-radius:12px;padding:11px
      14px;font:700 14px system-ui,-apple-system,BlinkMacSystemFont,"Segoe
      UI",Roboto,sans-serif;background:#111213;color:#fff}
      .tc-confetti{position:fixed;inset:0;pointer-events:none;z-index:10000;overflow:hidden}
      .tc-piece{position:absolute;width:8px;height:14px;opacity:.9;animation:tc-fall 1200ms ease-out forwards}
      @keyframes tc-fall{0%{transform:translate3d(var(--x,0),-20px,0)
      rotate(0deg)}100%{transform:translate3d(var(--x-end,0),calc(100vh + 30px),0) rotate(720deg)}} @media
      (max-width:760px){#${ROOT_ID}{padding:0 12px
      28px}.tc-head,.tc-body{padding:16px}.tc-title{font-size:24px}.tc-grid-2,.tc-grid-3{grid-template-columns:1fr}.tc-module-top,.tc-assignment-top,.tc-under{flex-direction:column;align-items:flex-start}.tc-toolbar{align-items:stretch}.tc-toolbar
      .grow{display:none}} `; document.head.appendChild(style); } function setLoading() { const root=rootEl(); if
      (!root) return; root.innerHTML=`<div class="tc-wrap">
      <div class="tc-card">
        <div class="tc-head">
          <div class="tc-kicker">Teacher cards</div>
          <h1 class="tc-title">Loading cards…</h1>
          <div class="tc-sub">Please wait a moment.</div>
        </div>
        <div class="tc-body">
          <div class="tc-note">Loading modules and students…</div>
        </div>
      </div>
      </div>`;
      }

      function setError(message) {
      const root = rootEl();
      if (!root) return;
      root.innerHTML = `<div class="tc-wrap">
        <div class="tc-card">
          <div class="tc-head">
            <div class="tc-kicker">Teacher cards</div>
            <h1 class="tc-title">Something went wrong</h1>
            <div class="tc-sub">The cards tab could not be loaded.</div>
          </div>
          <div class="tc-body">
            <div class="tc-error">${escapeHtml(message)}</div>
          </div>
        </div>
      </div>`;
      }

      function openPrompt(title, placeholder, initial, okText) {
      return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.style.cssText =
      'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center';
      wrap.innerHTML = `
      <div style="position:absolute;inset:0;background:rgba(0,0,0,.45)"></div>
      <div
        style="position:relative;width:min(420px,92vw);background:#fff;border:1px solid #E7E9EE;border-radius:14px;padding:16px;box-shadow:0 24px 60px rgba(0,0,0,.35)">
        <div style="font:600 16px system-ui;margin-bottom:10px;">${escapeHtml(title)}</div>
        <input id="tc-dlg-val" class="tc-input" placeholder="${escapeHtml(placeholder || '')}"
          value="${escapeHtml(initial || '')}" />
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
          <button id="tc-dlg-cancel" class="tc-btn tc-btn-secondary" type="button">Cancel</button>
          <button id="tc-dlg-ok" class="tc-btn tc-btn-primary" type="button">${escapeHtml(okText || 'OK')}</button>
        </div>
      </div>
      `;
      document.body.appendChild(wrap);
      const input = wrap.querySelector('#tc-dlg-val');
      input.focus();
      input.select();
      wrap.querySelector('#tc-dlg-cancel').onclick = () => {
      wrap.remove();
      resolve(null);
      };
      wrap.querySelector('#tc-dlg-ok').onclick = () => {
      const value = input.value.trim();
      wrap.remove();
      resolve(value || null);
      };
      });
      }

      function openConfirm(title, message, okText) {
      return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.style.cssText =
      'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center';
      wrap.innerHTML = `
      <div style="position:absolute;inset:0;background:rgba(0,0,0,.45)"></div>
      <div
        style="position:relative;width:min(460px,92vw);background:#fff;border:1px solid #E7E9EE;border-radius:14px;padding:16px;box-shadow:0 24px 60px rgba(0,0,0,.35)">
        <div style="font:600 16px system-ui;margin-bottom:6px;">${escapeHtml(title)}</div>
        <div class="tc-note" style="margin-bottom:12px">${escapeHtml(message)}</div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px">
          <button id="tc-cancel" class="tc-btn tc-btn-secondary" type="button">Cancel</button>
          <button id="tc-ok" class="tc-btn tc-btn-danger" type="button">${escapeHtml(okText || 'Delete')}</button>
        </div>
      </div>
      `;
      document.body.appendChild(wrap);
      wrap.querySelector('#tc-cancel').onclick = () => {
      wrap.remove();
      resolve(false);
      };
      wrap.querySelector('#tc-ok').onclick = () => {
      wrap.remove();
      resolve(true);
      };
      });
      }

      function celebrate() {
      const toast = document.createElement('div');
      toast.textContent = 'Great! All cards in this module are learned 🎉';
      toast.style.cssText =
      'position:fixed;left:50%;top:18%;transform:translateX(-50%);background:#111;color:#fff;padding:12px 16px;border-radius:12px;box-shadow:0 6px 20px rgba(0,0,0,.25);z-index:10001;opacity:0;transition:.25s opacity;font-family:system-ui;font-size:16px';
      document.body.appendChild(toast);
      requestAnimationFrame(() => {
      toast.style.opacity = '1';
      });
      setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
      }, 1500);

      const wrap = document.createElement('div');
      wrap.className = 'tc-confetti';
      document.body.appendChild(wrap);
      const colors = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6'];
      const pieces = 120;
      const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
      for (let i = 0; i < pieces; i++) { const d=document.createElement('div'); d.className='tc-piece' ;
        d.style.background=colors[i % colors.length]; const x=Math.random() * vw; const offset=(Math.random() * 2 - 1) *
        80; d.style.left=`${x}px`; d.style.setProperty('--x', '0px' ); d.style.setProperty('--x-end', `${offset}px`);
        d.style.animationDelay=`${(Math.random() * 400) | 0}ms`; wrap.appendChild(d); } setTimeout(()=> wrap.remove(),
        1800);
        }

        async function fetchTeacherBase() {
        const supabase = window.supabase;
        if (!supabase) throw new Error('Supabase is not available on this page.');

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        const user = userData?.user;
        if (!user) throw new Error('User session not found.');
        state.userId = user.id;

        const { data: teacherProfile, error: teacherErr } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .eq('id', user.id)
        .single();
        if (teacherErr) throw teacherErr;
        if (teacherProfile.role !== 'teacher') throw new Error('Only teacher accounts can access this cards tab.');

        const { data: links, error: linksErr } = await supabase
        .from('teacher_students')
        .select('student_id, status, created_at')
        .eq('teacher_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
        if (linksErr) throw linksErr;

        const studentIds = [...new Set((links || []).map((r) => r.student_id).filter(Boolean))];
        let students = [];
        if (studentIds.length) {
        const { data: studentProfiles, error: studentsErr } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .in('id', studentIds);
        if (studentsErr) throw studentsErr;
        const byId = new Map((studentProfiles || []).map((p) => [p.id, p]));
        students = studentIds.map((id) => byId.get(id)).filter(Boolean);
        }

        const { data: modulesRows, error: modulesErr } = await supabase
        .from('classroom_vocab_modules')
        .select('id, teacher_id, title, description, is_archived, created_at, updated_at')
        .eq('teacher_id', user.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: true });
        if (modulesErr) throw modulesErr;

        state.teacher = teacherProfile;
        state.students = students;
        state.studentsById = new Map(students.map((s) => [s.id, s]));
        state.modules = modulesRows || [];

        if (!state.activeModuleId) {
        state.activeModuleId = state.modules[0]?.id || null;
        } else if (!state.modules.some((m) => m.id === state.activeModuleId)) {
        state.activeModuleId = state.modules[0]?.id || null;
        }
        }

        async function fetchAssignmentsForModule(moduleId) {
        const supabase = window.supabase;
        if (!moduleId) {
        state.assignmentsByModule.set(moduleId, []);
        return [];
        }

        const { data: assignmentRows, error } = await supabase
        .from('classroom_vocab_assignments')
        .select('id, module_id, teacher_id, student_id, status, progress_percent, assigned_at, started_at, completed_at, last_opened_at, created_at, updated_at')
        .eq('module_id', moduleId)
        .order('assigned_at', { ascending: false });
        if (error) throw error;

        const rows = assignmentRows || [];
        state.assignmentsByModule.set(moduleId, rows);
        return rows;
        }

        async function fetchCardsForActiveModule() {
        const supabase = window.supabase;
        const moduleId = state.activeModuleId;
        if (!moduleId) {
        state.cards = [];
        rebuildQueue(true);
        return;
        }

        const { data: rows, error } = await supabase
        .from('classroom_vocab_cards')
        .select('id, module_id, word, translation, example, note, sort_order, created_at, updated_at')
        .eq('module_id', moduleId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
        if (error) throw error;

        state.cards = rows || [];
        rebuildQueue(true);
        }

        async function reloadAll() {
        await fetchTeacherBase();
        if (state.activeModuleId) {
        await Promise.all([
        fetchCardsForActiveModule(),
        fetchAssignmentsForModule(state.activeModuleId)
        ]);
        } else {
        state.cards = [];
        rebuildQueue(true);
        }
        }

        function rebuildQueue(reset) {
        state.filtered = state.cards.filter((c) => {
        if (!state.term) return true;
        const term = state.term.toLowerCase();
        return (c.word || '').toLowerCase().includes(term) ||
        (c.translation || '').toLowerCase().includes(term) ||
        (c.example || '').toLowerCase().includes(term) ||
        (c.note || '').toLowerCase().includes(term);
        });
        state.baseIds = [...new Set(state.filtered.map((c) => c.id))];
        state.queue = state.filtered.slice();
        if (reset) {
        state.known.clear();
        state.idx = 0;
        state.flipped = false;
        state.hasCelebrated = false;
        }
        }

        function progressPct() {
        return (state.known.size / Math.max(1, state.baseIds.length)) * 100;
        }

        function skipKnownForward() {
        while (state.idx < state.queue.length && state.known.has(state.queue[state.idx].id)) { state.idx +=1; } }
          function shuffleQueue() { for (let i=state.filtered.length - 1; i> 0; i--) {
          const j = (Math.random() * (i + 1)) | 0;
          [state.filtered[i], state.filtered[j]] = [state.filtered[j], state.filtered[i]];
          }
          state.baseIds = [...new Set(state.filtered.map((c) => c.id))];
          state.queue = state.filtered.slice();
          state.known.clear();
          state.idx = 0;
          state.flipped = false;
          state.hasCelebrated = false;
          renderLearn();
          }

          async function handleCreateModule() {
          const title = await openPrompt('Create cards module', 'Module title', `Module ${Math.floor(Math.random() * 90
          + 10)}`, 'Create');
          if (!title) return;

          const description = await openPrompt('Module description', 'Optional description', '', 'Save');
          const supabase = window.supabase;
          const { data, error } = await supabase
          .from('classroom_vocab_modules')
          .insert({
          teacher_id: state.userId,
          title,
          description: description || null
          })
          .select('id, teacher_id, title, description, is_archived, created_at, updated_at')
          .single();
          if (error) {
          showFlash('error', error.message || 'Failed to create module.');
          return;
          }

          state.modules.push(data);
          state.activeModuleId = data.id;
          await reloadAll();
          showFlash('success', 'Cards module created successfully.');
          }

          async function handleRenameModule() {
          const mod = state.modules.find((m) => m.id === state.activeModuleId);
          if (!mod) return;
          const title = await openPrompt('Rename module', 'New title', mod.title || '', 'Save');
          if (!title || title === mod.title) return;
          const description = await openPrompt('Update description', 'Optional description', mod.description || '',
          'Save');

          const supabase = window.supabase;
          const { error } = await supabase
          .from('classroom_vocab_modules')
          .update({
          title,
          description: description || null
          })
          .eq('id', mod.id)
          .eq('teacher_id', state.userId);
          if (error) {
          showFlash('error', error.message || 'Failed to rename module.');
          return;
          }

          await reloadAll();
          showFlash('success', 'Module updated successfully.');
          }

          async function handleDeleteModule() {
          const mod = state.modules.find((m) => m.id === state.activeModuleId);
          if (!mod) return;
          const ok = await openConfirm('Delete module?', `Module “${mod.title}” and all its cards and assignments will
          be removed. This cannot be undone.`, 'Delete module');
          if (!ok) return;

          const supabase = window.supabase;
          const { error } = await supabase
          .from('classroom_vocab_modules')
          .delete()
          .eq('id', mod.id)
          .eq('teacher_id', state.userId);
          if (error) {
          showFlash('error', error.message || 'Failed to delete module.');
          return;
          }

          state.modules = state.modules.filter((m) => m.id !== mod.id);
          state.activeModuleId = state.modules[0]?.id || null;
          await reloadAll();
          showFlash('success', 'Module deleted successfully.');
          }

          async function handleAssignModule(button) {
          const moduleId = state.activeModuleId;
          const root = rootEl();
          if (!moduleId || !root) return;

          const select = root.querySelector('#tc-student-select');
          const studentId = select?.value || '';
          if (!studentId) {
          showFlash('error', 'Please choose a student first.');
          return;
          }

          button.disabled = true;
          try {
          const { error } = await window.supabase.rpc('classroom_vocab_assign_module', {
          _module_id: moduleId,
          _student_id: studentId
          });
          if (error) throw error;
          await fetchAssignmentsForModule(moduleId);
          showFlash('success', 'Cards module was sent successfully.');
          } catch (err) {
          console.error('[teacher-cards] assign module error:', err);
          showFlash('error', err?.message || 'Failed to send cards module.');
          } finally {
          button.disabled = false;
          }
          }

          async function handleDeleteAssignment(button) {
          const assignmentId = button.getAttribute('data-assignment-id');
          if (!assignmentId) return;
          const ok = await openConfirm('Remove cards from student?', 'The student assignment and their cards progress for this module will be removed.', 'Remove');
          if (!ok) return;

          button.disabled = true;
          try {
          const { error } = await window.supabase
          .from('classroom_vocab_assignments')
          .delete()
          .eq('id', assignmentId)
          .eq('teacher_id', state.userId);
          if (error) throw error;
          await fetchAssignmentsForModule(state.activeModuleId);
          showFlash('success', 'Cards assignment was removed.');
          } catch (err) {
          console.error('[teacher-cards] delete assignment error:', err);
          showFlash('error', err?.message || 'Failed to remove cards assignment.');
          } finally {
          button.disabled = false;
          }
          }

          async function handleCreateCard(tr) {
          const word = tr.querySelector('[data-field="word"]')?.value.trim() || '';
          const translation = tr.querySelector('[data-field="translation"]')?.value.trim() || '';
          const example = tr.querySelector('[data-field="example"]')?.value.trim() || '';
          const note = tr.querySelector('[data-field="note"]')?.value.trim() || '';
          if (!word || !translation) {
          alert('Word and translation are required.');
          return;
          }

          const nextOrder = state.cards.length ? Math.max(...state.cards.map((c) => Number(c.sort_order) || 0)) + 1 : 1;
          const { error } = await window.supabase
          .from('classroom_vocab_cards')
          .insert({
          module_id: state.activeModuleId,
          word,
          translation,
          example: example || null,
          note: note || null,
          sort_order: nextOrder
          });
          if (error) {
          alert(error.message || 'Failed to create card.');
          return;
          }

          await fetchCardsForActiveModule();
          renderManage();
          }

          async function handleSaveCard(tr) {
          const id = tr.getAttribute('data-id');
          if (!id) return;
          const word = tr.querySelector('[data-field="word"]')?.value.trim() || '';
          const translation = tr.querySelector('[data-field="translation"]')?.value.trim() || '';
          const example = tr.querySelector('[data-field="example"]')?.value.trim() || '';
          const note = tr.querySelector('[data-field="note"]')?.value.trim() || '';
          const sortOrderRaw = tr.querySelector('[data-field="sort_order"]')?.value.trim() || '0';
          const sortOrder = Number(sortOrderRaw);

          if (!word || !translation) {
          alert('Word and translation are required.');
          return;
          }
          if (Number.isNaN(sortOrder)) {
          alert('Sort order must be a number.');
          return;
          }

          const { error } = await window.supabase
          .from('classroom_vocab_cards')
          .update({
          word,
          translation,
          example: example || null,
          note: note || null,
          sort_order: sortOrder
          })
          .eq('id', id)
          .eq('module_id', state.activeModuleId);
          if (error) {
          alert(error.message || 'Failed to save card.');
          return;
          }

          await fetchCardsForActiveModule();
          renderManage();
          }

          async function handleDeleteCard(id) {
          if (!confirm('Delete this card?')) return;
          const { error } = await window.supabase
          .from('classroom_vocab_cards')
          .delete()
          .eq('id', id)
          .eq('module_id', state.activeModuleId);
          if (error) {
          alert(error.message || 'Failed to delete card.');
          return;
          }
          await fetchCardsForActiveModule();
          renderManage();
          }

          function renderLearn() {
          const content = rootEl()?.querySelector('#tc-content');
          const bar = rootEl()?.querySelector('#tc-bar');
          if (!content || !bar) return;

          if (!state.queue.length || !state.baseIds.length) {
          content.innerHTML = `<div class="tc-empty">No cards in this module yet.</div>`;
          bar.style.width = '0%';
          return;
          }

          skipKnownForward();

          if (state.idx >= state.queue.length) {
          if (state.known.size === state.baseIds.length) {
          if (!state.hasCelebrated) {
          celebrate();
          state.hasCelebrated = true;
          }
          state.idx = Math.max(0, state.queue.length - 1);
          } else {
          const nextUnknown = state.queue.findIndex((c) => !state.known.has(c.id));
          state.idx = nextUnknown === -1 ? Math.max(0, state.queue.length - 1) : nextUnknown;
          }
          }

          const c = state.queue[state.idx];
          bar.style.width = `${progressPct()}%`;

          content.innerHTML = `
          <div class="tc-card-stage" tabindex="0" aria-live="polite">
            <div class="tc-card-inner ${state.flipped ? 'is-flipped' : ''}">
              <div class="tc-face tc-front">${escapeHtml(c.word || '')}</div>
              <div class="tc-face tc-back">${escapeHtml(c.translation || '')}</div>
            </div>
          </div>
          <div class="tc-under">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <button class="tc-btn tc-btn-secondary" type="button" id="tc-prev">←</button>
              <button class="tc-btn tc-btn-secondary" type="button" id="tc-flip">Flip</button>
              <button class="tc-btn tc-btn-secondary" type="button" id="tc-next">→</button>
              <span class="tc-note" style="margin-left:12px;">${Math.min(state.known.size + 1, state.baseIds.length)} /
                ${state.baseIds.length}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <button class="tc-btn tc-btn-secondary" type="button" id="tc-bad">Don't know</button>
              <button class="tc-btn tc-btn-primary" type="button" id="tc-good">I know</button>
            </div>
          </div>
          ${(c.example || c.note) ? `
          <div class="tc-grid" style="margin-top:14px;">
            ${c.example ? `<div class="tc-card">
              <div class="tc-body">
                <div class="tc-label"><span>Example</span></div>
                <div class="tc-note" style="white-space:pre-wrap;line-height:1.55;color:#111213;">
                  ${escapeHtml(c.example)}</div>
              </div>
            </div>` : ''}
            ${c.note ? `<div class="tc-card">
              <div class="tc-body">
                <div class="tc-label"><span>Note</span></div>
                <div class="tc-note" style="white-space:pre-wrap;line-height:1.55;color:#111213;">${escapeHtml(c.note)}
                </div>
              </div>
            </div>` : ''}
          </div>
          ` : ''}
          `;

          content.querySelector('#tc-flip').onclick = () => {
          state.flipped = !state.flipped;
          renderLearn();
          };
          content.querySelector('#tc-prev').onclick = () => {
          state.idx = Math.max(0, state.idx - 1);
          state.flipped = false;
          renderLearn();
          };
          content.querySelector('#tc-next').onclick = () => {
          state.idx = Math.min(state.idx + 1, state.queue.length);
          state.flipped = false;
          renderLearn();
          };
          content.querySelector('#tc-good').onclick = () => {
          state.known.add(c.id);
          state.idx += 1;
          state.flipped = false;
          renderLearn();
          };
          content.querySelector('#tc-bad').onclick = () => {
          state.queue.push(c);
          state.idx += 1;
          state.flipped = false;
          renderLearn();
          };
          }

          function renderManage() {
          const content = rootEl()?.querySelector('#tc-content');
          if (!content) return;

          const module = state.modules.find((m) => m.id === state.activeModuleId);
          if (!module) {
          content.innerHTML = `<div class="tc-empty">Create a module to start adding cards.</div>`;
          return;
          }

          content.innerHTML = `
          <div class="tc-manage">
            <div class="tc-manage-head">
              <div class="grow">
                <strong>Manage cards</strong>
                <div class="tc-note">Module: ${escapeHtml(module.title)}</div>
              </div>
              <button class="tc-btn tc-btn-secondary" type="button" id="tc-add-row">+ Add row</button>
            </div>
            <div class="tc-table-wrap">
              <table class="tc-grid-table">
                <thead>
                  <tr>
                    <th style="width:20%;">Word</th>
                    <th style="width:20%;">Translation</th>
                    <th style="width:25%;">Example</th>
                    <th style="width:20%;">Note</th>
                    <th style="width:7%;">Order</th>
                    <th style="width:8%;">Actions</th>
                  </tr>
                </thead>
                <tbody id="tc-manage-body"></tbody>
              </table>
            </div>
            <div style="padding:10px 12px" class="tc-note">Total: ${state.filtered.length} item${state.filtered.length
              === 1 ? '' : 's'}</div>
          </div>
          `;

          const tbody = content.querySelector('#tc-manage-body');
          const rows = state.filtered.length ? state.filtered : state.cards;
          if (!rows.length) {
          tbody.innerHTML = `<tr>
            <td colspan="6">
              <div class="tc-note">No cards yet.</div>
            </td>
          </tr>`;
          } else {
          tbody.innerHTML = rows.map((card) => `
          <tr data-id="${escapeHtml(card.id)}">
            <td><input class="tc-input" data-field="word" value="${escapeHtml(card.word || '')}" /></td>
            <td><input class="tc-input" data-field="translation" value="${escapeHtml(card.translation || '')}" /></td>
            <td><textarea class="tc-textarea" data-field="example"
                style="min-height:74px;">${escapeHtml(card.example || '')}</textarea></td>
            <td><textarea class="tc-textarea" data-field="note"
                style="min-height:74px;">${escapeHtml(card.note || '')}</textarea></td>
            <td><input class="tc-input" data-field="sort_order" value="${escapeHtml(String(card.sort_order ?? 0))}" />
            </td>
            <td>
              <div class="tc-actions" style="flex-direction:column;align-items:stretch;">
                <button class="tc-btn tc-btn-primary" type="button" data-act="save">Save</button>
                <button class="tc-btn tc-btn-danger" type="button" data-act="delete">Delete</button>
              </div>
            </td>
          </tr>
          `).join('');
          }

          content.querySelector('#tc-add-row').onclick = () => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
          <td><input class="tc-input" data-field="word" placeholder="Word" /></td>
          <td><input class="tc-input" data-field="translation" placeholder="Translation" /></td>
          <td><textarea class="tc-textarea" data-field="example" style="min-height:74px;"
              placeholder="Optional example"></textarea></td>
          <td><textarea class="tc-textarea" data-field="note" style="min-height:74px;"
              placeholder="Optional note"></textarea></td>
          <td><input class="tc-input" data-field="sort_order"
              value="${escapeHtml(String((state.cards.length ? Math.max(...state.cards.map((c) => Number(c.sort_order) || 0)) : 0) + 1))}" />
          </td>
          <td>
            <div class="tc-actions" style="flex-direction:column;align-items:stretch;">
              <button class="tc-btn tc-btn-primary" type="button" data-act="create">Create</button>
              <button class="tc-btn tc-btn-secondary" type="button" data-act="cancel">Cancel</button>
            </div>
          </td>
          `;
          tbody.prepend(tr);
          tr.querySelector('[data-field="word"]').focus();
          };

tbody.addEventListener('click', async function (event) {
  const btn = event.target.closest('button');
  if (!btn) return;
  const act = btn.getAttribute('data-act');
  const tr = btn.closest('tr');
  if (!tr) return;
  const id = tr.getAttribute('data-id');

  if (act === 'save' && id) {
    await handleSaveCard(tr);
    return;
  }
  if (act === 'delete' && id) {
    await handleDeleteCard(id);
    return;
  }
  if (act === 'create') {
    await handleCreateCard(tr);
    return;
  }
  if (act === 'cancel') {
    tr.remove();
  }
});
          
          }
          function renderModulePicker() {
          const activeModule = state.modules.find((m) => m.id === state.activeModuleId) || null;
          const studentsOptions = state.students.length
          ? state.students.map((student) => {
          const label = ((student.full_name || '').trim() || student.email || 'Student') + ' — ' + (student.email ||
          '');
          return `<option value="${escapeHtml(student.id)}">${escapeHtml(label)}</option>`;
          }).join('')
          : '<option value="">No students available</option>';

          const modulesHtml = state.modules.length
          ? state.modules.map((mod) => {
          const count = state.assignmentsByModule.get(mod.id)?.length || 0;
          return `
          <button class="tc-module-item ${mod.id === state.activeModuleId ? 'active' : ''}" type="button"
            data-module-id="${escapeHtml(mod.id)}">
            <div class="tc-module-top">
              <div>
                <div class="tc-module-title">${escapeHtml(mod.title)}</div>
                <div class="tc-module-desc">${escapeHtml(mod.description || 'No description')}</div>
              </div>
              <div class="tc-tag">${count} sent</div>
            </div>
          </button>
          `;
          }).join('')
          : `<div class="tc-empty">No cards modules yet. Create your first module to send vocabulary to a student.</div>
          `;

          return `
          <div class="tc-card">
            <div class="tc-head">
              <div class="tc-kicker">Cards modules</div>
              <h2 class="tc-title" style="font-size:24px;">Teacher vocabulary modules</h2>
              <div class="tc-sub">Create cards, manage module content, and send a module to a selected student.</div>
            </div>
            <div class="tc-body">
              <div class="tc-actions" style="margin-bottom:12px;">
                <button class="tc-btn tc-btn-primary" type="button" id="tc-new-module">Create module</button>
                <button class="tc-btn tc-btn-secondary" type="button" id="tc-rename-module" ${activeModule ? ''
                  : 'disabled' }>Rename</button>
                <button class="tc-btn tc-btn-danger" type="button" id="tc-delete-module" ${activeModule ? ''
                  : 'disabled' }>Delete</button>
              </div>
              <div class="tc-module-list">${modulesHtml}</div>
            </div>
          </div>

          <div class="tc-card">
            <div class="tc-head">
              <div class="tc-kicker">Send to student</div>
              <h2 class="tc-title" style="font-size:24px;">Assign cards module</h2>
              <div class="tc-sub">Choose a linked student and send the selected cards module to their Cards tab.</div>
            </div>
            <div class="tc-body">
              <div class="tc-grid-2">
                <label class="tc-label">
                  <span>Selected module</span>
                  <div class="tc-input" style="background:#f8fbff;">${escapeHtml(activeModule?.title || 'No module selected')}</div>
                </label>
                <label class="tc-label">
                  <span>Student</span>
                  <select class="tc-select" id="tc-student-select" ${state.students.length && activeModule ? ''
                    : 'disabled' }>${studentsOptions}</select>
                </label>
              </div>
              <div class="tc-actions" style="margin-top:14px;">
                <button class="tc-btn tc-btn-primary" type="button" id="tc-send-module" ${state.students.length &&
                  activeModule ? '' : 'disabled' }>Send cards</button>
                <div class="tc-note">The student will see this module inside the Cards tab on the student dashboard.
                </div>
              </div>
            </div>
          </div>
          `;
          }

          function renderAssignmentsPanel() {
          const activeModule = state.modules.find((m) => m.id === state.activeModuleId) || null;
          const rows = state.assignmentsByModule.get(state.activeModuleId) || [];

          const listHtml = activeModule
          ? (rows.length
          ? rows.map((row) => {
          const student = state.studentsById.get(row.student_id);
          const studentLabel = (student?.full_name || '').trim() || student?.email || 'Student';
          const studentEmail = student?.email || '';
          return `
          <div class="tc-assignment-item">
            <div class="tc-assignment-top">
              <div>
                <div class="tc-assignment-title">${escapeHtml(studentLabel)}</div>
                <div class="tc-note">${escapeHtml(studentEmail)}</div>
              </div>
              <div class="tc-actions">
                <div class="tc-badge ${escapeHtml(row.status || 'not_started')}">${escapeHtml(statusLabel(row.status))}
                </div>
                <button class="tc-btn tc-btn-danger" type="button" data-action="remove-assignment"
                  data-assignment-id="${escapeHtml(row.id)}">Remove</button>
              </div>
            </div>
            <div class="tc-meta">
              <div class="tc-pill">Progress: ${escapeHtml(String(Number(row.progress_percent || 0).toFixed(0)))}%</div>
              <div class="tc-pill">Assigned: ${escapeHtml(formatDateTime(row.assigned_at))}</div>
              <div class="tc-pill">Started: ${escapeHtml(formatDateTime(row.started_at))}</div>
              <div class="tc-pill">Last opened: ${escapeHtml(formatDateTime(row.last_opened_at))}</div>
              <div class="tc-pill">Completed: ${escapeHtml(formatDateTime(row.completed_at))}</div>
            </div>
          </div>
          `;
          }).join('')
          : `<div class="tc-empty">This module has not been sent to any student yet.</div>`)
          : `<div class="tc-empty">Select or create a module first.</div>`;

          return `
          <div class="tc-card">
            <div class="tc-head">
              <div class="tc-kicker">Assigned modules</div>
              <h2 class="tc-title" style="font-size:24px;">Sent to students</h2>
              <div class="tc-sub">Track classroom cards progress for the currently selected module.</div>
            </div>
            <div class="tc-body">
              <div class="tc-assignment-list">${listHtml}</div>
            </div>
          </div>
          `;
          }

          function renderApp() {
          const root = rootEl();
          if (!root) return;

          const teacherName = ((state.teacher?.full_name || '').trim() || state.teacher?.email || 'Teacher');
          const teacherEmail = state.teacher?.email || '';
          const flashHtml = state.flash ? `<div class="${state.flash.type === 'error' ? 'tc-error' : 'tc-success'}">
            ${escapeHtml(state.flash.message)}</div>` : '';

          root.innerHTML = `
          <div class="tc-wrap">
            ${flashHtml}
            <div class="tc-card">
              <div class="tc-head">
                <div class="tc-kicker">Teacher cards</div>
                <h1 class="tc-title">Welcome, ${escapeHtml(teacherName)}</h1>
                <div class="tc-sub">Create vocabulary modules for your students and send them through the Cards tab.
                </div>
                <div class="tc-meta">
                  <div class="tc-pill">Role: teacher</div>
                  <div class="tc-pill">${state.students.length} student${state.students.length === 1 ? '' : 's'}</div>
                  <div class="tc-pill">${state.modules.length} module${state.modules.length === 1 ? '' : 's'}</div>
                  <div class="tc-pill">${escapeHtml(teacherEmail)}</div>
                </div>
              </div>
            </div>

            ${renderModulePicker()}

            <div class="tc-card">
              <div class="tc-head">
                <div class="tc-kicker">Cards study area</div>
                <h2 class="tc-title" style="font-size:24px;">${escapeHtml(state.modules.find((m) => m.id ===
                  state.activeModuleId)?.title || 'Cards')}</h2>
                <div class="tc-sub">Use Learn mode to preview your module and Manage mode to edit the content before
                  sending it.</div>
              </div>
              <div class="tc-body">
                <div class="tc-toolbar">
                  <div class="tc-switch" role="tablist" aria-label="Cards mode">
                    <button id="tc-mode-learn" type="button"
                      class="${state.mode === 'learn' ? 'active' : ''}">Learn</button>
                    <button id="tc-mode-manage" type="button"
                      class="${state.mode === 'manage' ? 'active' : ''}">Manage</button>
                  </div>
                  <button class="tc-btn tc-btn-secondary" type="button" id="tc-shuffle" ${state.mode==='learn' &&
                    state.cards.length ? '' : 'disabled' }>Shuffle</button>
                  <div class="grow"></div>
                  <input class="tc-input" id="tc-search" placeholder="Search cards…" value="${escapeHtml(state.term)}"
                    ${state.activeModuleId ? '' : 'disabled' } />
                </div>
                <div id="tc-content" style="margin-top:14px;"></div>
                <div class="tc-progress" style="margin-top:12px;">
                  <div class="tc-bar" id="tc-bar"></div>
                </div>
              </div>
            </div>

            ${renderAssignmentsPanel()}
          </div>
          `;

          bindEvents();
          if (state.mode === 'learn') renderLearn(); else renderManage();
          state.flash = null;
          }

          function bindEvents() {
          const root = rootEl();
          if (!root) return;

          root.querySelectorAll('[data-module-id]').forEach((btn) => {
          btn.onclick = async function () {
          const moduleId = btn.getAttribute('data-module-id');
          if (!moduleId || moduleId === state.activeModuleId) return;
          state.activeModuleId = moduleId;
          state.term = '';
          await fetchCardsForActiveModule();
          await fetchAssignmentsForModule(moduleId);
          renderApp();
          };
          });

          const createBtn = root.querySelector('#tc-new-module');
          if (createBtn) createBtn.onclick = handleCreateModule;

          const renameBtn = root.querySelector('#tc-rename-module');
          if (renameBtn) renameBtn.onclick = handleRenameModule;

          const deleteBtn = root.querySelector('#tc-delete-module');
          if (deleteBtn) deleteBtn.onclick = handleDeleteModule;

          const sendBtn = root.querySelector('#tc-send-module');
          if (sendBtn) sendBtn.onclick = () => handleAssignModule(sendBtn);

          root.querySelectorAll('[data-action="remove-assignment"]').forEach((btn) => {
          btn.onclick = () => handleDeleteAssignment(btn);
          });

          const learnBtn = root.querySelector('#tc-mode-learn');
          const manageBtn = root.querySelector('#tc-mode-manage');
          if (learnBtn) {
          learnBtn.onclick = function () {
          state.mode = 'learn';
          renderApp();
          };
          }
          if (manageBtn) {
          manageBtn.onclick = function () {
          state.mode = 'manage';
          renderApp();
          };
          }

          const shuffleBtn = root.querySelector('#tc-shuffle');
          if (shuffleBtn) shuffleBtn.onclick = shuffleQueue;

          const searchEl = root.querySelector('#tc-search');
          if (searchEl) {
          searchEl.oninput = function (event) {
          state.term = (event.target.value || '').trim();
          rebuildQueue(true);
          if (state.mode === 'learn') renderLearn(); else renderManage();
          };
          }
          }

          async function startApp() {
          injectStyles();
          setLoading();
          try {
          await reloadAll();
          renderApp();
          } catch (err) {
          console.error('[teacher-cards] load error:', err);
          setError(err?.message || 'Failed to load teacher cards app.');
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

          if (window.__evoAllowTeacherApp) {
          startWhenReady();
          } else {
          window.addEventListener('evo:teacher-ready', startWhenReady, { once: true });
          }
          })();