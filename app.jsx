// Project tracker app — main React component
const { useState, useEffect, useMemo, useRef, useCallback } = React;

// ---------- Constants ----------
const DEFAULT_STAGES_TPL = [
  { emoji: '🔍', label: '評估期',   en: 'Evaluation',     items: ['與客戶初步溝通', '評估技術可行性', '提出初步報價', '簽訂保密協議 (NDA)'] },
  { emoji: '📝', label: '簽約啟動', en: 'Sign-off',        items: ['確認最終合約條款', '收取訂金', '建立專案資料夾', '召開 kickoff 會議'] },
  { emoji: '🎬', label: '前期開發', en: 'Pre-production',  items: ['完成劇本／腳本', '角色設計定稿', '場景設計定稿', '分鏡與動態腳本'] },
  { emoji: '🎨', label: '美術製作', en: 'Art & Build',     items: ['偶頭與骨架製作', '服裝與道具', '場景搭建', '燈光測試'] },
  { emoji: '📷', label: '拍攝後製', en: 'Shoot & Post',    items: ['動畫主拍攝', '配音與音效', '剪輯與調色', '特效合成'] },
  { emoji: '✅', label: '交件收款', en: 'Delivery',        items: ['客戶試片會', '修改反饋處理', '母帶交付', '尾款請款'] },
];

const STAGE_EMOJIS = ['🔍','📝','🎬','🎨','📷','✂️','✨','🎙️','🎞️','📦','✅','💰','🎭','🛠️'];

// "Today" — use the real current date in production.
// Normalised to midnight so day-diff math is stable regardless of when the page loads.
const TODAY = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
})();
const uid = (p = 'x') => `${p}_${Math.random().toString(36).slice(2, 9)}`;
const fmtNT = (n) => 'NT$ ' + Math.round(n || 0).toLocaleString('en-US');
const fmtDate = (d) => {
  if (!d) return '—';
  const dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt)) return '—';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
};
const daysBetween = (a, b) => Math.ceil((b - a) / 86400000);

const makeStage = (tpl, statusOverride) => ({
  id: uid('s'),
  emoji: tpl.emoji,
  label: tpl.label,
  status: statusOverride || 'todo',
  start: '',
  end: '',
  note: '',
  items: (tpl.items || []).map(t => ({ id: uid('i'), text: t, done: false })),
});

const seed = () => {
  const mk = (data, statuses, doneItems = []) => {
    const stages = DEFAULT_STAGES_TPL.map((tpl, i) => {
      const s = makeStage(tpl, statuses[i]);
      if (statuses[i] === 'done') s.items.forEach(it => it.done = true);
      else if (statuses[i] === 'active') {
        const cnt = doneItems[i] ?? 1;
        s.items.forEach((it, idx) => { it.done = idx < cnt; });
      }
      return s;
    });
    return {
      id: uid('p'),
      archived: false,
      costsOpen: false,
      start: data.start || '2026-01-15',
      fixedMonthly: data.fixedMonthly ?? 180000,
      outsources: data.outsources || [],
      ...data,
      stages,
    };
  };
  return [
    mk(
      {
        title: '黏土廚房', client: '五十嵐 飲料品牌', budget: 580000,
        due: '2026-05-18', start: '2026-02-20', fixedMonthly: 180000,
        outsources: [
          { id: uid('o'), name: '黏土偶頭外包 — 偶 studio', type: 'company',  amount: 80000,  taxable: true },
          { id: uid('o'), name: '配樂 — 林先生',           type: 'personal', amount: 35000,  taxable: false },
          { id: uid('o'), name: '後期調色',                type: 'company',  amount: 45000,  taxable: true },
        ],
      },
      ['done','done','done','done','done','active'], [, , , , , 2]
    ),
    mk(
      {
        title: '光の手紙', client: '無印良品 台灣', budget: 850000,
        due: '2026-05-22', start: '2026-01-08', fixedMonthly: 180000,
        outsources: [
          { id: uid('o'), name: '攝影師 — 陳老師',     type: 'personal', amount: 120000, taxable: false },
          { id: uid('o'), name: '場景搭建 — 木工坊',   type: 'company',  amount: 95000,  taxable: true },
        ],
      },
      ['done','done','done','done','active','todo'], [, , , , 2]
    ),
    mk(
      {
        title: 'Coffee in Motion', client: '路易莎咖啡', budget: 420000,
        due: '2026-06-15', start: '2026-03-10', fixedMonthly: 180000,
        outsources: [
          { id: uid('o'), name: '配音員 — 王小姐', type: 'personal', amount: 18000, taxable: false },
        ],
      },
      ['done','done','done','active','todo','todo'], [, , , 2]
    ),
    mk(
      {
        title: '島嶼速寫', client: '文化部 影視局', budget: 1200000,
        due: '2026-07-30', start: '2026-04-01', fixedMonthly: 180000,
        outsources: [
          { id: uid('o'), name: '編劇顧問', type: 'personal', amount: 60000,  taxable: false },
        ],
      },
      ['done','done','active','todo','todo','todo'], [, , 1]
    ),
    mk(
      {
        title: 'Tiny Worlds', client: 'Netflix Taiwan', budget: 2400000,
        due: '2026-08-20', start: '2026-04-22', fixedMonthly: 180000,
        outsources: [],
      },
      ['done','active','todo','todo','todo','todo'], [, 2]
    ),
  ];
};

// ---------- Tweak defaults ----------
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "stageVariant": "bar",
  "panelStyle": "inline",
  "fontPair": "inter-noto",
  "accentMode": "amber",
  "density": "comfortable",
  "darkMode": false
}/*EDITMODE-END*/;

// ---------- Supabase client + data layer ----------
const SUPABASE_OK = !!(window.SUPABASE_URL && window.SUPABASE_ANON_KEY);
const supa = SUPABASE_OK
  ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY)
  : null;

// Strip transient/local-only fields before sending to DB
const toRow = (project) => {
  const { id, _position, ...data } = project;
  return data;
};

async function loadProjects() {
  const { data, error } = await supa
    .from('projects')
    .select('id, data, position')
    .order('position', { ascending: true });
  if (error) throw error;
  return (data || []).map(row => ({ ...row.data, id: row.id, _position: row.position }));
}

async function createProjectInDB(projectData) {
  // Negative timestamp so newest projects sort to the top by default
  const { data, error } = await supa
    .from('projects')
    .insert({ data: projectData, position: -Date.now() })
    .select('id, data, position')
    .single();
  if (error) throw error;
  return { ...data.data, id: data.id, _position: data.position };
}

async function saveProjectInDB(project) {
  if (!project?.id) return;
  const { error } = await supa
    .from('projects')
    .update({ data: toRow(project) })
    .eq('id', project.id);
  if (error) console.error('[saveProject] failed:', error.message);
}

async function deleteProjectInDB(id) {
  const { error } = await supa.from('projects').delete().eq('id', id);
  if (error) console.error('[deleteProject] failed:', error.message);
}

