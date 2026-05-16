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
const toISODate = (d) => {
  if (!d) return '';
  const dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt)) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const addDays = (d, n) => {
  if (!d) return '';
  const dt = (d instanceof Date) ? new Date(d) : new Date(d);
  if (isNaN(dt)) return '';
  dt.setDate(dt.getDate() + n);
  return toISODate(dt);
};
// Compute payment schedule with defaults for legacy projects.
const getPayments = (project) => {
  if (Array.isArray(project.payments) && project.payments.length > 0) return project.payments;
  return [
    { id: 'pay-1', label: '頭期款', percentage: 50, dueDate: project.start || '' },
    { id: 'pay-2', label: '尾款',   percentage: 50, dueDate: project.due   || '' },
  ];
};
const getOutsourcePayDate = (project) => {
  if (project.outsourcePayDate) return project.outsourcePayDate;
  const payments = getPayments(project);
  const last = payments[payments.length - 1];
  if (!last?.dueDate) return '';
  return addDays(last.dueDate, 5);
};

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

// ---------- Daily quotes ----------
const DAILY_QUOTES = [
  // Naval Ravikant
  { text: '如果你不能決定，答案就是不要。', author: 'Naval Ravikant' },
  { text: '追求財富，而非金錢或地位。財富是你睡覺時仍在為你工作的資產。', author: 'Naval Ravikant' },
  { text: '把自己產品化：找到你獨特的技能，用槓桿放大它。', author: 'Naval Ravikant' },
  { text: '閱讀不是為了完成一本書，而是為了完成一個想法。', author: 'Naval Ravikant' },
  { text: '忙碌不等於生產力。真正厲害的人，看起來總是很從容。', author: 'Naval Ravikant' },
  { text: '幸福是一種技能，可以透過練習獲得。', author: 'Naval Ravikant' },
  { text: '最好的工作，是那些看起來像玩樂的工作。', author: 'Naval Ravikant' },
  { text: '真正的財富是不需要為了錢而出賣時間。', author: 'Naval Ravikant' },
  { text: '你不需要很多人認同你，只需要少數對的人。', author: 'Naval Ravikant' },
  { text: '學會獨處而不感到孤獨，是一種超能力。', author: 'Naval Ravikant' },
  { text: '比起管理時間，更重要的是管理精力。', author: 'Naval Ravikant' },
  { text: '槓桿來自程式碼、媒體和資本——這些東西在你睡覺時也能運作。', author: 'Naval Ravikant' },
  { text: '長期思考是最大的競爭優勢，因為很少人願意這樣做。', author: 'Naval Ravikant' },
  { text: '焦慮是因為你同時想要做太多件事。平靜是當你知道哪件事最重要。', author: 'Naval Ravikant' },
  { text: '所有回報，不論是財富、人脈或知識，都來自複利效應。', author: 'Naval Ravikant' },
  { text: '選對方向比努力工作更重要。', author: 'Naval Ravikant' },
  { text: '不要花時間去戰鬥，花時間去建造。', author: 'Naval Ravikant' },
  { text: '你的聲譽是你最重要的資產。用長期主義來守護它。', author: 'Naval Ravikant' },
  { text: '慾望是與他人比較的結果。快樂是不再比較。', author: 'Naval Ravikant' },
  { text: '做不可被取代的事。如果一千個人能做你做的事，你不會得到好回報。', author: 'Naval Ravikant' },
  // Elon Musk
  { text: '如果有什麼事情夠重要，就算勝算不高，你也應該去做。', author: 'Elon Musk' },
  { text: '堅持非常重要。除非你被迫放棄，否則不要放棄。', author: 'Elon Musk' },
  { text: '失敗是一個選項。如果事情沒有失敗過，代表你的創新不夠多。', author: 'Elon Musk' },
  { text: '當某件事夠重要，你就去做，即使所有條件都不利於你。', author: 'Elon Musk' },
  { text: '我認為普通人也可以選擇不平凡。', author: 'Elon Musk' },
  { text: '有些人不喜歡改變，但如果替代方案是災難，你就必須擁抱改變。', author: 'Elon Musk' },
  { text: '與其花精力抱怨，不如把精力花在解決問題上。', author: 'Elon Musk' },
  { text: '不斷質疑你的假設，用第一原理去思考。', author: 'Elon Musk' },
  { text: '品牌只是一種感知。感知會在時間中追上現實。', author: 'Elon Musk' },
  { text: '最好的零件是不存在的零件。最好的流程是不需要的流程。', author: 'Elon Musk' },
  { text: '我不是在設立公司來設立公司。我是為了把事情做成。', author: 'Elon Musk' },
  { text: '人生太短，不能花時間去做無聊的事。', author: 'Elon Musk' },
  { text: '你的意志力要強到，連宇宙都會讓步。', author: 'Elon Musk' },
  { text: '專注於信號，忽略噪音。不要把時間浪費在不會讓結果更好的事上。', author: 'Elon Musk' },
  { text: '創業就像嚼著玻璃，凝視深淵。', author: 'Elon Musk' },
  { text: '每週工作八十到一百個小時，才能提高成功的機率。', author: 'Elon Musk' },
  { text: '如果你需要鼓勵的話，就不要創業了。', author: 'Elon Musk' },
  { text: '不斷反饋迴路：想想你做了什麼，怎樣可以做得更好。', author: 'Elon Musk' },
  { text: '耐心對於長期，不耐煩對於短期。', author: 'Elon Musk' },
  { text: '試著去做有用的事，對你的同胞有用。', author: 'Elon Musk' },
  // 黃仁勳
  { text: '沒有人能阻止一個不願放棄的人。', author: '黃仁勳' },
  { text: '我的成功祕訣是：我對成功的恐懼遠大於對失敗的恐懼。', author: '黃仁勳' },
  { text: '你必須要有遠見，但同時也要有能力承受短期的痛苦。', author: '黃仁勳' },
  { text: '不要追求容易的事。追求偉大的事，即使那意味著受苦。', author: '黃仁勳' },
  { text: '公司的使命感，比策略更重要。', author: '黃仁勳' },
  { text: '光有速度是不夠的，你必須朝對的方向跑。', author: '黃仁勳' },
  { text: '我不是因為有自信才做這些事，我是因為害怕所以才這麼拚命。', author: '黃仁勳' },
  { text: '世界不會等你準備好。你必須一邊跑一邊調整。', author: '黃仁勳' },
  { text: '我希望你們都能經歷足夠的痛苦和磨難，因為韌性對成功至關重要。', author: '黃仁勳' },
  { text: '最重要的能力是從錯誤中快速學習。', author: '黃仁勳' },
  { text: '企業文化是你唯一不可複製的競爭優勢。', author: '黃仁勳' },
  { text: '專注在少數重要的事情上，然後做到極致。', author: '黃仁勳' },
  { text: '科技改變世界的速度比任何人想像的都快。保持學習。', author: '黃仁勳' },
  { text: '成功的人和不成功的人之間的差距，就是堅持的時間長度。', author: '黃仁勳' },
  { text: '你需要有承受孤獨的能力。很多重大決定，只有你自己才能做。', author: '黃仁勳' },
  { text: '你必須對你正在做的事充滿熱情，否則你撐不過艱難的時刻。', author: '黃仁勳' },
  { text: '創新不是選擇，是生存的必要條件。', author: '黃仁勳' },
  { text: '卓越不是一個動作，是一個習慣。', author: '黃仁勳' },
  { text: '用十年的眼光做今天的決定。', author: '黃仁勳' },
  { text: '如果我重新來過，我不確定自己還有勇氣再創辦 NVIDIA。', author: '黃仁勳' },
  // 巴菲特
  { text: '別人恐懼時我貪婪，別人貪婪時我恐懼。', author: '巴菲特' },
  { text: '價格是你付出的，價值是你得到的。', author: '巴菲特' },
  { text: '最好的投資就是投資自己。', author: '巴菲特' },
  { text: '只要不虧錢，其他一切都會慢慢好起來。', author: '巴菲特' },
  { text: '時間是好公司的朋友，是壞公司的敵人。', author: '巴菲特' },
  { text: '在商業世界裡，後照鏡永遠比擋風玻璃更清楚。', author: '巴菲特' },
  { text: '當潮水退去，你才知道誰在裸泳。', author: '巴菲特' },
  { text: '誠實是最昂貴的禮物。不要期望從廉價的人那裡得到它。', author: '巴菲特' },
  { text: '你不需要做很多對的事，只要不做太多錯的事。', author: '巴菲特' },
  { text: '能力圈很重要：知道自己不知道什麼，比什麼都知道更有價值。', author: '巴菲特' },
  { text: '習慣是一條太細的線，細到你感覺不到，直到它變成一條斷不了的繩。', author: '巴菲特' },
  { text: '風險來自於你不知道自己在做什麼。', author: '巴菲特' },
  { text: '我總是知道我會變得富有。我從來沒有懷疑過。', author: '巴菲特' },
  { text: '你只需要做幾件正確的大事，只要你不做太多錯的事。', author: '巴菲特' },
  { text: '建立聲譽需要二十年，毀掉它只需要五分鐘。', author: '巴菲特' },
  { text: '不要用借來的錢去投資。', author: '巴菲特' },
  { text: '如果你發現自己在一艘漏水的船上，換一艘船比補漏洞更有效率。', author: '巴菲特' },
  { text: '機會不常來。天上掉金子時，拿桶去接，不是拿頂針。', author: '巴菲特' },
  { text: '永遠不要問理髮師你是否需要理髮。', author: '巴菲特' },
  { text: '我很理性。很多人比我聰明，但我更理性。', author: '巴菲特' },
  // 老子
  { text: '千里之行，始於足下。', author: '老子' },
  { text: '知人者智，自知者明。', author: '老子' },
  { text: '上善若水。水善利萬物而不爭。', author: '老子' },
  { text: '天下難事，必作於易；天下大事，必作於細。', author: '老子' },
  { text: '道生一，一生二，二生三，三生萬物。', author: '老子' },
  { text: '禍兮福之所倚，福兮禍之所伏。', author: '老子' },
  { text: '大器晚成。大音希聲。大象無形。', author: '老子' },
  { text: '知足者富。強行者有志。', author: '老子' },
  { text: '飄風不終朝，驟雨不終日。', author: '老子' },
  { text: '無為而無不為。', author: '老子' },
  { text: '知者不言，言者不知。', author: '老子' },
  { text: '合抱之木，生於毫末；九層之臺，起於累土。', author: '老子' },
  { text: '天之道，利而不害。聖人之道，為而不爭。', author: '老子' },
  { text: '大直若屈，大巧若拙，大辯若訥。', author: '老子' },
  { text: '柔弱勝剛強。', author: '老子' },
  { text: '為學日益，為道日損。', author: '老子' },
  { text: '輕諾必寡信，多易必多難。', author: '老子' },
  { text: '慎終如始，則無敗事。', author: '老子' },
  { text: '天下莫柔弱於水，而攻堅強者莫之能勝。', author: '老子' },
  { text: '民不畏死，奈何以死懼之。', author: '老子' },
];