async function saveOrderInDB(orderedIds) {
  await Promise.all(orderedIds.map((id, i) =>
    supa.from('projects').update({ position: i }).eq('id', id)
  ));
}

// ---------- Celebration helpers ----------
// Stage burst: emerald-leaning, small. Project complete: warm-spectrum, big.
// Both colour sets lean warm/saturated — research on dopamine-eliciting palettes
// favours bright, varied warm tones over cool monochrome.
const STAGE_BURST_COLORS    = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#fbbf24'];
const PROJECT_BURST_COLORS  = ['#10b981', '#34d399', '#fbbf24', '#eab308', '#fb7185', '#fda4af', '#fde68a', '#fef3c7'];

function projectPct(project) {
  const total = project.stages.reduce((a, s) => a + s.items.length, 0);
  const done  = project.stages.reduce((a, s) => a + s.items.filter(it => it.done).length, 0);
  return total ? Math.round((done / total) * 100) : 0;
}

function celebrateStage(stageId) {
  if (!window.confetti) return;
  const el = document.querySelector(`[data-stage-id="${stageId}"]`);
  if (!el) return;
  const r = el.getBoundingClientRect();
  window.confetti({
    particleCount: 28,
    spread: 55,
    startVelocity: 22,
    gravity: 0.9,
    ticks: 90,
    scalar: 0.85,
    origin: {
      x: (r.left + r.width / 2) / window.innerWidth,
      y: (r.top + r.height / 2) / window.innerHeight,
    },
    colors: STAGE_BURST_COLORS,
    disableForReducedMotion: true,
  });
}

function celebrateProject(projectId) {
  if (!window.confetti) return;

  // Brief golden glow on the card itself
  const card = document.querySelector(`[data-project-id="${projectId}"]`);
  if (card) {
    card.classList.add('celebrate-flash');
    setTimeout(() => card.classList.remove('celebrate-flash'), 2400);
  }

  // Two cannons firing inward from the bottom corners — the classic
  // "confetti shot" silhouette readers instinctively recognise as victory.
  const cannonOpts = {
    spread: 70, startVelocity: 60, gravity: 0.95, ticks: 220,
    colors: PROJECT_BURST_COLORS, disableForReducedMotion: true,
  };
  window.confetti({ ...cannonOpts, particleCount: 90, angle: 60,  origin: { x: 0, y: 0.85 } });
  window.confetti({ ...cannonOpts, particleCount: 90, angle: 120, origin: { x: 1, y: 0.85 } });

  // Top shower drifts down a beat later
  setTimeout(() => {
    window.confetti({
      particleCount: 130, spread: 360, startVelocity: 35,
      gravity: 0.7, ticks: 260, scalar: 1.1,
      origin: { x: 0.5, y: 0.25 },
      colors: PROJECT_BURST_COLORS, disableForReducedMotion: true,
    });
  }, 280);

  // Second wave of cannons rounds it out
  setTimeout(() => {
    window.confetti({ ...cannonOpts, particleCount: 70, angle: 60,  spread: 90, origin: { x: 0, y: 0.7 } });
    window.confetti({ ...cannonOpts, particleCount: 70, angle: 120, spread: 90, origin: { x: 1, y: 0.7 } });
  }, 700);
}

// ---------- Components ----------
function CompletionRing({ pct }) {
  const r = 22, c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  return (
    <div className="completion">
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle className="track" cx="28" cy="28" r={r} fill="none" strokeWidth="3" />
        <circle className="fill" cx="28" cy="28" r={r} fill="none" strokeWidth="3"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
      </svg>
      <div className="completion-text">{pct}%</div>
    </div>
  );
}

function StageBar({ variant, stages, selectedStageId, onClick, onCycle, onInsert, onDelete }) {
  return (
    <div className={`stage-bar variant-${variant}`}>
      {stages.map((s, i) => {
        const cls = `segment status-${s.status} ${selectedStageId === s.id ? 'selected' : ''} ${s.status === 'done' ? 'shrunk' : ''} ${s.status === 'active' ? 'expanded' : ''}`;
        const handleClick = (e) => {
          if (e.shiftKey) onCycle(s.id);
          else onClick(s.id);
        };
        const segBody = variant === 'dots' ? (
          <button key={s.id} className={cls} data-stage-id={s.id} onClick={handleClick} title={`${s.label} — Shift+點擊切換狀態`}>
            <div className="dot"><span className="emoji">{s.emoji}</span></div>
            <span className="seg-label">{s.label}</span>
          </button>
        ) : variant === 'blocks' ? (
          <button key={s.id} className={cls} data-stage-id={s.id} onClick={handleClick} title={`${s.label} — Shift+點擊切換狀態`}>
            <span className="status-pip"></span>
            <span className="emoji">{s.emoji}</span>
            <span className="seg-label">{s.label}</span>
          </button>
        ) : (
          <button key={s.id} className={cls} data-stage-id={s.id} onClick={handleClick} title={`${s.label} — Shift+點擊切換狀態`}>
            <span className="emoji">{s.emoji}</span>
            <span className="seg-label">{s.label}</span>
          </button>
        );

        return (
          <React.Fragment key={s.id}>
            {i === 0 && <InsertGap onInsert={() => onInsert(0)} />}
            {segBody}
            <InsertGap onInsert={() => onInsert(i + 1)} />
          </React.Fragment>
        );
      })}
    </div>
  );
}

function InsertGap({ onInsert }) {
  return (
    <div className="insert-gap" onClick={(e) => { e.stopPropagation(); onInsert(); }} title="於此處插入新階段">
      <span className="insert-plus">+</span>
    </div>
  );
}

function ChecklistEditor({ stage, onUpdate }) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  const toggle = (id) => {
    const items = stage.items.map(it => it.id === id ? { ...it, done: !it.done } : it);
    // Auto-advance status from checklist progress
    let status = stage.status;
    const allDone = items.length > 0 && items.every(it => it.done);
    const anyDone = items.some(it => it.done);
    if (allDone) status = 'done';
    else if (status === 'done' && !allDone) status = 'active';
    else if (status === 'todo' && anyDone) status = 'active';
    onUpdate({ ...stage, items, status });
  };
  const remove = (id) => {
    onUpdate({ ...stage, items: stage.items.filter(it => it.id !== id) });
  };
  const add = (e) => {
    e?.preventDefault();
    if (!draft.trim()) return;
    onUpdate({
      ...stage,
      items: [...stage.items, { id: uid('i'), text: draft.trim(), done: false }]
    });
    setDraft('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const doneCount = stage.items.filter(it => it.done).length;

  return (
    <div className="detail-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="section-label">檢查清單</div>
        <div className="stage-progress-mini">{doneCount} / {stage.items.length}</div>
      </div>
      <div className="checklist">
        {stage.items.map(it => (
          <div key={it.id} className={`check-item ${it.done ? 'checked' : ''}`}>
            <div className={`check-box ${it.done ? 'checked' : ''}`} onClick={() => toggle(it.id)} role="checkbox" aria-checked={it.done}></div>
            {it.editing ? (
              <input className="input check-edit" autoFocus defaultValue={it.text}
                onBlur={(e) => onUpdate({ ...stage, items: stage.items.map(x => x.id === it.id ? { ...x, text: e.target.value || x.text, editing: false } : x) })}
                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') onUpdate({ ...stage, items: stage.items.map(x => x.id === it.id ? { ...x, editing: false } : x) }); }}
              />
            ) : (
              <div className="check-text" onClick={() => toggle(it.id)} onDoubleClick={() => onUpdate({ ...stage, items: stage.items.map(x => x.id === it.id ? { ...x, editing: true } : x) })} title="點擊勾選 / 雙擊編輯">{it.text}</div>
            )}
            {it.link ? (
              <a href={it.link} target="_blank" rel="noopener noreferrer" className="item-link" title={it.link}>↗</a>
            ) : null}
            <button className="item-link-btn" title={it.link ? '編輯連結' : '加入連結'} onClick={() => {
              const v = prompt('貼上該項目的成果連結（留空可移除）：', it.link || '');
              if (v === null) return;
              onUpdate({ ...stage, items: stage.items.map(x => x.id === it.id ? { ...x, link: v.trim() || null } : x) });
            }}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M6 8a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5L7 3.5M8 6a2.5 2.5 0 0 0-3.5 0l-2 2a2.5 2.5 0 0 0 3.5 3.5L7 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
            </button>
            <button className="delete-item" onClick={() => remove(it.id)} title="刪除">×</button>
          </div>
        ))}
      </div>
      <form className="add-item-row" onSubmit={add}>
        <input
          ref={inputRef}
          className="input"
          placeholder="新增檢查項目…"
          value={draft}
          onChange={e => setDraft(e.target.value)}
        />
        <button type="submit" className="add-item-btn" aria-label="新增">+</button>
      </form>
    </div>
  );
}

function StageDetail({ project, stageId, onClose, onUpdateStage, onDeleteStage, closeAsArrow = true }) {
  const stage = project.stages.find(s => s.id === stageId);
  if (!stage) return null;

  const update = (patch) => onUpdateStage(project.id, stageId, { ...stage, ...patch });
  const setStatus = (status) => {
    let items = stage.items;
    if (status === 'done') items = items.map(it => ({ ...it, done: true }));
    if (status === 'todo') items = items.map(it => ({ ...it, done: false }));
    update({ status, items });
  };
  // mark autoNote when items fully done
  const allDone = stage.items.length > 0 && stage.items.every(it => it.done);

  const [renaming, setRenaming] = useState(false);
  const [labelDraft, setLabelDraft] = useState(stage.label);

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div style={{ minWidth: 0 }}>
          <div className="detail-eyebrow">{project.title} · 階段</div>
          <h3 className="detail-title">
            <span className="emoji">{stage.emoji}</span>
            {renaming ? (
              <input
                className="input title-input"
                value={labelDraft}
                autoFocus
                onChange={e => setLabelDraft(e.target.value)}
                onBlur={() => { setRenaming(false); if (labelDraft.trim()) update({ label: labelDraft.trim() }); }}
                onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { setLabelDraft(stage.label); setRenaming(false); } }}
              />
            ) : (
              <span onClick={() => setRenaming(true)} className="rename-target" title="點擊重新命名">{stage.label}</span>
            )}
          </h3>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="close-btn" onClick={() => { if (confirm(`確定刪除「${stage.label}」階段？`)) onDeleteStage(project.id, stageId); }} aria-label="刪除階段" title="刪除這個階段">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 4h8M5.5 4V2.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1V4M4 4l.5 7a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1L10 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button className="close-btn" onClick={onClose} aria-label="收折" title={closeAsArrow ? '收折 (Esc)' : '關閉 (Esc)'}>
            {closeAsArrow ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 5.5l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            ) : '×'}
          </button>
        </div>
      </div>

      <div className="detail-section">
        <div className="section-label">狀態</div>
        <div className="status-toggle">
          <button className={`${stage.status === 'todo' ? 'active todo' : ''}`} onClick={() => setStatus('todo')}>未開始</button>
          <button className={`${stage.status === 'active' ? 'active active' : ''}`} onClick={() => setStatus('active')}>進行中</button>
          <button className={`${stage.status === 'done' ? 'active done' : ''}`} onClick={() => setStatus('done')}>已完成</button>
        </div>
        <div className="date-grid" style={{ marginTop: 8 }}>
          <div className="field">
            <label className="field-label">開始日期</label>
            <input type="date" className="date-input" value={stage.start} onChange={e => update({ start: e.target.value })} />
          </div>
          <div className="field">
            <label className="field-label">結束日期</label>
            <input type="date" className="date-input" value={stage.end} onChange={e => update({ end: e.target.value })} />
          </div>
        </div>
      </div>

      <ChecklistEditor stage={stage} onUpdate={(s) => onUpdateStage(project.id, stageId, s)} />

      <div className="detail-section" style={{ gridColumn: '1 / -1' }}>
        <div className="section-label">備註</div>
        <textarea
          className="textarea"
          placeholder="記下這個階段需要注意的事情、客戶的反饋、卡點……"
          value={stage.note}
          onChange={e => update({ note: e.target.value })}
        />
      </div>
    </div>
  );
}