function getDailyQuote() {
  const start = new Date(TODAY.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((TODAY - start) / 86400000);
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
}

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

// ---------- User settings (global cash-flow params) ----------
async function loadUserSettings() {
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return null;
  const { data, error } = await supa
    .from('user_settings')
    .select('data')
    .eq('owner_id', user.id)
    .maybeSingle();
  if (error) { console.error('[loadUserSettings] failed:', error.message); return null; }
  return data?.data || {};
}

async function saveUserSettings(settings) {
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return;
  const { error } = await supa
    .from('user_settings')
    .upsert({ owner_id: user.id, data: settings, updated_at: new Date().toISOString() });
  if (error) console.error('[saveUserSettings] failed:', error.message);
}

// ---------- Celebration helpers ----------
// Stage burst: emerald-leaning, small. Project complete: warm-spectrum, big.
// Both colour sets lean warm/saturated — research on dopamine-eliciting palettes
// favours bright, varied warm tones over cool monochrome.
const STAGE_BURST_COLORS    = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#fbbf24'];
const PROJECT_BURST_COLORS  = ['#10b981', '#34d399', '#fbbf24', '#eab308', '#fb7185', '#fda4af', '#fde68a', '#fef3c7'];

function projectPct(project) {
  const total = project.stages.reduce((a, s) => a + s.items.length, 0);
  const done  = project.stages.reduce((a, s) => a + s.items.filter(it => {
    const st = itemStatus(it);
    return st === 'done' || st === 'confirmed';
  }).length, 0);
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

const ITEM_STATES = ['todo', 'active', 'blocked', 'done', 'confirmed'];
const ITEM_STATE_LABELS = { todo: '未開始', active: '進行中', blocked: '排除問題', done: '已完成', confirmed: '已確認' };

function itemStatus(it) {
  if (it.status && ITEM_STATES.includes(it.status)) return it.status;
  return it.done ? 'done' : 'todo';
}

function ItemStatusDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="item-status-dropdown" ref={ref}>
      <button className={`item-bar-badge status-${value}`} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        {ITEM_STATE_LABELS[value]}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 4 }}><path d="M2.5 4l2.5 2.5L7.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      {open && (
        <div className="item-status-menu">
          {ITEM_STATES.map(st => (
            <button key={st} className={`item-status-option status-${st} ${st === value ? 'current' : ''}`} onClick={(e) => { e.stopPropagation(); onChange(st); setOpen(false); }}>
              <span className="item-status-dot"></span>
              {ITEM_STATE_LABELS[st]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChecklistEditor({ stage, onUpdate }) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  const setItemStatus = (id, newStatus) => {
    const items = stage.items.map(it => {
      if (it.id !== id) return it;
      return { ...it, status: newStatus, done: newStatus === 'done' || newStatus === 'confirmed' };
    });
    let status = stage.status;
    const allConfirmed = items.length > 0 && items.every(it => itemStatus(it) === 'confirmed');
    const anyStarted = items.some(it => itemStatus(it) !== 'todo');
    if (allConfirmed) status = 'done';
    else if (status === 'done' && !allConfirmed) status = 'active';
    else if (status === 'todo' && anyStarted) status = 'active';
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
      items: [...stage.items, { id: uid('i'), text: draft.trim(), done: false, status: 'todo' }]
    });
    setDraft('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const confirmedCount = stage.items.filter(it => itemStatus(it) === 'confirmed').length;
  const doneCount = stage.items.filter(it => itemStatus(it) === 'done').length;
  const activeCount = stage.items.filter(it => itemStatus(it) === 'active').length;
  const blockedCount = stage.items.filter(it => itemStatus(it) === 'blocked').length;

  return (
    <div className="detail-section" style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="section-label">工作項目</div>
        <div className="stage-progress-mini">
          {confirmedCount > 0 && <span>{confirmedCount} 確認 · </span>}
          {doneCount > 0 && <span>{doneCount} 完成 · </span>}
          {activeCount > 0 && <span>{activeCount} 進行中 · </span>}
          {blockedCount > 0 && <span className="blocked-count">{blockedCount} 排除問題 · </span>}
          共 {stage.items.length}
        </div>
      </div>
      <div className="item-bars">
        {stage.items.map(it => {
          const st = itemStatus(it);
          return (
            <div key={it.id} className={`item-bar status-${st}`}>
              <div className="item-bar-actions-left">
                {it.link && <a href={it.link} target="_blank" rel="noopener noreferrer" className="item-bar-link" title={it.link}>↗</a>}
                <button className="item-bar-action" title={it.link ? '編輯連結' : '加入連結'} onClick={() => {
                  const v = prompt('貼上該項目的成果連結（留空可移除）：', it.link || '');
                  if (v === null) return;
                  onUpdate({ ...stage, items: stage.items.map(x => x.id === it.id ? { ...x, link: v.trim() || null } : x) });
                }}>
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M6 8a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5L7 3.5M8 6a2.5 2.5 0 0 0-3.5 0l-2 2a2.5 2.5 0 0 0 3.5 3.5L7 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                </button>
                <button className="item-bar-action" onClick={() => {
                  const items = stage.items.map(x => x.id === it.id ? { ...x, editing: true } : x);
                  onUpdate({ ...stage, items });
                }} title="重新命名">
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M10.5 2.5l1 1-7 7H3v-1.5l7-7z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <button className="item-bar-action danger" onClick={() => remove(it.id)} title="刪除">×</button>
              </div>
              {it.editing ? (
                <div className="item-bar-text-area">
                  <input className="input item-bar-edit" autoFocus defaultValue={it.text}
                    onBlur={(e) => onUpdate({ ...stage, items: stage.items.map(x => x.id === it.id ? { ...x, text: e.target.value || x.text, editing: false } : x) })}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') onUpdate({ ...stage, items: stage.items.map(x => x.id === it.id ? { ...x, editing: false } : x) }); }}
                  />
                </div>
              ) : (
                <span className="item-bar-text">{it.text}</span>
              )}
              <ItemStatusDropdown value={st} onChange={(newSt) => setItemStatus(it.id, newSt)} />
            </div>
          );
        })}
      </div>
      <form className="add-item-row" onSubmit={add}>
        <input
          ref={inputRef}
          className="input"
          placeholder="新增工作項目…"
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
    if (status === 'done') items = items.map(it => ({ ...it, done: true, status: 'confirmed' }));
    if (status === 'active') items = items.map(it => itemStatus(it) === 'todo' ? { ...it, status: 'active', done: false } : it);
    if (status === 'todo') items = items.map(it => ({ ...it, done: false, status: 'todo' }));
    update({ status, items });
  };
  // mark autoNote when items fully done
  const allDone = stage.items.length > 0 && stage.items.every(it => it.done);

  const allItemsDone = stage.items.length > 0 && stage.items.every(it => {
    const st = itemStatus(it);
    return st === 'done' || st === 'confirmed';
  });

  const completeAll = () => {
    const items = stage.items.map(it => ({ ...it, status: 'done', done: true }));
    update({ items, status: 'done' });
    celebrateStage(stageId);
  };

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
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {!allItemsDone && stage.items.length > 0 && (
            <button className="btn-complete-all" onClick={completeAll} title="將所有工作項目標為已完成">
              ✓ 全部完成
            </button>
          )}
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

  const isOverseas = project.overseas === true;
  const budget = project.budget || 0;
  const preTax = isOverseas ? budget : Math.round(budget / 1.05);
  const salesVAT = isOverseas ? 0 : budget - preTax;
  const netVAT = isOverseas ? 0 : Math.max(0, salesVAT - creditableInputTax);
  const profit = budget - fixedCost - outsourceTotal - netVAT;

  return { days, months, fixedCost, outsourceTotal, companyOutsource, personalOutsource, salesVAT, creditableInputTax, netVAT, profit, preTax, isOverseas };
}

// ---------- Cash flow timeline ----------
// Returns a sorted list of cash events + the running balance at each point.
// settings: { startDate, bankBalance, monthlyFixedExpense, deductionDay }
// horizonMonths: how many months forward to project (default 12)
function buildCashflowSeries(projects, settings, horizonMonths = 12) {
  const start = settings.startDate ? new Date(settings.startDate) : new Date(TODAY);
  start.setHours(0, 0, 0, 0);
  const balance = Number(settings.bankBalance) || 0;
  const monthlyExp = Number(settings.monthlyFixedExpense) || 0;
  const deductionDay = Math.max(1, Math.min(31, Number(settings.deductionDay) || 31));
  const end = new Date(start);
  end.setMonth(end.getMonth() + horizonMonths);

  const events = [];

  // Monthly fixed expenses across the horizon
  if (monthlyExp > 0) {
    for (let i = 0; i < horizonMonths; i++) {
      const month = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
      const day = Math.min(deductionDay, lastDay);
      const d = new Date(month.getFullYear(), month.getMonth(), day);
      if (d < start || d > end) continue;
      events.push({ date: d, amount: -monthlyExp, label: '每月固定支出', kind: 'fixed' });
    }
  }

  // Project incoming + outgoing events
  for (const p of projects) {
    if (p.deleted) continue;
    const budget = Number(p.budget) || 0;
    const payments = getPayments(p);
    for (const pay of payments) {
      if (!pay.dueDate) continue;
      const d = new Date(pay.dueDate);
      if (isNaN(d) || d < start || d > end) continue;
      const amt = budget * (Number(pay.percentage) || 0) / 100;
      if (amt === 0) continue;
      events.push({ date: d, amount: amt, label: `${p.title} · ${pay.label}`, kind: 'income' });
    }
    const outDate = getOutsourcePayDate(p);
    if (outDate) {
      const d = new Date(outDate);
      if (!isNaN(d) && d >= start && d <= end) {
        const outTotal = (p.outsources || []).reduce((a, o) => a + (Number(o.amount) || 0), 0);
        if (outTotal > 0) {
          events.push({ date: d, amount: -outTotal, label: `${p.title} · 外包付款`, kind: 'outsource' });
        }
      }
    }
  }

  events.sort((a, b) => a.date - b.date);

  // Cumulative points; first point is the starting balance
  let running = balance;
  const points = [{ date: new Date(start), balance: running, label: '起算日', amount: 0, kind: 'start' }];
  for (const e of events) {
    running += e.amount;
    points.push({ date: e.date, balance: running, label: e.label, amount: e.amount, kind: e.kind });
  }
  // Add a synthetic point at the horizon end so the line extends to the right edge
  if (points[points.length - 1].date < end) {
    points.push({ date: new Date(end), balance: running, label: '', amount: 0, kind: 'end' });
  }

  const minBalance = Math.min(...points.map(p => p.balance));
  const goesNegative = minBalance < 0;
  const negativeAt = goesNegative ? points.find(p => p.balance < 0) : null;

  return { points, events, startBalance: balance, minBalance, goesNegative, negativeAt, start, end };
}

function PaymentSchedule({ project, onUpdate }) {
  const payments = getPayments(project);
  const budget = Number(project.budget) || 0;
  const totalPct = payments.reduce((a, p) => a + (Number(p.percentage) || 0), 0);

  // When changing one row's percentage, auto-balance the OTHER single row so total stays 100.
  // (Only auto-balances for exactly 2 rows — the common 頭期/尾款 case.)
  const setPercentage = (id, raw) => {
    let pct = Number(raw);
    if (!Number.isFinite(pct)) pct = 0;
    pct = Math.max(0, Math.min(100, pct));
    const next = payments.map(p => ({ ...p }));
    const idx = next.findIndex(p => p.id === id);
    if (idx < 0) return;
    next[idx].percentage = pct;
    if (next.length === 2) {
      const otherIdx = idx === 0 ? 1 : 0;
      next[otherIdx].percentage = Math.max(0, 100 - pct);
    }
    onUpdate({ ...project, payments: next });
  };

  const setDate = (id, dueDate) => {
    const next = payments.map(p => p.id === id ? { ...p, dueDate } : p);
    onUpdate({ ...project, payments: next });
  };

  const setOutsourcePayDate = (val) => {
    onUpdate({ ...project, outsourcePayDate: val });
  };

  const outsourcePayDate = getOutsourcePayDate(project);
  const hasOutsources = (project.outsources || []).length > 0;

  return (
    <div className="cost-section">
      <div className="cost-section-h">
        <div className="cost-block-h">
          <span className="block-emoji">📅</span>
          <span>收款排程</span>
          <span className="ghost-pill">合計 {totalPct}%</span>
        </div>
      </div>

      <div className="payment-list">
        <div className="payment-row head">
          <div>款項</div>
          <div className="center">比例</div>
          <div>預計收款日</div>
          <div className="right">金額（含稅）</div>
        </div>
        {payments.map(p => (
          <div key={p.id} className="payment-row">
            <div className="payment-label">{p.label}</div>
            <div className="pct-input-wrap">
              <input type="number" className="num-input pct-input"
                min="0" max="100" step="1"
                value={p.percentage}
                onChange={e => setPercentage(p.id, e.target.value)} />
              <span className="pct-sign">%</span>
            </div>
            <input type="date" className="date-input compact"
              value={p.dueDate || ''}
              onChange={e => setDate(p.id, e.target.value)} />
            <div className="num-val right">{fmtNT(budget * (Number(p.percentage) || 0) / 100)}</div>
          </div>
        ))}
      </div>

      {hasOutsources && (
        <div className="payment-aux">
          <span className="aux-label">外包付款日</span>
          <input type="date" className="date-input compact"
            value={outsourcePayDate}
            onChange={e => setOutsourcePayDate(e.target.value)} />
          <span className="aux-hint">預設 = 尾款日 +5 天，可自行調整</span>
        </div>
      )}
    </div>
  );
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
            <div className="summary-label">合約金額（含稅）</div>
            <div className="summary-value">{fmtNT(project.budget)}</div>
          </div>
          <div className="summary-item">
            <div className="summary-label">未稅金額</div>
            <div className="summary-value">{fmtNT(c.preTax)}</div>
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
            <span>案件類型</span>
            <div className="type-toggle">
              <button className={!project.overseas ? 'on' : ''} onClick={() => update({ overseas: false })}>國內案</button>
              <button className={project.overseas ? 'on' : ''} onClick={() => update({ overseas: true })}>國外案</button>
            </div>
          </div>
          {c.isOverseas ? (
            <>
              <div className="cost-row-line emphasis">
                <span>應繳營業稅</span>
                <span className="num-val">{fmtNT(0)}</span>
              </div>
              <div className="tax-hint">境外交易依加值型及非加值型營業稅法規定，於一定金額內免徵營業稅。</div>
            </>
          ) : (
            <>
              <div className="cost-row-line">
                <span>銷項稅（含稅價拆算）</span>
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
              <div className="tax-hint">合約金額為含稅價，稅額 = 含稅價 ÷ 1.05 × 5%。公司外包可抵進項稅，個人外包無發票不可抵。</div>
            </>
          )}
        </div>
      </div>

      {/* Payment schedule (cash in) */}
      <PaymentSchedule project={project} onUpdate={onUpdate} />

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

  const [showEditModal, setShowEditModal] = useState(false);

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
            <button className="card-action" onClick={() => setShowEditModal(true)} title="編輯專案基本資料">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10.5 2.5l1 1-7 7H3v-1.5l7-7z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button className={`card-action ${project.infoOpen ? 'on' : ''}`} onClick={() => { onCloseDetail(); onUpdateProject(project.id, { infoOpen: !project.infoOpen, costsOpen: false }); }} title="專案資訊">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/><path d="M7 6v4M7 4v.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            </button>
            <button className={`card-action ${project.costsOpen ? 'on' : ''}`} onClick={() => { onCloseDetail(); onUpdateProject(project.id, { costsOpen: !project.costsOpen, infoOpen: false }); }} title="財務細節">
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

      {showEditModal && (
        <EditProjectModal
          project={project}
          onClose={() => setShowEditModal(false)}
          onSave={(patch) => { onUpdateProject(project.id, patch); setShowEditModal(false); }}
        />
      )}
    </div>
  );
}

function EditProjectModal({ project, onClose, onSave }) {
  const [form, setForm] = useState({
    title: project.title || '',
    client: project.client || '',
    budget: project.budget || '',
    start: project.start || '',
    due: project.due || '',
  });

  const valid = form.title.trim() && form.client.trim() && form.budget && form.due;

  const submit = (e) => {
    e.preventDefault();
    if (!valid) return;
    onSave({
      title: form.title.trim(),
      client: form.client.trim(),
      budget: Number(form.budget),
      start: form.start,
      due: form.due,
    });
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h2>編輯專案資訊</h2>
        <div className="modal-sub">修改後按「儲存」即可更新</div>
        <form className="modal-form" onSubmit={submit}>
          <div className="field">
            <label className="field-label">專案名稱</label>
            <input className="input" autoFocus value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="field">
            <label className="field-label">客戶名稱</label>
            <input className="input" value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label className="field-label">合約金額 (NT$)</label>
              <input className="input" type="number" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-label">起始日期</label>
              <input className="date-input" type="date" value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label className="field-label">交件日期</label>
            <input className="date-input" type="date" value={form.due} onChange={e => setForm({ ...form, due: e.target.value })} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>取消 (Esc)</button>
            <button type="submit" className="btn btn-primary" disabled={!valid}>儲存</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CashflowSettingsModal({ settings, onClose, onSave }) {
  const [form, setForm] = useState({
    startDate: settings.startDate || toISODate(TODAY),
    bankBalance: settings.bankBalance ?? '',
    monthlyFixedExpense: settings.monthlyFixedExpense ?? 180000,
    deductionDay: settings.deductionDay ?? 31,
  });

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (e) => {
    e.preventDefault();
    const day = Math.max(1, Math.min(31, Number(form.deductionDay) || 31));
    onSave({
      startDate: form.startDate || toISODate(TODAY),
      bankBalance: Number(form.bankBalance) || 0,
      monthlyFixedExpense: Number(form.monthlyFixedExpense) || 0,
      deductionDay: day,
    });
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h2>💵 現金流設定</h2>
        <div className="modal-sub">這些數字會用來畫首頁的現金流量表</div>
        <form className="modal-form" onSubmit={submit}>
          <div className="field">
            <label className="field-label">起算日（圖表從這天開始）</label>
            <input className="date-input" type="date"
              value={form.startDate}
              onChange={e => setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div className="field">
            <label className="field-label">起算日當天的銀行存款餘額 (NT$)</label>
            <input className="input" type="number" placeholder="例：500000"
              value={form.bankBalance}
              onChange={e => setForm({ ...form, bankBalance: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
            <div className="field">
              <label className="field-label">每月固定支出 (NT$)</label>
              <input className="input" type="number" placeholder="例：180000"
                value={form.monthlyFixedExpense}
                onChange={e => setForm({ ...form, monthlyFixedExpense: e.target.value })} />
              <div className="field-hint">薪資、租金等每月固定要付出的金額</div>
            </div>
            <div className="field">
              <label className="field-label">每月扣款日</label>
              <input className="input" type="number" min="1" max="31"
                value={form.deductionDay}
                onChange={e => setForm({ ...form, deductionDay: e.target.value })} />
              <div className="field-hint">1–31 號（若該月無此日，自動取月底）</div>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>取消 (Esc)</button>
            <button type="submit" className="btn btn-primary">儲存</button>
          </div>
        </form>
      </div>
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

// ---------- Cash flow chart ----------
function CashflowChart({ series }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!window.Chart || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');

    // Compute days-since-start for each point so x-axis is proportional to time.
    const start = series.start;
    const dayOf = (d) => Math.round((d - start) / 86400000);
    const data = series.points.map(p => ({ x: dayOf(p.date), y: p.balance, meta: p }));

    const minBalance = series.minBalance;
    const startBalance = series.startBalance;
    const fillColor = series.goesNegative ? 'rgba(239,68,68,0.10)' : 'rgba(16,185,129,0.10)';
    const lineColor = series.goesNegative ? '#ef4444' : '#10b981';

    const horizonDays = Math.round((series.end - start) / 86400000);

    // Format a day-offset back to date for axis ticks / tooltip
    const fmtDayOffset = (offset) => {
      const d = new Date(start);
      d.setDate(d.getDate() + offset);
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    };

    if (chartRef.current) chartRef.current.destroy();

    chartRef.current = new window.Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: '帳戶餘額',
          data,
          stepped: 'before',
          borderColor: lineColor,
          backgroundColor: fillColor,
          borderWidth: 2,
          pointRadius: data.map(d => d.meta.kind === 'start' || d.meta.kind === 'end' ? 0 : 4),
          pointHoverRadius: 6,
          pointBackgroundColor: data.map(d => {
            if (d.meta.kind === 'income') return '#10b981';
            if (d.meta.kind === 'outsource') return '#f59e0b';
            if (d.meta.kind === 'fixed') return '#ef4444';
            return lineColor;
          }),
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1.5,
          fill: true,
          tension: 0,
        }, {
          // Zero baseline reference (dashed)
          label: '_zero',
          data: [{ x: 0, y: 0 }, { x: horizonDays, y: 0 }],
          borderColor: 'rgba(160,160,160,0.45)',
          borderWidth: 1,
          borderDash: [4, 4],
          pointRadius: 0,
          fill: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                const it = items[0];
                if (!it || it.dataset.label === '_zero') return '';
                return fmtDayOffset(it.parsed.x);
              },
              label: (item) => {
                if (item.dataset.label === '_zero') return null;
                const meta = item.raw.meta;
                const bal = `餘額 ${fmtNT(item.parsed.y)}`;
                if (meta.kind === 'start') return [meta.label, bal];
                const sign = meta.amount >= 0 ? '+' : '−';
                const amt = fmtNT(Math.abs(meta.amount));
                return [meta.label, `${sign}${amt}`, bal];
              },
            },
          },
        },
        scales: {
          x: {
            type: 'linear',
            min: 0,
            max: horizonDays,
            ticks: {
              callback: (v) => fmtDayOffset(v),
              maxTicksLimit: 8,
              font: { size: 11 },
              color: 'rgba(120,120,120,0.85)',
            },
            grid: { color: 'rgba(0,0,0,0.04)' },
          },
          y: {
            ticks: {
              callback: (v) => fmtNT(v),
              font: { size: 11 },
              color: 'rgba(120,120,120,0.85)',
            },
            grid: { color: 'rgba(0,0,0,0.04)' },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    };
  }, [series]);

  return <canvas ref={canvasRef} />;
}

function CashflowPanel({ projects, settings, onOpenSettings }) {
  const [open, setOpen] = useState(true);
  const hasSettings = settings && (settings.bankBalance !== undefined && settings.bankBalance !== null && settings.bankBalance !== '');
  const series = useMemo(
    () => hasSettings ? buildCashflowSeries(projects, settings, 12) : null,
    [projects, settings, hasSettings]
  );

  return (
    <div className={`cashflow-panel ${open ? 'open' : 'closed'}`}>
      <div className="cashflow-head">
        <button className="cashflow-toggle" onClick={() => setOpen(o => !o)} title={open ? '收起' : '展開'}>
          <span className="cashflow-chevron">{open ? '▾' : '▸'}</span>
          <span className="cashflow-title">📈 現金流量表</span>
          <span className="cashflow-sub">未來 12 個月預估</span>
        </button>
        <div className="cashflow-actions">
          {hasSettings && series && (
            <>
              <span className="cashflow-stat">
                起始 <strong>{fmtNT(series.startBalance)}</strong>
              </span>
              <span className="cashflow-stat">
                最低點 <strong className={series.goesNegative ? 'neg' : ''}>{fmtNT(series.minBalance)}</strong>
              </span>
              {series.goesNegative && series.negativeAt && (
                <span className="cashflow-stat warn">
                  ⚠ {fmtDate(series.negativeAt.date)} 見底
                </span>
              )}
            </>
          )}
          <button className="btn btn-ghost small" onClick={onOpenSettings} title="編輯現金流設定">
            ⚙ 設定
          </button>
        </div>
      </div>

      {open && (
        <div className="cashflow-body">
          {!hasSettings ? (
            <div className="cashflow-empty">
              還沒設定起始銀行餘額。點右上角 <strong>💵</strong> 或 <button className="link-btn" onClick={onOpenSettings}>這裡</button> 填入起算日的銀行存款，圖表就會出來。
            </div>
          ) : (
            <div className="cashflow-canvas-wrap">
              <CashflowChart series={series} />
            </div>
          )}
        </div>
      )}
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
  const [globalSettings, setGlobalSettings] = useState(null); // null while loading
  const [showCashSettings, setShowCashSettings] = useState(false);

  // Load projects from Supabase on mount
  useEffect(() => {
    let cancelled = false;
    loadProjects()
      .then(rows => { if (!cancelled) { setProjects(rows); setDataReady(true); } })
      .catch(err => { if (!cancelled) { setLoadError(err.message); setDataReady(true); } });
    return () => { cancelled = true; };
  }, []);

  // Load global cash-flow settings on mount
  useEffect(() => {
    let cancelled = false;
    loadUserSettings()
      .then(s => { if (!cancelled) setGlobalSettings(s || {}); })
      .catch(() => { if (!cancelled) setGlobalSettings({}); });
    return () => { cancelled = true; };
  }, []);

  const onSaveCashSettings = (patch) => {
    const next = { ...(globalSettings || {}), ...patch };
    setGlobalSettings(next);
    saveUserSettings(next);
    setShowCashSettings(false);
  };

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
    setProjects(prev => {
      const p = prev.find(p => p.id === projectId);
      if (p && (p.infoOpen || p.costsOpen)) {
        const next = prev.map(p => p.id === projectId ? { ...p, infoOpen: false, costsOpen: false } : p);
        const changed = next.find(p => p.id === projectId);
        if (changed) saveProjectInDB(changed);
        return next;
      }
      return prev;
    });
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
            const items = s.items.map(it => ({ ...it, done: nx === 'done', status: nx === 'done' ? 'confirmed' : (nx === 'todo' ? 'todo' : itemStatus(it)) }));
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
    const startISO = data.start || toISODate(TODAY);
    const dueISO = data.due || '';
    const projectData = {
      archived: false,
      costsOpen: false,
      start: startISO,
      fixedMonthly: 180000,
      outsources: [],
      payments: [
        { id: uid('pay'), label: '頭期款', percentage: 50, dueDate: startISO },
        { id: uid('pay'), label: '尾款',   percentage: 50, dueDate: dueISO },
      ],
      outsourcePayDate: dueISO ? addDays(dueISO, 5) : '',
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
          <div className="daily-quote">「{getDailyQuote().text}」— {getDailyQuote().author}</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-ghost btn-icon" onClick={() => setShowCashSettings(true)} title="現金流設定（銀行餘額、固定支出）">
            💵
          </button>
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

      <CashflowPanel
        projects={activeProjects}
        settings={globalSettings || {}}
        onOpenSettings={() => setShowCashSettings(true)}
      />

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

      {showCashSettings && (
        <CashflowSettingsModal
          settings={globalSettings || {}}
          onClose={() => setShowCashSettings(false)}
          onSave={onSaveCashSettings}
        />
      )}

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