// ---------- Info Panel ----------
function InfoPanel({ project, onUpdate }) {
  const update = (patch) => onUpdate({ ...project, ...patch });
  const refs = project.references || [];
  const addRef = () => update({ references: [...refs, { id: uid('r'), label: '', url: '' }] });
  const updRef = (id, patch) => update({ references: refs.map(r => r.id === id ? { ...r, ...patch } : r) });
  const rmRef = (id) => update({ references: refs.filter(r => r.id !== id) });
  return (
    <div className="info-panel">
      <div className="cost-header" style={{ paddingBottom: 0, borderBottom: 'none' }}>
        <div>
          <div className="detail-eyebrow">{project.title} · 作品介紹</div>
          <h3 className="detail-title">📖 專案資訊</h3>
        </div>
      </div>
      <div className="info-grid">
        <div className="field">
          <label className="field-label">專案故事</label>
          <textarea className="textarea" placeholder="這支案子的緣起、概念、想說的故事……"
            value={project.story || ''} onChange={e => update({ story: e.target.value })} />
        </div>
        <div className="field">
          <label className="field-label">客戶需求</label>
          <textarea className="textarea" placeholder="客戶的目標、目標族群、必須達成的事項……"
            value={project.clientNeeds || ''} onChange={e => update({ clientNeeds: e.target.value })} />
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label className="field-label">創作目的</label>
          <textarea className="textarea" placeholder="這支作品想傳達的核心、藝術上的企圖……"
            value={project.purpose || ''} onChange={e => update({ purpose: e.target.value })} />
        </div>
      </div>
      <div className="cost-section">
        <div className="cost-section-h">
          <div className="cost-block-h"><span className="block-emoji">🔗</span><span>參考連結</span></div>
          <button className="btn btn-ghost small" onClick={addRef}>+ 新增連結</button>
        </div>
        {refs.length === 0 && <div className="empty-row" style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 10 }}>尚無參考連結。</div>}
        {refs.length > 0 && (
          <div className="outsource-list">
            {refs.map(r => (
              <div key={r.id} className="ref-row">
                <input className="input" placeholder="名稱（例：客戶 brief、Mood board）" value={r.label} onChange={e => updRef(r.id, { label: e.target.value })} />
                <input className="input" placeholder="https://…" value={r.url} onChange={e => updRef(r.id, { url: e.target.value })} />
                {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="open-link" title="開啟">↗</a>}
                <button className="delete-item visible" onClick={() => rmRef(r.id)} title="刪除">×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Cost Panel ----------
function calcCosts(project) {
  const start = project.start ? new Date(project.start) : null;
  const due = project.due ? new Date(project.due) : null;
  const days = (start && due && !isNaN(start) && !isNaN(due)) ? Math.max(1, daysBetween(start, due)) : 0;
  const months = days / 30;
  const fixedCost = (project.fixedMonthly || 0) * months;

  let outsourceTotal = 0;
  let creditableInputTax = 0;
  let companyOutsource = 0;
  let personalOutsource = 0;
  (project.outsources || []).forEach(o => {
    outsourceTotal += Number(o.amount) || 0;
    if (o.type === 'company') companyOutsource += Number(o.amount) || 0;
    else personalOutsource += Number(o.amount) || 0;
    if (o.taxable) creditableInputTax += (Number(o.amount) || 0) * 0.05;
  });

  const salesVAT = (project.budget || 0) * 0.05;
  const netVAT = Math.max(0, salesVAT - creditableInputTax);
  const profit = (project.budget || 0) - fixedCost - outsourceTotal - netVAT;

  return { days, months, fixedCost, outsourceTotal, companyOutsource, personalOutsource, salesVAT, creditableInputTax, netVAT, profit };
}

function CostPanel({ project, onUpdate }) {
  const c = useMemo(() => calcCosts(project), [project]);
  const update = (patch) => onUpdate({ ...project, ...patch });

  const addOutsource = () => {
    update({ outsources: [...(project.outsources || []), { id: uid('o'), name: '', type: 'company', amount: 0, taxable: true }] });
  };
  const updateOutsource = (id, patch) => {
    update({ outsources: project.outsources.map(o => o.id === id ? { ...o, ...patch } : o) });
  };
  const removeOutsource = (id) => {
    update({ outsources: project.outsources.filter(o => o.id !== id) });
  };

  const profitPct = project.budget ? Math.round((c.profit / project.budget) * 100) : 0;

  return (
    <div className="cost-panel">
      <div className="cost-header">
        <div>
          <div className="detail-eyebrow">{project.title} · 成本結構</div>
          <h3 className="detail-title">💰 財務概覽</h3>
        </div>
        <div className="cost-summary">
          <div className="summary-item">
            <div className="summary-label">合約金額</div>
            <div className="summary-value">{fmtNT(project.budget)}</div>
          </div>
          <div className="summary-item">
            <div className="summary-label">總成本</div>
            <div className="summary-value">{fmtNT(c.fixedCost + c.outsourceTotal + c.netVAT)}</div>
          </div>
          <div className={`summary-item profit ${c.profit < 0 ? 'negative' : ''}`}>
            <div className="summary-label">淨利</div>
            <div className="summary-value">{fmtNT(c.profit)} <span className="pct">{profitPct}%</span></div>
          </div>
        </div>
      </div>

      <div className="cost-grid">
        {/* Fixed cost */}
        <div className="cost-block">
          <div className="cost-block-h">
            <span className="block-emoji">🏢</span>
            <span>公司固定成本</span>
          </div>
          <div className="cost-row-line">
            <span>每月固定支出</span>
            <input type="number" className="num-input"
              value={project.fixedMonthly || 0}
              onChange={e => update({ fixedMonthly: Number(e.target.value) })} />
          </div>
          <div className="cost-row-line">
            <span>專案起始</span>
            <input type="date" className="date-input compact"
              value={project.start || ''}
              onChange={e => update({ start: e.target.value })} />
          </div>
          <div className="cost-row-line">
            <span>跨期天數</span>
            <span className="num-val">{c.days} 天 ({c.months.toFixed(1)} 月)</span>
          </div>
          <div className="cost-row-line emphasis">
            <span>分攤成本</span>
            <span className="num-val">{fmtNT(c.fixedCost)}</span>
          </div>
        </div>

        {/* Tax */}
        <div className="cost-block">
          <div className="cost-block-h">
            <span className="block-emoji">🧾</span>
            <span>稅務</span>
          </div>
          <div className="cost-row-line">
            <span>銷項稅 (5%)</span>
            <span className="num-val">{fmtNT(c.salesVAT)}</span>
          </div>
          <div className="cost-row-line">
            <span>可抵扣進項稅</span>
            <span className="num-val">− {fmtNT(c.creditableInputTax)}</span>
          </div>
          <div className="cost-row-line emphasis">
            <span>應繳營業稅</span>
            <span className="num-val">{fmtNT(c.netVAT)}</span>
          </div>
          <div className="tax-hint">公司外包可抵 5% 進項稅，個人外包無發票故不可抵</div>
        </div>
      </div>

      {/* Outsource list */}
      <div className="cost-section">
        <div className="cost-section-h">
          <div className="cost-block-h">
            <span className="block-emoji">🤝</span>
            <span>外包支出</span>
            <span className="ghost-pill">公司 {fmtNT(c.companyOutsource)}</span>
            <span className="ghost-pill">個人 {fmtNT(c.personalOutsource)}</span>
          </div>
          <button className="btn btn-ghost small" onClick={addOutsource}>+ 新增外包項目</button>
        </div>

        <div className="outsource-list">
          <div className="outsource-row head">
            <div>項目名稱</div>
            <div>類型</div>
            <div>金額</div>
            <div className="center">可抵稅</div>
            <div></div>
          </div>
          {(project.outsources || []).length === 0 && (
            <div className="empty-row">尚無外包支出。點上方按鈕新增。</div>
          )}
          {(project.outsources || []).map(o => (
            <div key={o.id} className="outsource-row">
              <input className="input" placeholder="例：偶頭外包"
                value={o.name}
                onChange={e => updateOutsource(o.id, { name: e.target.value })} />
              <div className="type-toggle">
                <button className={o.type === 'company' ? 'on' : ''} onClick={() => updateOutsource(o.id, { type: 'company', taxable: true })}>公司</button>
                <button className={o.type === 'personal' ? 'on' : ''} onClick={() => updateOutsource(o.id, { type: 'personal', taxable: false })}>個人</button>
              </div>
              <input type="number" className="num-input"
                value={o.amount}
                onChange={e => updateOutsource(o.id, { amount: Number(e.target.value) })} />
              <div className="center">
                <div className={`check-box ${o.taxable ? 'checked' : ''} ${o.type === 'personal' ? 'disabled' : ''}`}
                  onClick={() => { if (o.type === 'company') updateOutsource(o.id, { taxable: !o.taxable }); }}
                  title={o.type === 'personal' ? '個人外包無法抵稅' : '可抵扣 5% 進項稅'}>
                </div>
              </div>
              <button className="delete-item visible" onClick={() => removeOutsource(o.id)} title="刪除">×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Project Card ----------
function ProjectCard({ project, expandedStageId, costsOpen, onStageClick, onCycleStage, onCloseDetail, onUpdateStage, onDeleteStage, onInsertStage, onUpdateProject, onDeleteProject, onArchive, onRestore, onPurgeProject, density, stageVariant, dragHandleProps, dropTargetProps, isDragging, isOver, panelStyle }) {
  const due = new Date(project.due);
  const days = daysBetween(TODAY, due);
  const warn = days <= 14 && days >= 0;

  const totalItems = project.stages.reduce((a, s) => a + s.items.length, 0);
  const doneItems = project.stages.reduce((a, s) => a + s.items.filter(it => it.done).length, 0);
  const pct = totalItems ? Math.round((doneItems / totalItems) * 100) : 0;
  const canArchive = pct === 100;

  // current stage = first 'active', else last 'done', else first
  const currentStage = project.stages.find(s => s.status === 'active')
    || [...project.stages].reverse().find(s => s.status === 'done')
    || project.stages[0];

  return (
    <div
      className={`card ${density === 'dense' ? 'dense' : ''} ${isDragging ? 'dragging' : ''} ${isOver ? 'drag-over' : ''} ${canArchive ? 'celebrate' : ''}`}
      data-screen-label={project.title}
      data-project-id={project.id}
      {...dropTargetProps}
    >
      <div className="stage-tag-wrap" aria-hidden="false">
        <div className="stage-tag">{currentStage.label}</div>
      </div>
      <div className="card-actions-abs">
        {project.deleted ? (
          <>
            <button className="card-action restore" onClick={() => onRestore(project.id)} title="復原">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7a4 4 0 1 1 1.2 2.8M3 5v2h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              復原
            </button>
            <button className="card-action danger" onClick={() => { if (confirm(`彻底刪除「${project.title}」？此動作無法復原。`)) onPurgeProject(project.id); }} title="彻底刪除">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 4h8M5.5 4V2.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1V4M4 4l.5 7a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1L10 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </>
        ) : (
          <>
            {canArchive && (
              <button className="card-action archive-cta" onClick={() => onArchive(project.id)} title="專案已完成，移到已歸檔">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10v2H2zM3 6v5h8V6M5.5 8h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                歸檔
              </button>
            )}
            <button className={`card-action ${project.infoOpen ? 'on' : ''}`} onClick={() => onUpdateProject(project.id, { infoOpen: !project.infoOpen, costsOpen: false })} title="專案資訊">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/><path d="M7 6v4M7 4v.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            </button>
            <button className={`card-action ${project.costsOpen ? 'on' : ''}`} onClick={() => onUpdateProject(project.id, { costsOpen: !project.costsOpen, infoOpen: false })} title="財務細節">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M3.5 3.5h5a2 2 0 1 1 0 4h-3a2 2 0 1 0 0 4h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
            </button>
            <button className="card-action danger" onClick={() => onDeleteProject(project.id)} title="移到垃圾桶（可從垃圾桶分頁復原）">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 4h8M5.5 4V2.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1V4M4 4l.5 7a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1L10 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </>
        )}
      </div>
      <div className="card-row">
        <div className="drag-handle" title="拖曳排序" {...dragHandleProps}></div>

        <div className="card-main">
          <div className="card-header">
            <div className="project-title">{project.title}</div>
            <div className="client-name">{project.client}</div>
          </div>
          <div className="card-meta">
            <div className="meta-item">
              <span className="meta-label">金額</span>
              <span className="meta-value">{fmtNT(project.budget)}</span>
            </div>
            <span className="sep">·</span>
            <div className="meta-item">
              <span className="meta-label">起始</span>
              <span className="meta-value muted">{fmtDate(project.start)}</span>
            </div>
            <span className="sep">·</span>
            <div className="meta-item">
              <span className="meta-label">外包</span>
              <span className="meta-value">{(project.outsources || []).length} 筆</span>
            </div>
          </div>
        </div>

        <div className="card-right">
          <div className={`countdown ${warn ? 'warn' : ''}`}>
            <div className="countdown-num">
              {days < 0 ? `+${Math.abs(days)}` : days}<span className="unit">{days < 0 ? '天逾期' : '天'}</span>
            </div>
            <div className="countdown-label">
              <span className="due-date">{fmtDate(project.due)}</span>
              <span className="due-sep">·</span>
              <span>{warn ? '緊急' : '距交件'}</span>
            </div>
          </div>
          <CompletionRing pct={pct} />
        </div>
      </div>

      <StageBar
        variant={stageVariant}
        stages={project.stages}
        selectedStageId={expandedStageId}
        onClick={(sid) => onStageClick(sid)}
        onCycle={(sid) => onCycleStage(project.id, sid)}
        onInsert={(idx) => onInsertStage(project.id, idx)}
      />

      {expandedStageId && panelStyle === 'inline' && (
        <StageDetail
          project={project}
          stageId={expandedStageId}
          onClose={onCloseDetail}
          onUpdateStage={onUpdateStage}
          onDeleteStage={onDeleteStage}
        />
      )}

      {project.infoOpen && (
        <InfoPanel project={project} onUpdate={(p) => onUpdateProject(project.id, p)} />
      )}

      {project.costsOpen && (
        <CostPanel project={project} onUpdate={(p) => onUpdateProject(project.id, p)} />
      )}
    </div>
  );
}

function NewProjectModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ title: '', client: '', budget: '', due: '' });
  const titleRef = useRef(null);
  useEffect(() => { titleRef.current?.focus(); }, []);

  const valid = form.title.trim() && form.client.trim() && form.budget && form.due;

  const submit = (e) => {
    e.preventDefault();
    if (!valid) return;
    onCreate({
      title: form.title.trim(),
      client: form.client.trim(),
      budget: Number(form.budget),
      due: form.due,
    });
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h2>新增專案</h2>
        <div className="modal-sub">系統會自動建立六個標準階段與預設檢查項目</div>
        <form className="modal-form" onSubmit={submit}>
          <div className="field">
            <label className="field-label">專案名稱</label>
            <input ref={titleRef} className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="例：黏土廚房" />
          </div>
          <div className="field">
            <label className="field-label">客戶名稱</label>
            <input className="input" value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} placeholder="例：五十嵐 飲料品牌" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label className="field-label">金額 (NT$)</label>
              <input className="input" type="number" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} placeholder="500000" />
            </div>
            <div className="field">
              <label className="field-label">交件日期</label>
              <input className="date-input" type="date" value={form.due} onChange={e => setForm({ ...form, due: e.target.value })} />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>取消 (Esc)</button>
            <button type="submit" className="btn btn-primary" disabled={!valid}>建立專案</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- Login screen ----------
function LoginScreen({ onSignedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const { data, error } = await supa.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    onSignedIn?.(data.session);
  };

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <div className="studio-mark" style={{ marginBottom: 18 }}>
          <span className="dot"></span>
          STOP MOTION STUDIO · EST. 2018
        </div>
        <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 600, letterSpacing: '-0.025em' }}>
          Jordan Tseng <span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: 18 }}>／ 進度追蹤器</span>
        </h1>
        <p style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 0, marginBottom: 24 }}>
          請登入以繼續
        </p>
        <div className="field" style={{ marginBottom: 12 }}>
          <label className="field-label">Email</label>
          <input className="input" type="email" autoComplete="username"
            value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
        </div>
        <div className="field" style={{ marginBottom: 18 }}>
          <label className="field-label">密碼</label>
          <input className="input" type="password" autoComplete="current-password"
            value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        {error && (
          <div className="login-error">{error}</div>
        )}
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center', height: 42 }}>
          {busy ? '登入中…' : '登入'}
        </button>
      </form>
    </div>
  );
}

// ---------- Splash / setup screens ----------
function SplashScreen({ message }) {
  return (
    <div className="login-shell">
      <div className="login-card" style={{ textAlign: 'center', color: 'var(--text-3)' }}>
        {message || '載入中…'}
      </div>
    </div>
  );
}

function ConfigMissingScreen() {
  return (
    <div className="login-shell">
      <div className="login-card">
        <h1 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 600 }}>⚠️ 尚未設定 Supabase</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 13.5, lineHeight: 1.6 }}>
          請打開 <code style={{ background: 'var(--bg-sunken)', padding: '2px 6px', borderRadius: 4 }}>config.js</code>，
          填入你的 <strong>Project URL</strong> 與 <strong>anon key</strong>，然後重新整理頁面。
        </p>
      </div>
    </div>
  );
}

// ---------- Main app (auth wrapper) ----------
function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (!SUPABASE_OK) { setAuthReady(true); return; }
    supa.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supa.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!SUPABASE_OK) return <ConfigMissingScreen />;
  if (!authReady) return <SplashScreen />;
  if (!session) return <LoginScreen onSignedIn={setSession} />;
  return <Tracker session={session} onSignOut={() => supa.auth.signOut()} />;
}

function Tracker({ session, onSignOut }) {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [projects, setProjects] = useState([]);
  const [dataReady, setDataReady] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [tab, setTab] = useState('active'); // 'active' | 'archived'
  const [expanded, setExpanded] = useState(null); // { projectId, stageId }
  const [showNew, setShowNew] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  // Load projects from Supabase on mount
  useEffect(() => {
    let cancelled = false;
    loadProjects()
      .then(rows => { if (!cancelled) { setProjects(rows); setDataReady(true); } })
      .catch(err => { if (!cancelled) { setLoadError(err.message); setDataReady(true); } });
    return () => { cancelled = true; };
  }, []);

  // Celebration: detect completion transitions between renders.
  // prevProjectsRef stays null until the first ready render, so we don't
  // fire confetti for projects that loaded already-completed from the DB.
  const prevProjectsRef = useRef(null);
  useEffect(() => {
    if (!dataReady) return;
    const prev = prevProjectsRef.current;
    prevProjectsRef.current = projects;
    if (prev === null) return; // first ready render — skip

    for (const np of projects) {
      const op = prev.find(p => p.id === np.id);
      if (!op) continue; // brand-new project, nothing to compare

      const oldPct = projectPct(op);
      const newPct = projectPct(np);

      if (oldPct < 100 && newPct === 100) {
        // Project just hit 100 — supersedes any individual stage bursts
        // (otherwise the same click would fire several effects at once).
        celebrateProject(np.id);
        continue;
      }

      for (const ns of np.stages) {
        const os = op.stages.find(s => s.id === ns.id);
        if (!os) continue;
        if (os.status !== 'done' && ns.status === 'done') celebrateStage(ns.id);
      }
    }
  }, [projects, dataReady]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', t.darkMode ? 'dark' : 'light');
  }, [t.darkMode]);

  useEffect(() => {
    const fontMap = {
      'inter-noto': ['Inter', 'Noto Sans TC'],
      'plex': ['IBM Plex Sans', 'IBM Plex Sans TC'],
      'zen': ['Inter', 'Zen Kaku Gothic New'],
      'space': ['Space Grotesk', 'Noto Sans TC'],
    };
    const [ui, cjk] = fontMap[t.fontPair] || fontMap['inter-noto'];
    document.documentElement.style.setProperty('--font-sans', `'${ui}', '${cjk}', -apple-system, system-ui, sans-serif`);
    document.documentElement.style.setProperty('--font-display', `'${ui}', '${cjk}', sans-serif`);
  }, [t.fontPair]);

  useEffect(() => {
    const map = {
      amber:    { active: '#eab308', activeFg: '#5c3d00', warn: '#ef4444' },
      orange:   { active: '#d97706', activeFg: '#3a1c00', warn: '#dc2626' },
      muted:    { active: '#b45309', activeFg: '#1f0e00', warn: '#b91c1c' },
    };
    const a = map[t.accentMode] || map.amber;
    document.documentElement.style.setProperty('--stage-active', a.active);
    document.documentElement.style.setProperty('--stage-active-fg', a.activeFg);
    document.documentElement.style.setProperty('--warn', a.warn);
  }, [t.accentMode]);

  useEffect(() => {
    const handler = (e) => {
      const inField = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
      if (e.key === 'Escape') {
        if (showNew) setShowNew(false);
        else if (expanded) setExpanded(null);
      }
      if (!inField && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); setShowNew(true); }
      if (!inField && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); setTweak('darkMode', !t.darkMode); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showNew, expanded, t.darkMode]);

  useEffect(() => { const id = setTimeout(() => setShowHint(false), 8000); return () => clearTimeout(id); }, []);

  // ---- Project ops ----
  // All ops are optimistic: update local state immediately, persist to DB in background.
  const onUpdateProject = (id, patch) => {
    setProjects(prev => {
      const next = prev.map(p => p.id === id ? { ...p, ...patch } : p);
      const changed = next.find(p => p.id === id);
      if (changed) saveProjectInDB(changed);
      return next;
    });
  };
  const onDeleteProject = (id) => {
    setProjects(prev => {
      const next = prev.map(p => p.id === id ? { ...p, deleted: true, deletedAt: Date.now(), archived: false, costsOpen: false, infoOpen: false } : p);
      const changed = next.find(p => p.id === id);
      if (changed) saveProjectInDB(changed);
      return next;
    });
    if (expanded?.projectId === id) setExpanded(null);
  };
  const onPurgeProject = (id) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    deleteProjectInDB(id);
    if (expanded?.projectId === id) setExpanded(null);
  };
  const onRestoreProject = (id) => onUpdateProject(id, { deleted: false, deletedAt: null });
  const onArchive = (id) => {
    setProjects(prev => {
      const next = prev.map(p => p.id === id ? { ...p, archived: true, costsOpen: false, infoOpen: false } : p);
      const changed = next.find(p => p.id === id);
      if (changed) saveProjectInDB(changed);
      return next;
    });
    if (expanded?.projectId === id) setExpanded(null);
  };
  const onUnarchive = (id) => onUpdateProject(id, { archived: false });

  // ---- Stage ops ----
  const onStageClick = (projectId, stageId) => {
    if (expanded && expanded.projectId === projectId && expanded.stageId === stageId) setExpanded(null);
    else setExpanded({ projectId, stageId });
  };
  const onCycleStage = (projectId, stageId) => {
    const order = ['todo', 'active', 'done'];
    setProjects(prev => {
      const next = prev.map(p => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          stages: p.stages.map(s => {
            if (s.id !== stageId) return s;
            const nx = order[(order.indexOf(s.status) + 1) % 3];
            const items = s.items.map(it => ({ ...it, done: nx === 'done' ? true : (nx === 'todo' ? false : it.done) }));
            return { ...s, status: nx, items };
          }),
        };
      });
      const changed = next.find(p => p.id === projectId);
      if (changed) saveProjectInDB(changed);
      return next;
    });
  };
  const onUpdateStage = (projectId, stageId, newStage) => {
    setProjects(prev => {
      const next = prev.map(p => p.id === projectId ? { ...p, stages: p.stages.map(s => s.id === stageId ? newStage : s) } : p);
      const changed = next.find(p => p.id === projectId);
      if (changed) saveProjectInDB(changed);
      return next;
    });
  };
  const onDeleteStage = (projectId, stageId) => {
    setProjects(prev => {
      const next = prev.map(p => p.id === projectId ? { ...p, stages: p.stages.filter(s => s.id !== stageId) } : p);
      const changed = next.find(p => p.id === projectId);
      if (changed) saveProjectInDB(changed);
      return next;
    });
    if (expanded?.stageId === stageId) setExpanded(null);
  };
  const onInsertStage = (projectId, atIdx) => {
    const newStage = makeStage({ emoji: '✨', label: '新階段', items: ['新增第一項'] }, 'todo');
    setProjects(prev => {
      const next = prev.map(p => {
        if (p.id !== projectId) return p;
        const list = [...p.stages];
        list.splice(atIdx, 0, newStage);
        return { ...p, stages: list };
      });
      const changed = next.find(p => p.id === projectId);
      if (changed) saveProjectInDB(changed);
      return next;
    });
    setExpanded({ projectId, stageId: newStage.id });
  };

  const onCreate = async (data) => {
    const stages = DEFAULT_STAGES_TPL.map(tpl => makeStage(tpl));
    const projectData = {
      archived: false,
      costsOpen: false,
      start: new Date(TODAY).toISOString().slice(0, 10),
      fixedMonthly: 180000,
      outsources: [],
      ...data,
      stages,
    };
    try {
      const created = await createProjectInDB(projectData);
      setProjects(prev => [created, ...prev]);
      setShowNew(false);
    } catch (err) {
      alert('建立失敗：' + err.message);
    }
  };

  // Drag handlers
  const onDragStart = (id) => (e) => { setDragId(id); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', id); } catch {} };
  const onDragOver = (id) => (e) => { e.preventDefault(); if (dragId && dragId !== id) setDragOverId(id); };
  const onDragLeave = () => setDragOverId(null);
  const onDrop = (id) => (e) => {
    e.preventDefault();
    if (!dragId || dragId === id) { setDragId(null); setDragOverId(null); return; }
    setProjects(prev => {
      const list = [...prev];
      const from = list.findIndex(p => p.id === dragId);
      const to = list.findIndex(p => p.id === id);
      if (from < 0 || to < 0) return prev;
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      // Persist new order to DB (fire-and-forget)
      saveOrderInDB(list.map(p => p.id));
      return list;
    });
    setDragId(null); setDragOverId(null);
  };
  const onDragEnd = () => { setDragId(null); setDragOverId(null); };

  const activeProjects = projects.filter(p => !p.archived && !p.deleted);
  const archivedProjects = projects.filter(p => p.archived && !p.deleted);
  const deletedProjects = projects.filter(p => p.deleted);
  const visible = tab === 'active' ? activeProjects : tab === 'archived' ? archivedProjects : deletedProjects;

  const totalBudget = activeProjects.reduce((a, p) => a + p.budget, 0);
  const urgentCount = activeProjects.filter(p => {
    const d = daysBetween(TODAY, new Date(p.due));
    return d >= 0 && d <= 14;
  }).length;
  const totalProfit = activeProjects.reduce((a, p) => a + calcCosts(p).profit, 0);

  const expandedProj = expanded ? projects.find(p => p.id === expanded.projectId) : null;

  if (!dataReady) return <SplashScreen message="載入專案中…" />;
  if (loadError) return <SplashScreen message={`讀取失敗：${loadError}`} />;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="studio-mark">
            <span className="dot"></span>
            STOP MOTION STUDIO · EST. 2018
          </div>
          <h1>Jordan Tseng<span className="sub">／ 進度追蹤器</span></h1>
        </div>
        <div className="topbar-right">
          <button className="btn btn-ghost btn-icon" onClick={() => window.postMessage({ type: '__activate_edit_mode' }, '*')} title="顯示設定面板（檢視模式、字體、密度…）">
            ⚙
          </button>
          <button className="btn btn-ghost btn-icon" onClick={() => setTweak('darkMode', !t.darkMode)} title="切換深淺色 (D)">
            {t.darkMode ? '☀' : '◐'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            <span style={{ fontSize: 16, lineHeight: 1, marginTop: -1 }}>+</span>
            新增專案
            <span className="kbd" style={{ marginLeft: 6, opacity: 0.75 }}>N</span>
          </button>
          <button className="btn btn-ghost btn-icon" onClick={onSignOut} title={`登出 (${session.user.email})`}>
            ⏻
          </button>
        </div>
      </header>

      <div className="tabs-row">
        <div className="tabs-wrap" tabIndex={0}>
          <button className="tabs-trigger" aria-label="切換分頁">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1.5 4a1 1 0 0 1 1-1H6l1.2 1.5h4.3a1 1 0 0 1 1 1V11a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V4Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="trigger-label">
              {tab === 'active' ? '進行中' : tab === 'archived' ? '已歸檔' : '垃圾桶'}
            </span>
            <span className="count">{tab === 'active' ? activeProjects.length : tab === 'archived' ? archivedProjects.length : deletedProjects.length}</span>
          </button>
          <div className="tabs">
            <button className={`tab ${tab === 'active' ? 'on' : ''}`} onClick={() => setTab('active')}>
              進行中 <span className="count">{activeProjects.length}</span>
            </button>
            <button className={`tab ${tab === 'archived' ? 'on' : ''}`} onClick={() => setTab('archived')}>
              已歸檔 <span className="count">{archivedProjects.length}</span>
            </button>
            <button className={`tab ${tab === 'trash' ? 'on' : ''}`} onClick={() => setTab('trash')}>
              垃圾桶 <span className="count">{deletedProjects.length}</span>
            </button>
          </div>
        </div>
        <div className="meta-strip">
          <span>合計金額 <strong>{fmtNT(totalBudget)}</strong></span>
          <span className="sep">·</span>
          <span>預估淨利 <strong>{fmtNT(totalProfit)}</strong></span>
          <span className="sep">·</span>
          <span style={{ color: urgentCount ? 'var(--warn)' : undefined }}>
            <strong style={{ color: urgentCount ? 'var(--warn)' : undefined }}>{urgentCount}</strong> 個 14 天內到期
          </span>
          <span style={{ marginLeft: 12, color: 'var(--text-4)' }}>{fmtDate(TODAY)} · TODAY</span>
        </div>
      </div>

      <div className="card-list">
        {visible.length === 0 && (
          <div className="empty-state">
            {tab === 'active' ? '目前沒有進行中專案。按 N 新增一個。'
              : tab === 'archived' ? '尚無已歸檔專案。完成度 100% 的專案會出現在這裡。'
              : '垃圾桶是空的。已刪除的專案會出現在這裡，可隨時還原。'}
          </div>
        )}
        {visible.map(p => {
          const isInline = t.panelStyle === 'inline';
          const expandedStageHere = (expanded && expanded.projectId === p.id && isInline) ? expanded.stageId : null;
          return (
            <ProjectCard
              key={p.id}
              project={p}
              expandedStageId={expandedStageHere}
              costsOpen={p.costsOpen}
              onStageClick={(sid) => onStageClick(p.id, sid)}
              onCycleStage={onCycleStage}
              onCloseDetail={() => setExpanded(null)}
              onUpdateStage={onUpdateStage}
              onDeleteStage={onDeleteStage}
              onInsertStage={onInsertStage}
              onUpdateProject={onUpdateProject}
              onDeleteProject={onDeleteProject}
              onRestore={onRestoreProject}
              onPurgeProject={onPurgeProject}
              onArchive={tab === 'active' ? onArchive : onUnarchive}
              density={t.density}
              stageVariant={t.stageVariant}
              panelStyle={t.panelStyle}
              isDragging={dragId === p.id}
              isOver={dragOverId === p.id}
              dragHandleProps={{
                draggable: true,
                onDragStart: onDragStart(p.id),
                onDragEnd,
              }}
              dropTargetProps={{
                onDragOver: onDragOver(p.id),
                onDragLeave,
                onDrop: onDrop(p.id),
              }}
            />
          );
        })}
      </div>

      <div className="footer-note">
        <div>JORDAN TSENG / PROJECT TRACKER v0.5</div>
        <div className="legend">
          <span className="legend-dot todo">未開始</span>
          <span className="legend-dot active">進行中</span>
          <span className="legend-dot done">已完成 · 自動縮小</span>
        </div>
      </div>

      {showNew && <NewProjectModal onClose={() => setShowNew(false)} onCreate={onCreate} />}

      {expanded && t.panelStyle !== 'inline' && expandedProj && (
        <>
          {t.panelStyle === 'sheet' && (
            <>
              <div className="sheet-backdrop" onClick={() => setExpanded(null)}></div>
              <div className="sheet">
                <StageDetail
                  project={expandedProj}
                  stageId={expanded.stageId}
                  onClose={() => setExpanded(null)}
                  onUpdateStage={onUpdateStage}
                  onDeleteStage={onDeleteStage}
                  closeAsArrow={false}
                />
              </div>
            </>
          )}
          {t.panelStyle === 'modal' && (
            <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setExpanded(null); }}>
              <div className="modal" style={{ maxWidth: 640, padding: 0, overflow: 'hidden' }}>
                <StageDetail
                  project={expandedProj}
                  stageId={expanded.stageId}
                  onClose={() => setExpanded(null)}
                  onUpdateStage={onUpdateStage}
                  onDeleteStage={onDeleteStage}
                  closeAsArrow={false}
                />
              </div>
            </div>
          )}
        </>
      )}

      {showHint && !showNew && !expanded && (
        <div className="hint">
          <span><span className="kbd">N</span> 新增 · <span className="kbd">D</span> 深色 · <span className="kbd">Esc</span> 收折 · Shift+點擊階段切換 · 階段中間懸停可插入</span>
        </div>
      )}

      <TweaksPanel title="Tweaks">
        <TweakSection label="階段進度視覺">
          <TweakRadio
            value={t.stageVariant}
            onChange={(v) => setTweak('stageVariant', v)}
            options={[
              { value: 'bar', label: '分段條' },
              { value: 'blocks', label: '方塊' },
              { value: 'dots', label: '圓點' },
            ]}
          />
        </TweakSection>
        <TweakSection label="詳情面板呈現">
          <TweakRadio
            value={t.panelStyle}
            onChange={(v) => { setTweak('panelStyle', v); setExpanded(null); }}
            options={[
              { value: 'inline', label: 'Inline' },
              { value: 'sheet', label: 'Sheet' },
              { value: 'modal', label: 'Modal' },
            ]}
          />
        </TweakSection>
        <TweakSection label="字體配對">
          <TweakSelect
            value={t.fontPair}
            onChange={(v) => setTweak('fontPair', v)}
            options={[
              { value: 'inter-noto', label: 'Inter + Noto Sans TC' },
              { value: 'plex', label: 'IBM Plex Sans + TC' },
              { value: 'zen', label: 'Inter + Zen Kaku Gothic' },
              { value: 'space', label: 'Space Grotesk + Noto' },
            ]}
          />
        </TweakSection>
        <TweakSection label="點綴色調">
          <TweakColor
            value={t.accentMode}
            onChange={(v) => setTweak('accentMode', v)}
            options={[
              { value: 'amber',  color: ['#eab308', '#ef4444'] },
              { value: 'orange', color: ['#d97706', '#dc2626'] },
              { value: 'muted',  color: ['#b45309', '#b91c1c'] },
            ]}
          />
        </TweakSection>
        <TweakSection label="卡片密度">
          <TweakRadio
            value={t.density}
            onChange={(v) => setTweak('density', v)}
            options={[
              { value: 'comfortable', label: '寬鬆' },
              { value: 'dense', label: '緊湊' },
            ]}
          />
        </TweakSection>
        <TweakSection label="主題">
          <TweakToggle value={t.darkMode} onChange={(v) => setTweak('darkMode', v)} label="深色模式" />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
