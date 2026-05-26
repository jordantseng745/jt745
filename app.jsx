// Project tracker app — main React component
const { useState, useEffect, useMemo, useRef, useCallback } = React;

// ---------- Constants ----------
// Six-stage default template. Each stage has:
//   items     — default items shown when a project is created
//   altItems  — optional / case-by-case items the user can pick from a dropdown
//               to re-add after deleting, or to add for special projects
const DEFAULT_STAGES_TPL = [
  {
    label: '評估期',
    items: [
      '收到客戶詢問',
      '與客戶討論需求（電話或 email）',
      '評估製作可行性與成本結構',
      '確定報價金額',
      '寄出報價單',
      '客戶簽署報價單',
      '收取訂金（50%）',
    ],
    altItems: [],
  },
  {
    label: '前期製作',
    items: [
      '腳本發想',
      '氛圍設計（Moodboard / 創作意圖）',
      '分鏡設計',
      '美術設計',
      '道具設計',
      '客戶提報（前期全部 Review）',
    ],
    altItems: [],
  },
  {
    label: '美術製作',
    items: [
      '場景訂製',
      '角色訂製',
      '內部確認',
      '客戶最終確認',
    ],
    altItems: [
      '採買場景陳設材料',
      '場景陳設搭建',
      '角色採買',
      '角色改造',
    ],
  },
  {
    label: '拍攝',
    items: [
      '場景陳設',
      '燈光架設',
      'Motion Board 製作',
      '正式動畫拍攝',
      '側錄 / 縮時攝影',
      '拍攝心得紀錄',
      '過檔給後製',
      '交付 A copy 給客戶',
    ],
    altItems: [],
  },
  {
    label: '後製',
    items: [
      '建立鏡頭後製表',
      '支架修除',
      '特效製作',
      '特效輸出',
      '影像調光',
      '音效製作',
      '音樂製作',
      '交付 B copy 給客戶確認',
      '客戶反饋修改',
      '交付最終版本',
    ],
    altItems: [
      '字幕製作',
      '動態包裝 / Motion Graphics',
      '多版本輸出（社群版、橫式、直式）',
      '配音錄製',
    ],
  },
  {
    label: '最終交付',
    items: [
      '提供高解析檔案',
      '安排上傳日期',
      '開立並寄送發票',
      '收取尾款',
    ],
    altItems: [
      '上傳作品集',
      '結案內部回顧',
    ],
  },
];

// Quickly find the template for a stage by its label (so older projects that
// may use the old label set just don't see template suggestions).
const findStageTemplate = (stageLabel) => DEFAULT_STAGES_TPL.find(t => t.label === stageLabel);

// Sort items by start date (then end date). Items without any date sink to the bottom.
function sortItemsByDate(items) {
  return [...items].sort((a, b) => {
    const ad = (a.start || a.end || a.dueDate || '');
    const bd = (b.start || b.end || b.dueDate || '');
    if (!ad && !bd) return 0;
    if (!ad) return 1;
    if (!bd) return -1;
    return ad < bd ? -1 : ad > bd ? 1 : 0;
  });
}

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
const fmtChineseDate = (d) => {
  if (!d) return '';
  const dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt)) return '';
  return `${dt.getFullYear()} 年 ${dt.getMonth() + 1} 月 ${dt.getDate()} 日`;
};
// Default categories for extra-expense simulator. Users can add their own.
const DEFAULT_EXPENSE_CATEGORIES = ['設備', '軟體授權', '投資', '員工福利', '教育訓練', '行銷宣傳', '場租', '物料耗材', '差旅', '維修保養', '雜支', '其他'];
// Default outsource roles. Users can add their own via the "+ 新增角色" option.
const DEFAULT_OUTSOURCE_ROLES = ['動畫師', '燈光師', '攝影師', '美術設計', '場景搭建', '偶頭外包', '配音員', '配樂', '音效後製', '剪輯', '後期調色', '特效合成', '編劇', '導演', '其他'];
// Map legacy values ('equipment' / 'other') to the new label-as-value system.
const normalizeExpenseType = (t) => {
  if (t === 'equipment') return '設備';
  if (t === 'other') return '其他';
  return t || '設備';
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
// 雙月一期。一筆金流落在的「期」 + 該期繳稅日（下一期第一個月的 5 號）。
//   5/15 → 5–6 月期，7/5 繳
//   11/20 → 11–12 月期，隔年 1/5 繳
const vatPeriodInfo = (d) => {
  const date = (d instanceof Date) ? d : new Date(d);
  if (isNaN(date)) return null;
  const m = date.getMonth();
  const y = date.getFullYear();
  const periodIdx = Math.floor(m / 2);
  let dueMonth = periodIdx * 2 + 2;
  let dueYear = y;
  if (dueMonth >= 12) { dueMonth -= 12; dueYear += 1; }
  const dueDate = new Date(dueYear, dueMonth, 5);
  const periodMonth1 = periodIdx * 2;
  return {
    key: `${y}-${periodIdx}`,
    dueDate,
    periodLabel: `${y} 年 ${periodMonth1 + 1}–${periodMonth1 + 2} 月`,
  };
};

const makeStage = (tpl, statusOverride) => ({
  id: uid('s'),
  emoji: tpl.emoji,
  label: tpl.label,
  status: statusOverride || 'todo',
  start: '',
  end: '',
  note: '',
  items: (tpl.items || []).map(t => ({ id: uid('i'), text: t, done: false, start: '', end: '' })),
});

// Read effective start/end for an item, falling back to the legacy `dueDate` field
// (which acted as a single-day deadline before we split it into start/end).
const getItemEnd = (it) => it?.end || it?.dueDate || '';
const getItemStart = (it) => it?.start || '';

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
  // Peter Thiel
  { text: '競爭是輸家在玩的遊戲。', author: 'Peter Thiel' },
  { text: '我們想要的是飛行車，得到的卻是 140 個字元。', author: 'Peter Thiel' },
  { text: '壟斷才是每個成功企業的真實狀態，但壟斷者總是假裝自己不是壟斷。', author: 'Peter Thiel' },
  { text: '真正的創新是從 0 到 1，不是從 1 到 n。', author: 'Peter Thiel' },
  { text: '商業中的每個時刻只發生一次。下一個賈伯斯不會做 iPhone，下一個祖克伯不會做社群網站。', author: 'Peter Thiel' },
  { text: '最逆主流的事，不是反對群眾，而是自己思考。', author: 'Peter Thiel' },
  { text: '從一個小到能被你壟斷的市場開始。', author: 'Peter Thiel' },
  { text: '全球化是水平的進步；科技是垂直的進步。', author: 'Peter Thiel' },
  { text: '新創公司是你能說服一群人相信、能打造不同未來的最大團體。', author: 'Peter Thiel' },
  { text: '創造新市場比在現有市場搶占份額容易得多。', author: 'Peter Thiel' },
  { text: '想創造並掌握長期價值，就不要做沒有差異的商品事業。', author: 'Peter Thiel' },
  { text: '失敗的公司逃不過競爭，成功的公司逃離競爭。', author: 'Peter Thiel' },
  { text: '勇氣比天才更稀缺。', author: 'Peter Thiel' },
  { text: '壞的計畫好過沒有計畫。', author: 'Peter Thiel' },
  { text: '相信「明天的世界會自然變好」是最危險的想法。', author: 'Peter Thiel' },
  { text: '科技不是運氣的產物，是長期、刻意的選擇。', author: 'Peter Thiel' },
  { text: '創業者必須同時樂觀地相信會成功、悲觀地為失敗做準備。', author: 'Peter Thiel' },
  { text: '在還沒人相信你之前，先問自己：你相信什麼別人不相信的真理？', author: 'Peter Thiel' },
  { text: '銷售比產品更難被看見，但它跟產品同樣重要。', author: 'Peter Thiel' },
  { text: '錢是讓你不必再為錢工作的工具，不是炫耀的勳章。', author: 'Peter Thiel' },
];

// Deterministic Fisher-Yates shuffle (fixed seed) so authors interleave instead of
// appearing in 20-day clumps. Computed once at script load.
const SHUFFLED_QUOTES = (() => {
  const arr = [...DAILY_QUOTES];
  let seed = 1729; // any fixed seed
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 2147483648;
    return seed / 2147483648;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
})();

function getDailyQuote() {
  // Use full date as key so the quote changes each calendar day, not each script reload.
  const d = TODAY;
  const key = d.getFullYear() * 372 + (d.getMonth() + 1) * 31 + d.getDate();
  return SHUFFLED_QUOTES[key % SHUFFLED_QUOTES.length];
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
            <div className="dot"></div>
            <span className="seg-label">{s.label}</span>
          </button>
        ) : variant === 'blocks' ? (
          <button key={s.id} className={cls} data-stage-id={s.id} onClick={handleClick} title={`${s.label} — Shift+點擊切換狀態`}>
            <span className="status-pip"></span>
            <span className="seg-label">{s.label}</span>
          </button>
        ) : (
          <button key={s.id} className={cls} data-stage-id={s.id} onClick={handleClick} title={`${s.label} — Shift+點擊切換狀態`}>
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
  const [dragOverItemId, setDragOverItemId] = useState(null);

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
  // Add either from the custom text input OR from a quick-pick (preset/alt) item
  const addItem = (text) => {
    const t = text.trim();
    if (!t) return;
    onUpdate({
      ...stage,
      items: [...stage.items, { id: uid('i'), text: t, done: false, status: 'todo', start: '', end: '' }]
    });
  };
  const add = (e) => {
    e?.preventDefault();
    if (!draft.trim()) return;
    addItem(draft);
    setDraft('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // Drag-reorder: when one item-bar is dropped onto another, move it to that position.
  const onItemDrop = (targetId) => (e) => {
    if (!e.dataTransfer.types.includes('application/x-item-reorder')) return;
    e.preventDefault();
    setDragOverItemId(null);
    const sourceId = e.dataTransfer.getData('application/x-item-reorder');
    if (!sourceId || sourceId === targetId) return;
    const items = [...stage.items];
    const fromIdx = items.findIndex(x => x.id === sourceId);
    const toIdx = items.findIndex(x => x.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    onUpdate({ ...stage, items });
  };

  // Auto-sort by date (one-click). Items without dates fall to the bottom.
  const autoSort = () => {
    onUpdate({ ...stage, items: sortItemsByDate(stage.items) });
  };

  // Build list of available pre-defined items for the dropdown.
  // We show items from EVERY stage template (grouped by stage label), filtered
  // to exclude items already present in the current stage. This way the dropdown
  // is always useful — even for older stages whose label doesn't match a current
  // template, the user can still pick from the full library of pre-defined items.
  const presentTexts = new Set(stage.items.map(x => x.text));
  const allStagesAvailable = DEFAULT_STAGES_TPL.map(t => ({
    label: t.label,
    items: [...t.items, ...(t.altItems || [])].filter(text => !presentTexts.has(text)),
  })).filter(g => g.items.length > 0);
  const hasAnyAvailable = allStagesAvailable.length > 0;

  const onQuickPick = (e) => {
    const val = e.target.value;
    if (!val) return;
    addItem(val);
    e.target.value = ''; // reset dropdown
  };

  const confirmedCount = stage.items.filter(it => itemStatus(it) === 'confirmed').length;
  const doneCount = stage.items.filter(it => itemStatus(it) === 'done').length;
  const activeCount = stage.items.filter(it => itemStatus(it) === 'active').length;
  const blockedCount = stage.items.filter(it => itemStatus(it) === 'blocked').length;

  return (
    <div className="detail-section" style={{ gridColumn: '1 / -1' }}>
      <div className="checklist-header">
        <div className="section-label">工作項目</div>
        <div className="checklist-header-right">
          <button className="btn btn-ghost small" onClick={autoSort} title="把有日期的項目按起始日期排前面">↕ 按日期排序</button>
          <div className="stage-progress-mini">
            {confirmedCount > 0 && <span>{confirmedCount} 確認 · </span>}
            {doneCount > 0 && <span>{doneCount} 完成 · </span>}
            {activeCount > 0 && <span>{activeCount} 進行中 · </span>}
            {blockedCount > 0 && <span className="blocked-count">{blockedCount} 排除問題 · </span>}
            共 {stage.items.length}
          </div>
        </div>
      </div>
      <div className="item-bars">
        {stage.items.map(it => {
          const st = itemStatus(it);
          return (
            <div
              key={it.id}
              className={`item-bar status-${st} ${dragOverItemId === it.id ? 'reorder-target' : ''}`}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes('application/x-item-reorder')) {
                  e.preventDefault();
                  setDragOverItemId(it.id);
                }
              }}
              onDragLeave={() => { if (dragOverItemId === it.id) setDragOverItemId(null); }}
              onDrop={onItemDrop(it.id)}
            >
              <div
                className="item-drag-handle"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('application/x-item-reorder', it.id);
                }}
                title="拖曳調整順序"
              >⋮⋮</div>
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
                  <select
                    autoFocus
                    defaultValue={it.text}
                    className="input select item-bar-edit-select"
                    onChange={(e) => {
                      const v = e.target.value;
                      const finish = (newText) => onUpdate({
                        ...stage,
                        items: stage.items.map(x => x.id === it.id
                          ? { ...x, text: newText, editing: false }
                          : x)
                      });
                      const cancel = () => onUpdate({
                        ...stage,
                        items: stage.items.map(x => x.id === it.id ? { ...x, editing: false } : x)
                      });
                      if (v === '__custom__') {
                        const custom = window.prompt('輸入自訂項目名稱：', it.text);
                        const trimmed = (custom || '').trim();
                        if (!trimmed) { cancel(); return; }
                        finish(trimmed);
                        return;
                      }
                      if (v === it.text) { cancel(); return; }
                      finish(v);
                    }}
                    onBlur={() => onUpdate({
                      ...stage,
                      items: stage.items.map(x => x.id === it.id ? { ...x, editing: false } : x)
                    })}
                  >
                    <option value={it.text}>{it.text}（目前）</option>
                    {DEFAULT_STAGES_TPL.map(t => {
                      const opts = [...t.items, ...(t.altItems || [])].filter(x => x !== it.text);
                      return opts.length > 0 ? (
                        <optgroup key={t.label} label={t.label}>
                          {opts.map(text => <option key={text} value={text}>{text}</option>)}
                        </optgroup>
                      ) : null;
                    })}
                    <option value="__custom__">自訂…</option>
                  </select>
                </div>
              ) : (
                <span className="item-bar-text">{it.text}</span>
              )}
              <div className="item-bar-dates">
                <input
                  type="date"
                  className={`date-input compact item-bar-date ${getItemStart(it) ? 'has-date' : 'empty'}`}
                  value={getItemStart(it)}
                  title={getItemStart(it) ? `起：${getItemStart(it)}` : '起始日（可留空，當作單日截止）'}
                  onChange={e => onUpdate({ ...stage, items: stage.items.map(x => x.id === it.id ? { ...x, start: e.target.value } : x) })}
                />
                <span className="item-bar-date-sep">→</span>
                <input
                  type="date"
                  className={`date-input compact item-bar-date ${getItemEnd(it) ? 'has-date' : 'empty'}`}
                  value={getItemEnd(it)}
                  title={getItemEnd(it) ? `迄：${getItemEnd(it)}` : '結束 / 交付日（會出現在行事曆）'}
                  onChange={e => onUpdate({ ...stage, items: stage.items.map(x => x.id === it.id ? { ...x, end: e.target.value, dueDate: '' } : x) })}
                />
              </div>
              <ItemStatusDropdown value={st} onChange={(newSt) => setItemStatus(it.id, newSt)} />
            </div>
          );
        })}
      </div>
      <div className="add-item-row">
        <form onSubmit={add} className="add-item-form">
          <input
            ref={inputRef}
            className="input"
            placeholder="自訂新項目…"
            value={draft}
            onChange={e => setDraft(e.target.value)}
          />
          <button type="submit" className="add-item-btn" aria-label="新增">+</button>
        </form>
        {hasAnyAvailable && (
          <select className="input select item-quick-pick" defaultValue="" onChange={onQuickPick}>
            <option value="">+ 從預設加入…</option>
            {allStagesAvailable.map(({ label, items }) => (
              <optgroup key={label} label={label}>
                {items.map(t => <option key={t} value={t}>{t}</option>)}
              </optgroup>
            ))}
          </select>
        )}
      </div>
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
// ---------- Money input (千分位 + 點下去 0 自動消失) ----------
// Used everywhere a NT$ amount is edited so users see "10,000" not "10000".
function MoneyInput({ value, onChange, className = 'num-input', placeholder, ...rest }) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const num = Number(value) || 0;
  const display = focused ? String(num) : num.toLocaleString('en-US');

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={className}
      placeholder={placeholder}
      value={display}
      onFocus={(e) => {
        setFocused(true);
        // Defer so React re-renders with the comma-less value before we select it
        setTimeout(() => { try { e.target.select(); } catch {} }, 0);
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const stripped = e.target.value.replace(/[^\d-]/g, '');
        const n = stripped === '' || stripped === '-' ? 0 : Number(stripped);
        onChange(Number.isFinite(n) ? n : 0);
      }}
      {...rest}
    />
  );
}

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

// ---------- Fixed-cost allocation ----------
// Per-month "full absorption" model: each calendar month's full fixed expense
// (settings.monthlyFixedExpense) MUST be absorbed by the projects active in that
// month, even if those projects don't span the whole month. Within a month, the
// burden is split among active projects proportional to each project's active
// days in that month.
//
// Why month-based: the previous per-day algorithm under-absorbed fixed cost
// whenever projects didn't fill every day of a month, leaving "orphan" cost
// that distorted profit numbers. With this model, total absorbed across all
// projects equals (months_with_any_project × monthly_fixed).
//
// Returns a Map<projectId, allocatedFixedCost (number)>.
function computeFixedCostAllocations(projects, monthlyFixedExpense) {
  const out = {};
  const monthly = Number(monthlyFixedExpense) || 0;
  // Include all non-deleted projects (active + archived); archived projects
  // consumed their share when they were running, so they affect concurrent
  // overlap with currently-active projects.
  const valid = (projects || []).filter(p => !p.deleted && p.start && p.due);
  for (const p of valid) out[p.id] = 0;
  if (monthly === 0 || valid.length === 0) return out;

  // Collect every (year, month) where at least one project is active.
  const monthSet = new Set();
  for (const p of valid) {
    const s = new Date(p.start);
    const e = new Date(p.due);
    if (isNaN(s) || isNaN(e) || s > e) continue;
    const cursor = new Date(s.getFullYear(), s.getMonth(), 1);
    const stop = new Date(e.getFullYear(), e.getMonth(), 1);
    while (cursor <= stop) {
      monthSet.add(`${cursor.getFullYear()}-${cursor.getMonth()}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  for (const monthKey of monthSet) {
    const [yearStr, monthStr] = monthKey.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const monthStart = new Date(year, month, 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(year, month + 1, 0); // last day of month
    monthEnd.setHours(0, 0, 0, 0);

    const daysPerProject = {};
    let totalDays = 0;
    for (const p of valid) {
      const ps = new Date(p.start); ps.setHours(0, 0, 0, 0);
      const pe = new Date(p.due);   pe.setHours(0, 0, 0, 0);
      // Clamp to this month
      const segStart = ps > monthStart ? ps : monthStart;
      const segEnd   = pe < monthEnd   ? pe : monthEnd;
      if (segStart > segEnd) continue; // no overlap with this month
      const days = Math.round((segEnd - segStart) / 86400000) + 1; // inclusive
      daysPerProject[p.id] = days;
      totalDays += days;
    }
    if (totalDays === 0) continue;

    // Spread the full month's fixed expense across active projects in proportion
    // to each project's days in this month.
    for (const pId of Object.keys(daysPerProject)) {
      out[pId] += monthly * daysPerProject[pId] / totalDays;
    }
  }
  return out;
}

// ---------- Cost Panel ----------
// fixedCostOverride: optional. When given (from computeFixedCostAllocations), use
// it as the project's allocated fixed cost. When omitted, fall back to the
// legacy per-project fixedMonthly * months calc (for projects that pre-date the
// global setting).
function calcCosts(project, fixedCostOverride, monthlyFixedExpenseGlobal) {
  const start = project.start ? new Date(project.start) : null;
  const due = project.due ? new Date(project.due) : null;
  const days = (start && due && !isNaN(start) && !isNaN(due)) ? Math.max(1, daysBetween(start, due)) : 0;
  const months = days / 30;

  let fixedCost;
  if (typeof fixedCostOverride === 'number') {
    fixedCost = fixedCostOverride;
  } else {
    const fallbackMonthly = (typeof monthlyFixedExpenseGlobal === 'number' && monthlyFixedExpenseGlobal > 0)
      ? monthlyFixedExpenseGlobal
      : (project.fixedMonthly || 0);
    fixedCost = fallbackMonthly * months;
  }

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

  // Extra confirmed expenses (planned outflows).
  // Unconfirmed entries are NOT included — toggling 確認付款 brings them in/out instantly.
  const extras = settings.extraExpenses || [];
  for (const ex of extras) {
    if (!ex.confirmed) continue;
    if (!ex.plannedDate) continue;
    const d = new Date(ex.plannedDate);
    if (isNaN(d) || d < start || d > end) continue;
    const amt = Number(ex.amount) || 0;
    if (amt <= 0) continue;
    const typeLabel = normalizeExpenseType(ex.type);
    events.push({
      date: d,
      amount: -amt,
      label: `${ex.name || '未命名'} · ${typeLabel}`,
      kind: 'extra',
    });
  }

  // ---- 應繳營業稅（雙月一期，下一期第一個月 5 號繳） ----
  // 跨所有案合併：本期銷項稅 − 本期進項稅 = 本期應繳；抵不完的進項留底結轉到下一期。
  // 海外案不收銷項稅，但其公司外包進項稅依然進入該期合併扣抵（國稅局看公司全體）。
  const vatPeriods = new Map();
  const ensureVatPeriod = (info) => {
    if (!vatPeriods.has(info.key)) {
      vatPeriods.set(info.key, { dueDate: info.dueDate, periodLabel: info.periodLabel, salesVAT: 0, inputVAT: 0 });
    }
    return vatPeriods.get(info.key);
  };
  for (const p of projects) {
    if (p.deleted) continue;
    const pBudget = Number(p.budget) || 0;
    if (p.overseas !== true) {
      for (const pay of getPayments(p)) {
        if (!pay.dueDate) continue;
        const d = new Date(pay.dueDate);
        if (isNaN(d)) continue;
        const amt = pBudget * (Number(pay.percentage) || 0) / 100;
        if (amt <= 0) continue;
        const info = vatPeriodInfo(d);
        if (!info) continue;
        ensureVatPeriod(info).salesVAT += amt * 0.05 / 1.05;
      }
    }
    const outDateForVAT = getOutsourcePayDate(p);
    if (outDateForVAT) {
      const d = new Date(outDateForVAT);
      if (!isNaN(d)) {
        const taxableInput = (p.outsources || [])
          .filter(o => o.taxable)
          .reduce((sum, o) => sum + (Number(o.amount) || 0) * 0.05, 0);
        if (taxableInput > 0) {
          const info = vatPeriodInfo(d);
          if (info) ensureVatPeriod(info).inputVAT += taxableInput;
        }
      }
    }
  }
  const sortedVatPeriods = [...vatPeriods.values()].sort((a, b) => a.dueDate - b.dueDate);
  let vatCarryover = 0;
  const enrichedVatPeriods = [];
  for (const period of sortedVatPeriods) {
    const carryIn = vatCarryover;
    const availableInput = period.inputVAT + carryIn;
    const netVAT = Math.max(0, period.salesVAT - availableInput);
    const carryOut = Math.max(0, availableInput - period.salesVAT);
    vatCarryover = carryOut;
    enrichedVatPeriods.push({ ...period, carryIn, netVAT, carryOut });
    if (netVAT <= 0) continue;
    if (period.dueDate < start || period.dueDate > end) continue;
    events.push({
      date: period.dueDate,
      amount: -netVAT,
      label: `${period.periodLabel} 應繳營業稅`,
      kind: 'vat',
    });
  }

  events.sort((a, b) => a.date - b.date);

  // Cumulative points; first point is the starting balance.
  // 同時累積「收入」「支出」兩條獨立 series，給多圖表 view 用。
  let running = balance;
  let cumIncome = 0;
  let cumExpense = 0;
  const points = [{ date: new Date(start), balance: running, cumIncome: 0, cumExpense: 0, label: '起算日', amount: 0, kind: 'start' }];
  for (const e of events) {
    running += e.amount;
    if (e.amount >= 0) cumIncome += e.amount;
    else cumExpense += -e.amount;
    points.push({ date: e.date, balance: running, cumIncome, cumExpense, label: e.label, amount: e.amount, kind: e.kind });
  }
  // Add a synthetic point at the horizon end so the line extends to the right edge
  if (points[points.length - 1].date < end) {
    points.push({ date: new Date(end), balance: running, cumIncome, cumExpense, label: '', amount: 0, kind: 'end' });
  }

  const minBalance = Math.min(...points.map(p => p.balance));
  const goesNegative = minBalance < 0;
  const negativeAt = goesNegative ? points.find(p => p.balance < 0) : null;

  // Aggregate by month for the two-line chart (income vs expense).
  const months = [];
  for (let i = 0; i < horizonMonths; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    months.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: `${String(d.getMonth() + 1).padStart(2, '0')}月`,
      fullLabel: `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`,
      income: 0,
      expense: 0,
    });
  }
  for (const e of events) {
    const mi = months.findIndex(m => m.year === e.date.getFullYear() && m.month === e.date.getMonth());
    if (mi < 0) continue;
    if (e.amount >= 0) months[mi].income += e.amount;
    else months[mi].expense += -e.amount;
  }

  return { points, events, months, startBalance: balance, minBalance, goesNegative, negativeAt, start, end, vatPeriods: enrichedVatPeriods };
}

// ---------- Calendar event aggregator ----------
// Walks all non-deleted projects + global settings and emits dated events
// across the whole production + finance lifecycle.
function buildCalendarEvents(projects) {
  const events = [];

  for (const p of projects) {
    if (p.deleted) continue;

    // Project delivery deadline
    if (p.due) {
      events.push({
        date: p.due,
        kind: 'delivery',
        projectId: p.id,
        projectTitle: p.title,
        label: '交件',
        detail: p.client,
      });
    }

    // Stages — start / end
    for (const s of (p.stages || [])) {
      if (s.start) events.push({
        date: s.start,
        kind: 'stage-start',
        projectId: p.id,
        projectTitle: p.title,
        label: `${s.label} 開始`,
        stageId: s.id,
      });
      if (s.end) events.push({
        date: s.end,
        kind: 'stage-end',
        projectId: p.id,
        projectTitle: p.title,
        label: `${s.label} 結束`,
        stageId: s.id,
      });
      // Item dates: if both start AND end are set (and different), emit one SPAN
      // event so the month view can render a multi-day bar. Otherwise emit a single
      // point event using whichever date is set.
      for (const it of (s.items || [])) {
        const iStart = getItemStart(it);
        const iEnd = getItemEnd(it);
        if (iStart && iEnd && iStart !== iEnd) {
          events.push({
            date: iStart,
            startDate: iStart,
            endDate: iEnd,
            kind: 'item-span',
            projectId: p.id,
            projectTitle: p.title,
            label: it.text,
            stageId: s.id,
            itemId: it.id,
            stageLabel: s.label,
          });
        } else if (iEnd) {
          events.push({
            date: iEnd,
            kind: 'item-due',
            projectId: p.id,
            projectTitle: p.title,
            label: it.text,
            stageId: s.id,
            itemId: it.id,
            stageLabel: s.label,
          });
        } else if (iStart) {
          events.push({
            date: iStart,
            kind: 'item-start',
            projectId: p.id,
            projectTitle: p.title,
            label: it.text,
            stageId: s.id,
            itemId: it.id,
            stageLabel: s.label,
          });
        }
      }
    }

    // Payments (incoming money)
    const payments = getPayments(p);
    const budget = Number(p.budget) || 0;
    for (const pay of payments) {
      if (!pay.dueDate) continue;
      events.push({
        date: pay.dueDate,
        kind: 'payment-in',
        projectId: p.id,
        projectTitle: p.title,
        label: pay.label,
        amount: budget * (Number(pay.percentage) || 0) / 100,
        paymentId: pay.id,
      });
    }

    // Outsource payment (outgoing money)
    const outDate = getOutsourcePayDate(p);
    const outTotal = (p.outsources || []).reduce((a, o) => a + (Number(o.amount) || 0), 0);
    if (outDate && outTotal > 0) {
      events.push({
        date: outDate,
        kind: 'payment-out',
        projectId: p.id,
        projectTitle: p.title,
        label: '外包付款',
        amount: outTotal,
      });
    }
  }

  // Sort by date ascending
  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return events;
}

// Apply a drag/drop or resize on a calendar event back into the project data.
// Returns the patch to merge into the project, or null if no change needed.
function patchForCalendarEvent(project, eventInfo, newDate) {
  const { kind, stageId, itemId, paymentId } = eventInfo;
  if (!newDate) return null;
  switch (kind) {
    case 'delivery':
      return { due: newDate };
    case 'stage-start':
    case 'stage-end': {
      const field = kind === 'stage-start' ? 'start' : 'end';
      return {
        stages: project.stages.map(s => s.id === stageId ? { ...s, [field]: newDate } : s),
      };
    }
    case 'item-start':
      return {
        stages: project.stages.map(s => {
          if (s.id !== stageId) return s;
          return { ...s, items: s.items.map(it => it.id === itemId ? { ...it, start: newDate } : it) };
        }),
      };
    case 'item-due':
      return {
        stages: project.stages.map(s => {
          if (s.id !== stageId) return s;
          // Migrate from legacy dueDate to new end field on drag
          return { ...s, items: s.items.map(it => it.id === itemId ? { ...it, end: newDate, dueDate: '' } : it) };
        }),
      };
    case 'item-span': {
      // Preserve duration: shift end by same delta as start
      const oldStart = eventInfo.startDate;
      const oldEnd = eventInfo.endDate;
      const duration = daysBetween(new Date(oldStart), new Date(oldEnd));
      const newEnd = addDays(newDate, duration);
      return {
        stages: project.stages.map(s => {
          if (s.id !== stageId) return s;
          return { ...s, items: s.items.map(it => it.id === itemId ? { ...it, start: newDate, end: newEnd, dueDate: '' } : it) };
        }),
      };
    }
    case 'payment-in':
      return {
        payments: getPayments(project).map(p => p.id === paymentId ? { ...p, dueDate: newDate } : p),
      };
    case 'payment-out':
      return { outsourcePayDate: newDate };
    default:
      return null;
  }
}

// Apply a stage-bar resize (shift start, end, or both)
function patchForStageBarChange(project, stageId, { start, end }) {
  return {
    stages: project.stages.map(s => {
      if (s.id !== stageId) return s;
      const next = { ...s };
      if (start !== undefined) next.start = start;
      if (end !== undefined) next.end = end;
      return next;
    }),
  };
}

// ---------- Export-to-Claude snapshot ----------
// Builds a Chinese-labelled JSON dump of EVERYTHING Claude needs to discuss
// finance / projects / cash flow with the user, without them re-typing state.
function buildExportData(allProjects, settings) {
  const today = toISODate(TODAY);
  const active   = allProjects.filter(p => !p.archived && !p.deleted);
  const archived = allProjects.filter(p => p.archived && !p.deleted);

  const hasSettings = settings && settings.bankBalance !== undefined && settings.bankBalance !== null && settings.bankBalance !== '';
  const series = hasSettings ? buildCashflowSeries(allProjects.filter(p => !p.deleted), settings, 12) : null;

  const stageStatusZH = { todo: '未開始', active: '進行中', done: '已完成' };
  const itemStatusZH = { todo: '未開始', active: '進行中', blocked: '卡關', done: '完成', confirmed: '已確認' };

  const monthlyFixed = Number(settings?.monthlyFixedExpense) || 0;
  const allocations = computeFixedCostAllocations(allProjects, monthlyFixed);

  const projectToExport = (p) => {
    const c = calcCosts(p, allocations[p.id], monthlyFixed);
    const payments = getPayments(p);
    const totalItems = p.stages.reduce((a, s) => a + s.items.length, 0);
    const doneItems  = p.stages.reduce((a, s) => a + s.items.filter(it => {
      const st = itemStatus(it);
      return st === 'done' || st === 'confirmed';
    }).length, 0);
    const pct = totalItems ? Math.round((doneItems / totalItems) * 100) : 0;
    const currentStage = p.stages.find(s => s.status === 'active')
      || [...p.stages].reverse().find(s => s.status === 'done')
      || p.stages[0];
    const daysToDue = p.due ? daysBetween(TODAY, new Date(p.due)) : null;

    return {
      "專案名稱": p.title,
      "客戶": p.client,
      "起始日期": p.start || null,
      "交件日期": p.due || null,
      "距離交件天數": daysToDue,
      "案件類型": p.overseas ? '國外案' : '國內案',
      "合約金額_含稅": Number(p.budget) || 0,
      "未稅金額": c.preTax,
      "應繳營業稅": c.netVAT,
      "外包總額": c.outsourceTotal,
      "其中公司外包": c.companyOutsource,
      "其中個人外包": c.personalOutsource,
      "可抵扣進項稅": c.creditableInputTax,
      "分攤固定成本": Math.round(c.fixedCost),
      "預估淨利": Math.round(c.profit),
      "淨利率": (p.budget ? Math.round(c.profit / p.budget * 100) : 0) + '%',
      "進度": pct + '%',
      "現階段": currentStage ? currentStage.label : null,
      "現階段狀態": currentStage ? stageStatusZH[currentStage.status] || currentStage.status : null,
      "收款排程": payments.map(pay => ({
        "款項": pay.label,
        "比例": (Number(pay.percentage) || 0) + '%',
        "預計收款日": pay.dueDate || null,
        "金額": Math.round((Number(p.budget) || 0) * (Number(pay.percentage) || 0) / 100),
      })),
      "外包付款日": getOutsourcePayDate(p) || null,
      "外包明細": (p.outsources || []).map(o => ({
        "項目": o.name || '(未命名)',
        "類型": o.type === 'company' ? '公司' : '個人',
        "金額": Number(o.amount) || 0,
        "可抵稅": !!o.taxable,
      })),
      "階段細節": p.stages.map(s => ({
        "階段": s.label,
        "狀態": stageStatusZH[s.status] || s.status,
        "起": s.start || null,
        "迄": s.end || null,
        "備註": s.note || null,
        "細項": (s.items || []).map(it => ({
          "內容": it.text,
          "狀態": itemStatusZH[itemStatus(it)] || itemStatus(it),
        })),
      })),
      "相關連結": p.references || [],
    };
  };

  const cashflowSummary = !series ? {
    "狀態": "尚未設定銀行餘額，無法估算",
  } : {
    "起算日": settings.startDate || today,
    "起算日銀行餘額": series.startBalance,
    "每月固定支出": settings.monthlyFixedExpense || 0,
    "每月扣款日": settings.deductionDay || 31,
    "未來12個月最低點_含已確認試算": Math.max(0, series.minBalance),
    "見底日": series.goesNegative && series.negativeAt ? toISODate(series.negativeAt.date) : null,
    "目前狀態": series.goesNegative ? '⚠ 12個月內會見底' : '✓ 12個月內不會見底',
    "12個月內所有事件": series.points
      .filter(pt => pt.kind !== 'start' && pt.kind !== 'end')
      .map(pt => ({
        "日期": toISODate(pt.date),
        "事件": pt.label,
        "類型": pt.kind === 'income' ? '收入'
              : pt.kind === 'fixed' ? '每月固定支出'
              : pt.kind === 'outsource' ? '外包付款'
              : pt.kind === 'extra' ? '額外支出'
              : pt.kind,
        "進出帳": pt.amount,
        "事件後餘額": pt.balance,
      })),
  };

  const extras = settings.extraExpenses || [];
  const extrasConfirmed = extras.filter(e => e.confirmed);
  const extrasDraft     = extras.filter(e => !e.confirmed);
  const extraExpenseSection = {
    "已確認_有進現金流": extrasConfirmed.map(e => ({
      "名稱": e.name || '(未命名)',
      "類型": normalizeExpenseType(e.type),
      "金額": Number(e.amount) || 0,
      "預計付款日": e.plannedDate || null,
    })),
    "試算中_未進現金流": extrasDraft.map(e => ({
      "名稱": e.name || '(未命名)',
      "類型": normalizeExpenseType(e.type),
      "金額": Number(e.amount) || 0,
      "預計付款日": e.plannedDate || null,
    })),
    "已確認總額": extrasConfirmed.reduce((a, e) => a + (Number(e.amount) || 0), 0),
    "試算中總額": extrasDraft.reduce((a, e) => a + (Number(e.amount) || 0), 0),
  };

  const activeBudgetTotal = active.reduce((a, p) => a + (Number(p.budget) || 0), 0);
  const activeProfitTotal = active.reduce((a, p) => a + calcCosts(p, allocations[p.id], monthlyFixed).profit, 0);
  const activeFixedTotal  = active.reduce((a, p) => a + (allocations[p.id] || 0), 0);

  return {
    "_說明": "這份檔案是 jt745 進度追蹤器在某時刻的快照，給 Claude 用來討論財務 / 專案決策。固定成本採『按月分攤』：每個月的全域固定支出由當月活躍的所有非刪除專案按各案在當月的天數比例分擔；當月只有一案時，該案吸收當月全額。",
    "匯出時間": new Date().toISOString(),
    "今日日期": today,
    "全域設定": hasSettings ? {
      "起算日": settings.startDate,
      "銀行存款餘額": settings.bankBalance,
      "每月固定支出": settings.monthlyFixedExpense || 0,
      "每月扣款日": settings.deductionDay || 31,
    } : "尚未設定",
    "進行中專案總覽": {
      "案件數": active.length,
      "合約金額合計_含稅": activeBudgetTotal,
      "分攤固定成本合計": Math.round(activeFixedTotal),
      "預估淨利合計": Math.round(activeProfitTotal),
    },
    "現金流量預估_未來12個月": cashflowSummary,
    "額外支出試算": extraExpenseSection,
    "進行中專案": active.map(projectToExport),
    "已歸檔專案": archived.map(projectToExport),
    "自訂支出類別": settings.customExpenseCategories || [],
  };
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function PaymentSchedule({ project, onUpdate }) {
  const payments = getPayments(project);
  const budget = Number(project.budget) || 0;
  const totalPct = payments.reduce((a, p) => a + (Number(p.percentage) || 0), 0);

  // When changing one row's percentage, auto-balance the OTHERS so total stays 100.
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

  // When the LAST payment (尾款) date changes, preserve the offset to the
  // outsource pay date so users don't have to manually re-align it.
  const setDate = (id, dueDate) => {
    const next = payments.map(p => p.id === id ? { ...p, dueDate } : p);
    const patch = { payments: next };
    const idx = payments.findIndex(p => p.id === id);
    const oldFinal = payments[payments.length - 1];
    if (idx === payments.length - 1 && oldFinal?.dueDate && dueDate) {
      // Outsource date currently in effect (may be derived or explicit)
      const currentOutsource = getOutsourcePayDate(project);
      if (currentOutsource) {
        const offset = daysBetween(new Date(oldFinal.dueDate), new Date(currentOutsource));
        // Preserve offset (e.g. always "N days after 尾款")
        patch.outsourcePayDate = addDays(dueDate, offset);
      }
    }
    onUpdate({ ...project, ...patch });
  };

  const setOutsourcePayDate = (val) => {
    onUpdate({ ...project, outsourcePayDate: val });
  };

  // Delete a payment row. Remaining row(s) get rescaled so total stays 100%.
  // Common case: delete 頭款 → 尾款 becomes 100%.
  const deletePayment = (id) => {
    if (payments.length <= 1) return;
    const remaining = payments.filter(p => p.id !== id).map(p => ({ ...p }));
    const sumLeft = remaining.reduce((a, p) => a + (Number(p.percentage) || 0), 0);
    if (sumLeft > 0) {
      const factor = 100 / sumLeft;
      remaining.forEach(p => { p.percentage = Math.round((Number(p.percentage) || 0) * factor); });
      // Fix rounding drift so the total is exactly 100
      const drift = 100 - remaining.reduce((a, p) => a + p.percentage, 0);
      if (drift !== 0) remaining[0].percentage += drift;
    } else {
      remaining[0].percentage = 100;
    }
    onUpdate({ ...project, payments: remaining });
  };

  const outsourcePayDate = getOutsourcePayDate(project);
  const hasOutsources = (project.outsources || []).length > 0;
  const outsourceOffset = (outsourcePayDate && payments[payments.length - 1]?.dueDate)
    ? daysBetween(new Date(payments[payments.length - 1].dueDate), new Date(outsourcePayDate))
    : null;

  return (
    <div className="cost-section">
      <div className="cost-section-h">
        <div className="cost-block-h">
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
          <div></div>
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
            {payments.length > 1 ? (
              <button className="delete-item visible" onClick={() => deletePayment(p.id)} title="刪除這筆款項（剩餘的會自動補到 100%）">×</button>
            ) : <div></div>}
          </div>
        ))}
      </div>

      {hasOutsources && (
        <div className="payment-aux">
          <span className="aux-label">外包付款日</span>
          <input type="date" className="date-input compact"
            value={outsourcePayDate}
            onChange={e => setOutsourcePayDate(e.target.value)} />
          <span className="aux-hint">
            {outsourceOffset == null
              ? '尚未設定'
              : outsourceOffset === 0 ? '＝ 尾款同一天'
              : outsourceOffset > 0 ? `＝ 尾款入帳後 ${outsourceOffset} 天`
              : `＝ 尾款前 ${Math.abs(outsourceOffset)} 天`}
            {outsourceOffset !== 5 && payments[payments.length - 1]?.dueDate && (
              <>
                {' '}
                <button
                  className="link-btn-inline"
                  onClick={() => setOutsourcePayDate(addDays(payments[payments.length - 1].dueDate, 5))}
                  title="重設為「尾款入帳後 5 天」">↺ 改為 +5 天</button>
              </>
            )}
            。改尾款日期時自動跟著移。
          </span>
        </div>
      )}
    </div>
  );
}

function CostPanel({ project, onUpdate, fixedCostShare, monthlyFixedExpense, onOpenCashSettings, outsourceRoles, customOutsourceRoles, onUpdateCustomOutsourceRoles }) {
  const c = useMemo(
    () => calcCosts(project, fixedCostShare, monthlyFixedExpense),
    [project, fixedCostShare, monthlyFixedExpense]
  );
  const update = (patch) => onUpdate({ ...project, ...patch });
  const [detailsOpen, setDetailsOpen] = useState(true);

  const addOutsource = () => {
    update({ outsources: [...(project.outsources || []), { id: uid('o'), name: '', type: 'company', amount: 0, taxable: true }] });
  };
  const updateOutsource = (id, patch) => {
    update({ outsources: project.outsources.map(o => o.id === id ? { ...o, ...patch } : o) });
  };
  const removeOutsource = (id) => {
    update({ outsources: project.outsources.filter(o => o.id !== id) });
  };

  const addCustomRole = () => {
    const raw = window.prompt('新增外包角色名稱（之後在所有專案的下拉都會出現）：');
    if (raw == null) return;
    const name = raw.trim();
    if (!name) return;
    if ((outsourceRoles || []).includes(name)) {
      alert(`角色「${name}」已經存在。`);
      return;
    }
    onUpdateCustomOutsourceRoles && onUpdateCustomOutsourceRoles([...(customOutsourceRoles || []), name]);
  };

  const profitPct = project.budget ? Math.round((c.profit / project.budget) * 100) : 0;

  return (
    <div className="cost-panel">
      <div className="cost-header">
        <div>
          <div className="detail-eyebrow">{project.title} · 成本結構</div>
          <h3 className="detail-title">財務概覽</h3>
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

      <div className="cost-details-toggle-row">
        <button className="cost-details-toggle" onClick={() => setDetailsOpen(o => !o)} title={detailsOpen ? '收起明細，只看淨利' : '展開明細'}>
          <span className="chevron">{detailsOpen ? '▾' : '▸'}</span>
          <span>{detailsOpen ? '收起明細' : '展開明細'}</span>
        </button>
      </div>

      {detailsOpen && (<>
      <div className="cost-grid">
        {/* Fixed cost */}
        <div className="cost-block">
          <div className="cost-block-h">
            <span>公司固定成本</span>
          </div>
          <div className="cost-row-line">
            <span>每月固定支出（全域）</span>
            <span className="num-val muted">
              {fmtNT(monthlyFixedExpense || 0)}
              {onOpenCashSettings && (
                <button className="link-btn-inline" onClick={onOpenCashSettings} title="到全域現金流設定修改">改</button>
              )}
            </span>
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
            <span>實際分攤固定成本</span>
            <span className="num-val">{fmtNT(c.fixedCost)}</span>
          </div>
          <div className="cost-row-hint">
            按月分攤：當月固定支出由當月活躍的所有專案，依各案在當月的天數比例分擔。當月只有一案時，該案吸收當月全額。
          </div>
        </div>

        {/* Tax */}
        <div className="cost-block">
          <div className="cost-block-h">
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
              <div className="tax-hint">合約金額為含稅價，稅額 = 含稅價 ÷ 1.05 × 5%。公司外包可抵進項稅，個人外包無發票不可抵。<br/>此處顯示單案估算，<strong>公司實際繳稅</strong>會跨案合併（同期銷項減進項，含跨期留底結轉），以現金流量表為準。</div>
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
            <span>外包支出</span>
            <span className="ghost-pill">公司 {fmtNT(c.companyOutsource)}</span>
            <span className="ghost-pill">個人 {fmtNT(c.personalOutsource)}</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {onUpdateCustomOutsourceRoles && (
              <button className="btn btn-ghost small" onClick={addCustomRole}>+ 新增角色</button>
            )}
            <button className="btn btn-ghost small" onClick={addOutsource}>+ 新增外包項目</button>
          </div>
        </div>

        <div className="outsource-list">
          <div className="outsource-row head">
            <div>角色 / 項目</div>
            <div>類型</div>
            <div>金額</div>
            <div className="center">可抵稅</div>
            <div></div>
          </div>
          {(project.outsources || []).length === 0 && (
            <div className="empty-row">尚無外包支出。點上方按鈕新增。</div>
          )}
          {(project.outsources || []).map(o => {
            const rolesList = outsourceRoles || DEFAULT_OUTSOURCE_ROLES;
            const showOrphan = o.name && !rolesList.includes(o.name);
            const customs = customOutsourceRoles || [];
            return (
              <div key={o.id} className="outsource-row">
                <select className="input select"
                  value={o.name || ''}
                  onChange={e => updateOutsource(o.id, { name: e.target.value })}>
                  <option value="" disabled>選擇角色…</option>
                  {showOrphan && <option value={o.name}>{o.name}</option>}
                  {customs.length > 0 ? (
                    <>
                      <optgroup label="預設">
                        {DEFAULT_OUTSOURCE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </optgroup>
                      <optgroup label="自訂">
                        {customs.map(r => <option key={r} value={r}>{r}</option>)}
                      </optgroup>
                    </>
                  ) : (
                    DEFAULT_OUTSOURCE_ROLES.map(r => <option key={r} value={r}>{r}</option>)
                  )}
                </select>
                <div className="type-toggle">
                  <button className={o.type === 'company' ? 'on' : ''} onClick={() => updateOutsource(o.id, { type: 'company', taxable: true })}>公司</button>
                  <button className={o.type === 'personal' ? 'on' : ''} onClick={() => updateOutsource(o.id, { type: 'personal', taxable: false })}>個人</button>
                </div>
                <MoneyInput
                  value={o.amount}
                  onChange={v => updateOutsource(o.id, { amount: v })} />
                <div className="center">
                  <div className={`check-box ${o.taxable ? 'checked' : ''} ${o.type === 'personal' ? 'disabled' : ''}`}
                    onClick={() => { if (o.type === 'company') updateOutsource(o.id, { taxable: !o.taxable }); }}
                    title={o.type === 'personal' ? '個人外包無法抵稅' : '可抵扣 5% 進項稅'}>
                  </div>
                </div>
                <button className="delete-item visible" onClick={() => removeOutsource(o.id)} title="刪除">×</button>
              </div>
            );
          })}
        </div>
      </div>
      </>)}
    </div>
  );
}

// ---------- Project Card ----------
function ProjectCard({ project, expandedStageId, costsOpen, onStageClick, onCycleStage, onCloseDetail, onUpdateStage, onDeleteStage, onInsertStage, onUpdateProject, onTogglePanel, onDeleteProject, onArchive, onRestore, onPurgeProject, density, stageVariant, dragHandleProps, dropTargetProps, isDragging, isOver, panelStyle, fixedCostShare, monthlyFixedExpense, onOpenCashSettings, outsourceRoles, customOutsourceRoles, onUpdateCustomOutsourceRoles, isFocused, anyFocused }) {
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
      className={`card ${density === 'dense' ? 'dense' : ''} ${isDragging ? 'dragging' : ''} ${isOver ? 'drag-over' : ''} ${canArchive ? 'celebrate' : ''} ${isFocused ? 'focused' : ''} ${anyFocused && !isFocused ? 'dimmed' : ''}`}
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
            <button className={`card-action ${project.infoOpen ? 'on' : ''}`} onClick={() => onTogglePanel(project.id, 'info')} title="專案資訊">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/><path d="M7 6v4M7 4v.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            </button>
            <button className={`card-action ${project.costsOpen ? 'on' : ''}`} onClick={() => onTogglePanel(project.id, 'costs')} title="財務細節">
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
        <CostPanel
          project={project}
          onUpdate={(p) => onUpdateProject(project.id, p)}
          fixedCostShare={fixedCostShare}
          monthlyFixedExpense={monthlyFixedExpense}
          onOpenCashSettings={onOpenCashSettings}
          outsourceRoles={outsourceRoles}
          customOutsourceRoles={customOutsourceRoles}
          onUpdateCustomOutsourceRoles={onUpdateCustomOutsourceRoles}
        />
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
              <MoneyInput className="input" value={form.budget} onChange={v => setForm({ ...form, budget: v })} />
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
        <h2>現金流設定</h2>
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
            <MoneyInput className="input" placeholder="500,000"
              value={form.bankBalance}
              onChange={v => setForm({ ...form, bankBalance: v })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
            <div className="field">
              <label className="field-label">每月固定支出 (NT$)</label>
              <MoneyInput className="input" placeholder="180,000"
                value={form.monthlyFixedExpense}
                onChange={v => setForm({ ...form, monthlyFixedExpense: v })} />
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
              <MoneyInput className="input" value={form.budget} onChange={v => setForm({ ...form, budget: v })} placeholder="500,000" />
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
// Bank balance over time: one line, sharp diagonals, color-coded event dots.
// Line goes UP at income events, DOWN at expense events — naturally shows the cash water-level.
function CashflowChart({ series, viewMode = 'overview' }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  // Re-render the chart when the theme attribute on <html> changes so colours stay readable.
  const [themeVersion, setThemeVersion] = useState(0);
  useEffect(() => {
    const obs = new MutationObserver(() => setThemeVersion(v => v + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!window.Chart || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');

    // Read current theme colours from CSS variables so chart line / ticks / grid
    // always read against the page background.
    const styles = getComputedStyle(document.documentElement);
    const textColor   = styles.getPropertyValue('--text').trim()   || '#1a1917';
    const tickColor   = styles.getPropertyValue('--text-3').trim() || 'rgba(120,120,120,0.85)';
    const gridColor   = styles.getPropertyValue('--border').trim() || 'rgba(0,0,0,0.06)';

    const start = series.start;
    const dayOf = (d) => Math.round((d - start) / 86400000);
    const horizonDays = Math.round((series.end - start) / 86400000);

    const fmtDayOffset = (offset) => {
      const d = new Date(start);
      d.setDate(d.getDate() + offset);
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    };

    const dotColor = (kind) => {
      if (kind === 'income') return '#10b981';
      if (kind === 'fixed') return '#ef4444';
      if (kind === 'outsource') return '#f59e0b';
      if (kind === 'extra') return '#8b5cf6';
      if (kind === 'vat') return '#92400e';
      return textColor; // start/end uses current text colour
    };

    // 把每日的「事件總額」+「事件清單」聚合，給 spike 圖用。
    // 每個有事件的日子，畫成一個 spike：(day-0.4, 0) → (day, total) → (day+0.4, 0)
    // 兩側 0 點，讓無事件的天保持平 0，視覺上像「脈衝」。
    const buildSpikeData = (filterFn) => {
      const byDay = new Map();
      for (const e of series.events.filter(filterFn)) {
        const dx = dayOf(e.date);
        const abs = Math.abs(e.amount);
        if (!byDay.has(dx)) byDay.set(dx, { total: 0, events: [], date: e.date });
        const entry = byDay.get(dx);
        entry.total += abs;
        entry.events.push(e);
      }
      const sorted = [...byDay.entries()].sort(([a], [b]) => a - b);
      const out = [{ x: 0, y: 0 }];
      for (const [dx, info] of sorted) {
        out.push({ x: dx - 0.4, y: 0 });
        out.push({ x: dx, y: info.total, meta: { date: info.date, total: info.total, events: info.events, isSpike: true } });
        out.push({ x: dx + 0.4, y: 0 });
      }
      out.push({ x: horizonDays, y: 0 });
      return out;
    };

    const datasets = [];

    if (viewMode === 'overview') {
      // 總覽 = 原本的黃色餘額折線 + 黃 fill。乾淨、易讀。
      const balanceData = series.points.map(p => ({ x: dayOf(p.date), y: Math.max(0, p.balance), meta: p }));
      datasets.push({
        label: '銀行餘額',
        data: balanceData,
        borderColor: '#eab308',
        backgroundColor: 'rgba(251, 191, 36, 0.35)',
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 7,
        pointHitRadius: 14,
        pointBackgroundColor: balanceData.map(d => dotColor(d.meta.kind)),
        pointBorderColor: '#ffffff',
        pointBorderWidth: 1.5,
        fill: 'origin',
        tension: 0.15,
      });
    } else if (viewMode === 'income') {
      // 收入 = 每天的收入事件總額（無事件那天 = 0），綠 spike + 綠 fill
      const incomeSpike = buildSpikeData(e => e.amount > 0);
      datasets.push({
        label: '每日收入',
        data: incomeSpike,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.30)',
        borderWidth: 2,
        pointRadius: incomeSpike.map(p => (p.meta?.isSpike ? 4 : 0)),
        pointHoverRadius: incomeSpike.map(p => (p.meta?.isSpike ? 7 : 0)),
        pointHitRadius: incomeSpike.map(p => (p.meta?.isSpike ? 12 : 0)),
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 1.5,
        fill: 'origin',
        tension: 0,
      });
    } else if (viewMode === 'expense') {
      // 支出 = 每天的支出事件總額。每個 spike 整條線 + fill 用「該日主要支出類別」上色，
      // 一眼分得出固定支出 / 外包 / 額外 / 營業稅。
      const expenseSpike = buildSpikeData(e => e.amount < 0);
      // 同日多種支出時，用「金額最大者」決定 spike 顏色
      const dominantKind = (events) => {
        if (!events?.length) return null;
        let best = events[0];
        for (const e of events) {
          if (Math.abs(e.amount) > Math.abs(best.amount)) best = e;
        }
        return best.kind;
      };
      const kindFillColor = (kind) => {
        if (kind === 'fixed')     return 'rgba(239, 68, 68, 0.30)';  // 紅
        if (kind === 'outsource') return 'rgba(245, 158, 11, 0.30)'; // 橙
        if (kind === 'extra')     return 'rgba(139, 92, 246, 0.30)'; // 紫
        if (kind === 'vat')       return 'rgba(146, 64, 14, 0.30)';  // 棕
        return 'rgba(239, 68, 68, 0.26)';
      };
      datasets.push({
        label: '每日支出',
        data: expenseSpike,
        borderColor: '#ef4444',                       // 預設（會被 segment 覆寫）
        backgroundColor: 'rgba(239, 68, 68, 0.26)',   // 預設（會被 segment 覆寫）
        borderWidth: 2,
        pointRadius: expenseSpike.map(p => (p.meta?.isSpike ? 4 : 0)),
        pointHoverRadius: expenseSpike.map(p => (p.meta?.isSpike ? 7 : 0)),
        pointHitRadius: expenseSpike.map(p => (p.meta?.isSpike ? 12 : 0)),
        pointBackgroundColor: expenseSpike.map(p => {
          if (!p.meta?.isSpike) return 'transparent';
          return dotColor(dominantKind(p.meta.events));
        }),
        pointBorderColor: '#ffffff',
        pointBorderWidth: 1.5,
        fill: 'origin',
        tension: 0,
        segment: {
          // 每段線顏色：spike 兩翼用該日主要類別色；spike 之間的水平 0 線隱藏
          borderColor: (ctx) => {
            const data = ctx.chart.data.datasets[ctx.datasetIndex].data;
            const p0 = data[ctx.p0DataIndex];
            const p1 = data[ctx.p1DataIndex];
            if (p0.y === 0 && p1.y === 0) return 'rgba(0,0,0,0)';
            const peak = p0.meta?.isSpike ? p0 : p1.meta?.isSpike ? p1 : null;
            if (!peak) return '#ef4444';
            return dotColor(dominantKind(peak.meta.events));
          },
          // 每段 fill 顏色：spike 內部填該類別淡色
          backgroundColor: (ctx) => {
            const data = ctx.chart.data.datasets[ctx.datasetIndex].data;
            const p0 = data[ctx.p0DataIndex];
            const p1 = data[ctx.p1DataIndex];
            if (p0.y === 0 && p1.y === 0) return 'rgba(0,0,0,0)';
            const peak = p0.meta?.isSpike ? p0 : p1.meta?.isSpike ? p1 : null;
            if (!peak) return 'rgba(239, 68, 68, 0.26)';
            return kindFillColor(dominantKind(peak.meta.events));
          },
        },
      });
    }

    // 「今天」垂直紅虛線 plugin
    const todayOffset = Math.round((TODAY - start) / 86400000);
    const todayLinePlugin = {
      id: 'todayLine',
      afterDraw: (chart) => {
        if (todayOffset < 0 || todayOffset > horizonDays) return;
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;
        if (!xScale || !yScale) return;
        const xPos = xScale.getPixelForValue(todayOffset);
        const c = chart.ctx;
        c.save();
        c.beginPath();
        c.strokeStyle = '#ef4444';
        c.lineWidth = 1.5;
        c.setLineDash([5, 4]);
        c.moveTo(xPos, yScale.top);
        c.lineTo(xPos, yScale.bottom);
        c.stroke();
        c.restore();
        // 「今天」標籤
        c.save();
        c.fillStyle = '#ef4444';
        c.font = '11px Inter, "Noto Sans TC", sans-serif';
        c.textBaseline = 'top';
        c.fillText('今天', xPos + 5, yScale.top + 4);
        c.restore();
      },
    };

    if (chartRef.current) chartRef.current.destroy();

    chartRef.current = new window.Chart(ctx, {
      type: 'line',
      data: { datasets },
      plugins: [todayLinePlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            filter: (item) => item.raw && item.raw.meta != null,
            callbacks: {
              title: (items) => items[0] ? fmtDayOffset(Math.round(items[0].parsed.x)) : '',
              label: (item) => {
                const meta = item.raw.meta;
                const lines = [];
                if (meta.isSpike) {
                  // spike view (income/expense)：列出該日所有事件
                  const isIncome = item.dataset.label === '每日收入';
                  lines.push(`${isIncome ? '收入' : '支出'}合計 ${fmtNT(meta.total)}`);
                  for (const ev of meta.events) {
                    lines.push(`  · ${ev.label} ${fmtNT(Math.abs(ev.amount))}`);
                  }
                } else {
                  // overview view：顯示餘額點
                  lines.push(meta.label || '');
                  if (meta.kind !== 'start' && meta.kind !== 'end') {
                    const sign = meta.amount >= 0 ? '+' : '−';
                    lines.push(`${sign}${fmtNT(Math.abs(meta.amount))}`);
                  }
                  const balStr = meta.balance < 0
                    ? `${fmtNT(meta.balance)} ⚠ 見底`
                    : fmtNT(meta.balance);
                  lines.push(`餘額 ${balStr}`);
                }
                return lines;
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
              color: tickColor,
            },
            grid: { color: gridColor },
          },
          y: {
            min: 0,
            beginAtZero: true,
            ticks: {
              callback: (v) => fmtNT(v),
              font: { size: 11 },
              color: tickColor,
            },
            grid: { color: gridColor },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    };
  }, [series, themeVersion, viewMode]);

  return <canvas ref={canvasRef} />;
}

// Small color-key shown above the chart so user knows what dot colors mean
function CashflowLegend() {
  return (
    <div className="cashflow-legend">
      <span className="cf-legend-item"><span className="cf-dot" style={{ background: '#10b981' }}></span>收入</span>
      <span className="cf-legend-item"><span className="cf-dot" style={{ background: '#ef4444' }}></span>每月固定支出</span>
      <span className="cf-legend-item"><span className="cf-dot" style={{ background: '#f59e0b' }}></span>外包付款</span>
      <span className="cf-legend-item"><span className="cf-dot" style={{ background: '#8b5cf6' }}></span>額外支出（已確認）</span>
      <span className="cf-legend-item"><span className="cf-dot" style={{ background: '#92400e' }}></span>應繳營業稅</span>
    </div>
  );
}

function CashflowPanel({ series, hasSettings, onOpenSettings, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [viewMode, setViewMode] = useState('overview');  // overview / income / expense

  const tabSub = viewMode === 'income' ? '累積收入'
              : viewMode === 'expense' ? '累積支出'
              : '餘額 + 收入 + 支出';

  return (
    <div className={`cashflow-panel ${open ? 'open' : 'closed'}`}>
      <div className="cashflow-head">
        <button className="cashflow-toggle" onClick={() => setOpen(o => !o)} title={open ? '收起' : '展開'}>
          <span className="cashflow-chevron">{open ? '▾' : '▸'}</span>
          <span className="cashflow-title">現金流量表</span>
          <span className="cashflow-sub">未來 12 個月 · {tabSub}</span>
        </button>
        <div className="cashflow-actions">
          {hasSettings && series && (
            <>
              <span className="cashflow-stat">
                起始 <strong>{fmtNT(series.startBalance)}</strong>
              </span>
              <span className="cashflow-stat">
                最低點 <strong className={series.goesNegative ? 'neg' : ''}>{fmtNT(Math.max(0, series.minBalance))}</strong>
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
            <>
              <div className="cashflow-tabs">
                <button className={viewMode === 'overview' ? 'on' : ''} onClick={() => setViewMode('overview')}>總覽</button>
                <button className={viewMode === 'income' ? 'on' : ''} onClick={() => setViewMode('income')}>收入</button>
                <button className={viewMode === 'expense' ? 'on' : ''} onClick={() => setViewMode('expense')}>支出</button>
              </div>
              {(viewMode === 'overview' || viewMode === 'expense') && <CashflowLegend />}
              <div className="cashflow-canvas-wrap">
                <CashflowChart series={series} viewMode={viewMode} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Sidebar nav ----------
function Sidebar({ currentPage, onChange, counts }) {
  const items = [
    { id: 'projects', label: '專案',   count: counts.projects },
    { id: 'finance',  label: '財務',   count: null },
    { id: 'calendar', label: '行事曆', count: null },
  ];
  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {items.map(item => (
          <button
            key={item.id}
            className={`sidebar-item ${currentPage === item.id ? 'on' : ''}`}
            onClick={() => onChange(item.id)}
          >
            <span className="sidebar-label">{item.label}</span>
            {item.count != null && <span className="sidebar-count">{item.count}</span>}
          </button>
        ))}
      </nav>
    </aside>
  );
}

// ---------- VAT (營業稅) overview ----------
// 顯示 horizon 內每雙月期的銷項稅、進項稅、留底結轉、應繳。
// 跨案合併（國稅局視角），跟單案財務面板的 netVAT 不一樣。
function VatOverviewSection({ vatPeriods }) {
  const [open, setOpen] = useState(true);
  if (!vatPeriods || vatPeriods.length === 0) {
    return (
      <section className="vat-overview-section">
        <div className="page-section-header">
          <h3 className="page-section-title">營業稅總覽</h3>
        </div>
        <div className="empty-state small">
          目前還沒有任何收款 / 公司外包資料，無法計算稅額。在專案內填好收款排程與外包後會自動出現。
        </div>
      </section>
    );
  }
  const totalSales = vatPeriods.reduce((a, p) => a + p.salesVAT, 0);
  const totalInput = vatPeriods.reduce((a, p) => a + p.inputVAT, 0);
  const totalNet   = vatPeriods.reduce((a, p) => a + p.netVAT, 0);
  const lastCarry  = vatPeriods.length > 0 ? vatPeriods[vatPeriods.length - 1].carryOut : 0;
  return (
    <section className="vat-overview-section">
      <div className="page-section-header collapsible">
        <button className="section-collapse-btn" onClick={() => setOpen(o => !o)} title={open ? '收起' : '展開'}>
          <span className="chevron">{open ? '▾' : '▸'}</span>
          <h3 className="page-section-title">營業稅總覽</h3>
        </button>
        <div className="section-stats">
          <span className="cashflow-stat">銷項合計 <strong>{fmtNT(totalSales)}</strong></span>
          <span className="cashflow-stat">進項合計 <strong>− {fmtNT(totalInput)}</strong></span>
          <span className="cashflow-stat warn">應繳合計 <strong>{fmtNT(totalNet)}</strong></span>
        </div>
      </div>
      {open && (
        <>
          <div className="section-hint">
            台灣營業稅雙月一期。本期應繳 = 銷項稅 − 進項稅 − 上期留底。抵不完的進項自動結轉到下一期。
          </div>
          <div className="vat-table-wrap">
            <table className="vat-table">
              <thead>
                <tr>
                  <th>期別</th>
                  <th className="num">銷項稅</th>
                  <th className="num">進項稅</th>
                  <th className="num">上期留底</th>
                  <th className="num">本期應繳</th>
                  <th className="num">本期留底</th>
                  <th>繳稅日</th>
                </tr>
              </thead>
              <tbody>
                {vatPeriods.map(p => (
                  <tr key={p.key}>
                    <td className="vat-period-label">{p.periodLabel}</td>
                    <td className="num">{p.salesVAT > 0 ? fmtNT(p.salesVAT) : '—'}</td>
                    <td className="num">{p.inputVAT > 0 ? `− ${fmtNT(p.inputVAT)}` : '—'}</td>
                    <td className="num">{p.carryIn > 0 ? `− ${fmtNT(p.carryIn)}` : '—'}</td>
                    <td className={`num emphasis ${p.netVAT > 0 ? 'warn' : ''}`}>
                      {p.netVAT > 0 ? fmtNT(p.netVAT) : '—'}
                    </td>
                    <td className="num">{p.carryOut > 0 ? fmtNT(p.carryOut) : '—'}</td>
                    <td className="vat-date">{fmtDate(p.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {lastCarry > 0 && (
            <div className="section-hint">
              最末期之後仍有 <strong>{fmtNT(lastCarry)}</strong> 進項留底未抵完，會結轉到 12 個月之後的下一期繼續扣抵。
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ---------- Extra expense list (planned outflow simulator) ----------
function ExtraExpenseList({ series, expenses, customCategories, onChange, onUpdateCustomCategories }) {
  const list = expenses || [];
  const customs = customCategories || [];
  const allCategories = [...DEFAULT_EXPENSE_CATEGORIES, ...customs];
  const [open, setOpen] = useState(true);
  const [paidOpen, setPaidOpen] = useState(false);  // 已付款區預設摺疊

  const addEntry = () => {
    const item = {
      id: uid('ex'),
      name: '',
      amount: 0,
      type: '設備',
      plannedDate: toISODate(TODAY),
      confirmed: false,
    };
    onChange([...list, item]);
  };
  const updateEntry = (id, patch) => {
    onChange(list.map(e => e.id === id ? { ...e, ...patch } : e));
  };
  const deleteEntry = (id) => {
    onChange(list.filter(e => e.id !== id));
  };
  const toggleConfirm = (id) => {
    onChange(list.map(e => e.id === id ? { ...e, confirmed: !e.confirmed } : e));
  };

  const addCustomCategory = () => {
    const raw = window.prompt('新增類別名稱（之後在所有下拉選單都會出現）：');
    if (raw == null) return;
    const name = raw.trim();
    if (!name) return;
    if (allCategories.includes(name)) {
      alert(`類別「${name}」已經存在。`);
      return;
    }
    onUpdateCustomCategories([...customs, name]);
  };

  const confirmedTotal = list.filter(e => e.confirmed).reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const draftTotal     = list.filter(e => !e.confirmed).reduce((a, e) => a + (Number(e.amount) || 0), 0);

  // Runway banner: when does balance hit 0?
  let runwayBanner;
  if (!series) {
    runwayBanner = (
      <div className="runway-banner empty">
        <span className="runway-icon">💵</span>
        還沒設定銀行餘額，先到右上角 💵 填入起算日資金，才能算出歸零時間。
      </div>
    );
  } else if (series.goesNegative && series.negativeAt) {
    runwayBanner = (
      <div className="runway-banner warn">
        <span className="runway-icon">⚠</span>
        <span>金錢歸零時間：<strong>{fmtChineseDate(series.negativeAt.date)}</strong></span>
        <span className="runway-sub">（包含已確認的試算項目）</span>
      </div>
    );
  } else {
    runwayBanner = (
      <div className="runway-banner safe">
        <span className="runway-icon">✓</span>
        <span>目前 12 個月內<strong>不會見底</strong>，最低點仍有 <strong>{fmtNT(Math.max(0, series.minBalance))}</strong></span>
      </div>
    );
  }

  return (
    <section className="extra-expense-section">
      {/* Title row: collapsible header + totals (announcement-style) */}
      <div className="page-section-header collapsible">
        <button className="section-collapse-btn" onClick={() => setOpen(o => !o)} title={open ? '收起' : '展開'}>
          <span className="chevron">{open ? '▾' : '▸'}</span>
          <h3 className="page-section-title">額外支出試算</h3>
        </button>
        {list.length > 0 && (
          <div className="section-stats">
            <span className="cashflow-stat">已確認 <strong>{fmtNT(confirmedTotal)}</strong></span>
            <span className="cashflow-stat draft">試算中 <strong>{fmtNT(draftTotal)}</strong></span>
          </div>
        )}
      </div>

      {open && <>
      {/* Runway banner: the "announcement" */}
      {runwayBanner}

      {/* Action buttons + hint live RIGHT ABOVE the list, so they're easy to find after adding rows */}
      <div className="extra-actions-row">
        <div className="section-hint">
          輸入金額和日期 → 按「確認付款」加入現金流圖 → 再按一次取消（試算狀態）。歸零時間會即時跟著更新。
        </div>
        <div className="extra-actions-buttons">
          <button className="btn btn-ghost small" onClick={addCustomCategory}>+ 自訂類別</button>
          <button className="btn btn-primary small" onClick={addEntry}>+ 新增一筆</button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty-state">
          還沒有試算項目。例如想買 10 萬的相機，就在這裡加一筆，立刻看現金流的衝擊。
        </div>
      ) : (() => {
        const drafts = list.filter(e => !e.confirmed);
        const paids  = list.filter(e => e.confirmed);
        const renderRow = (ex) => {
          const currentType = normalizeExpenseType(ex.type);
          const showOrphanOption = currentType && !allCategories.includes(currentType);
          return (
            <div key={ex.id} className={`extra-row ${ex.confirmed ? 'confirmed' : 'draft'}`}>
              <input className="input" placeholder="例：Canon R5 相機"
                value={ex.name}
                onChange={e => updateEntry(ex.id, { name: e.target.value })} />
              <select className="input select"
                value={currentType}
                onChange={e => updateEntry(ex.id, { type: e.target.value })}>
                {showOrphanOption && <option value={currentType}>{currentType}</option>}
                {DEFAULT_EXPENSE_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
                {customs.length > 0 && customs.map(c => (
                  <option key={c} value={c}>{c}（自訂）</option>
                ))}
              </select>
              <MoneyInput
                value={ex.amount}
                onChange={v => updateEntry(ex.id, { amount: v })} />
              <input type="date" className="date-input compact"
                value={ex.plannedDate || ''}
                onChange={e => updateEntry(ex.id, { plannedDate: e.target.value })} />
              <div className="center">
                <button
                  className={`confirm-btn ${ex.confirmed ? 'on' : ''}`}
                  onClick={() => toggleConfirm(ex.id)}
                  title={ex.confirmed ? '已加入現金流（按一下取消）' : '加入現金流'}>
                  {ex.confirmed ? '✓ 已確認' : '確認付款'}
                </button>
              </div>
              <button className="delete-item visible" onClick={() => deleteEntry(ex.id)} title="刪除">×</button>
            </div>
          );
        };
        const headRow = (
          <div className="extra-row head">
            <div>項目名稱</div>
            <div>類型</div>
            <div className="num">金額</div>
            <div>預計付款日</div>
            <div className="center">狀態</div>
            <div></div>
          </div>
        );
        return (
          <>
            {/* 試算中（未確認）— 永遠展開 */}
            <div className="extra-subheader">
              <span className="extra-sub-title">試算中</span>
              <span className="extra-sub-count">{drafts.length} 筆 · {fmtNT(draftTotal)}</span>
            </div>
            {drafts.length > 0 ? (
              <div className="extra-list">
                {headRow}
                {drafts.map(renderRow)}
              </div>
            ) : (
              <div className="empty-state small">沒有試算中的項目。按右上「+ 新增一筆」開始試算。</div>
            )}

            {/* 已付款（已確認）— 預設摺疊 */}
            {paids.length > 0 && (
              <>
                <button className="extra-subheader collapsible" onClick={() => setPaidOpen(o => !o)}>
                  <span className="chevron">{paidOpen ? '▾' : '▸'}</span>
                  <span className="extra-sub-title">已付款</span>
                  <span className="extra-sub-count">{paids.length} 筆 · {fmtNT(confirmedTotal)}</span>
                </button>
                {paidOpen && (
                  <div className="extra-list">
                    {headRow}
                    {paids.map(renderRow)}
                  </div>
                )}
              </>
            )}
          </>
        );
      })()}
      </>}
    </section>
  );
}

// ---------- Calendar page (cross-project timeline) ----------
const CAL_KIND_META = {
  'delivery':    { color: '#dc2626', emoji: '🚚', name: '交件' },
  'stage-start': { color: '#3b82f6', emoji: '▶',  name: '階段開始' },
  'stage-end':   { color: '#10b981', emoji: '✓',  name: '階段結束' },
  'item-start':  { color: '#a78bfa', emoji: '○',  name: '細項開始' },
  'item-due':    { color: '#8b5cf6', emoji: '●',  name: '細項結束 / 交付' },
  'item-span':   { color: '#8b5cf6', emoji: '▭',  name: '細項區間' },
  'payment-in':  { color: '#16a34a', emoji: '💰', name: '收款' },
  'payment-out': { color: '#f59e0b', emoji: '💸', name: '外包付款' },
};

function CalendarPage({ projects, onMoveEvent, onResizeStage }) {
  const [view, setView] = useState('month'); // 'month' | 'list' | 'gantt'
  const [fullscreen, setFullscreen] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const d = new Date(TODAY);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const allEvents = useMemo(() => buildCalendarEvents(projects), [projects]);

  const eventsByDate = useMemo(() => {
    const map = {};
    for (const e of allEvents) {
      (map[e.date] = map[e.date] || []).push(e);
    }
    return map;
  }, [allEvents]);

  const goPrevMonth = () => setCursor(c => {
    const m = c.month - 1;
    return m < 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: m };
  });
  const goNextMonth = () => setCursor(c => {
    const m = c.month + 1;
    return m > 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: m };
  });
  const goToday = () => {
    const d = new Date(TODAY);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  };

  // Escape key exits fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const showFullscreenBtn = view === 'gantt';

  const content = (
    <>
      <div className="calendar-toolbar">
        <div className="calendar-title">
          {view === 'month' && (
            <>
              <button className="cal-nav-btn" onClick={goPrevMonth} title="上個月">‹</button>
              <h2 className="cal-month-label">{cursor.year} 年 {cursor.month + 1} 月</h2>
              <button className="cal-nav-btn" onClick={goNextMonth} title="下個月">›</button>
              <button className="btn btn-ghost small" onClick={goToday} title="跳到本月">今天</button>
            </>
          )}
          {view !== 'month' && (
            <h2 className="cal-month-label">{view === 'list' ? '未來事件' : '甘特圖'}</h2>
          )}
        </div>
        <div className="calendar-toolbar-right">
          {showFullscreenBtn && (
            <button className="btn btn-ghost small" onClick={() => setFullscreen(f => !f)}
              title={fullscreen ? '退出全螢幕 (Esc)' : '全螢幕'}>
              {fullscreen ? '⤓ 退出全螢幕' : '⤢ 全螢幕'}
            </button>
          )}
          <div className="view-toggle">
            <button className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>月</button>
            <button className={view === 'list'  ? 'on' : ''} onClick={() => setView('list')}>列表</button>
            <button className={view === 'gantt' ? 'on' : ''} onClick={() => setView('gantt')}>甘特</button>
          </div>
        </div>
      </div>

      <div className="calendar-legend">
        {Object.entries(CAL_KIND_META).map(([k, m]) => (
          <span key={k} className="cf-legend-item"><span className="cf-dot" style={{ background: m.color }}></span>{m.name}</span>
        ))}
        {view === 'month' && <span className="cal-hint">💡 提示：可以把事件拖到別的日期</span>}
        {view === 'gantt' && <span className="cal-hint">💡 提示：拖動條移動、拖邊緣調長度</span>}
      </div>

      {view === 'month' && <CalendarMonthView cursor={cursor} allEvents={allEvents} onMoveEvent={onMoveEvent} />}
      {view === 'list'  && <CalendarListView allEvents={allEvents} />}
      {view === 'gantt' && <CalendarGanttView projects={projects} onResizeStage={onResizeStage} />}
    </>
  );

  if (fullscreen) {
    return <div className="calendar-fullscreen">{content}</div>;
  }
  return content;
}

// Helper: lane-assignment for spans in a week (so overlapping spans don't draw on top of each other)
function assignLanes(segments) {
  const sorted = [...segments].sort((a, b) => a.startCol - b.startCol);
  const lanes = []; // each lane = list of segments placed in it
  for (const seg of sorted) {
    let placed = false;
    for (const lane of lanes) {
      const last = lane[lane.length - 1];
      if (last.endCol < seg.startCol) {
        lane.push(seg);
        placed = true;
        break;
      }
    }
    if (!placed) lanes.push([seg]);
  }
  return lanes;
}

function CalendarMonthView({ cursor, allEvents, onMoveEvent }) {
  const [dragOverDate, setDragOverDate] = useState(null);
  const { year, month } = cursor;
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const todayISO = toISODate(TODAY);

  // Build a 6×7 grid of cells, then group into 6 weeks
  const cells = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, daysInPrevMonth - i);
    cells.push({ date: toISODate(d), day: d.getDate(), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: toISODate(new Date(year, month, d)), day: d, inMonth: true });
  }
  let next = 1;
  while (cells.length < 42) {
    const d = new Date(year, month + 1, next++);
    cells.push({ date: toISODate(d), day: d.getDate(), inMonth: false });
  }
  const weeks = [];
  for (let w = 0; w < 6; w++) weeks.push(cells.slice(w * 7, (w + 1) * 7));

  // Categorize events: spans (multi-day) vs points (single-day)
  const spans = [];
  const pointsByDate = {};
  for (const e of allEvents) {
    const isSpan = e.startDate && e.endDate && e.startDate !== e.endDate;
    if (isSpan) spans.push(e);
    else (pointsByDate[e.date] = pointsByDate[e.date] || []).push(e);
  }

  return (
    <div className="cal-month">
      <div className="cal-weekdays">
        {['日','一','二','三','四','五','六'].map(w => <div key={w}>{w}</div>)}
      </div>
      {weeks.map((weekCells, wIdx) => {
        const weekStart = weekCells[0].date;
        const weekEnd = weekCells[6].date;

        // For each span event that overlaps this week, compute its column range
        const segments = [];
        for (const e of spans) {
          if (e.endDate < weekStart || e.startDate > weekEnd) continue; // no overlap
          const startInWeek = e.startDate < weekStart ? weekStart : e.startDate;
          const endInWeek   = e.endDate   > weekEnd   ? weekEnd   : e.endDate;
          const startCol = weekCells.findIndex(c => c.date === startInWeek);
          const endCol   = weekCells.findIndex(c => c.date === endInWeek);
          if (startCol < 0 || endCol < 0) continue;
          segments.push({
            event: e,
            startCol,
            endCol,
            continuesLeft:  e.startDate < weekStart,
            continuesRight: e.endDate   > weekEnd,
          });
        }
        const lanes = assignLanes(segments);

        return (
          <div key={wIdx} className="cal-week">
            {/* Day-number row + cell base layer (drop targets) */}
            <div className="cal-week-cells">
              {weekCells.map((cell, i) => {
                const isToday = cell.date === todayISO;
                const isDragOver = dragOverDate === cell.date;
                return (
                  <div
                    key={i}
                    className={`cal-cell ${cell.inMonth ? 'in-month' : 'out-month'} ${isToday ? 'today' : ''} ${isDragOver ? 'drag-over' : ''}`}
                    onDragOver={(e) => { if (onMoveEvent) { e.preventDefault(); setDragOverDate(cell.date); } }}
                    onDragLeave={() => { if (dragOverDate === cell.date) setDragOverDate(null); }}
                    onDrop={(e) => {
                      if (!onMoveEvent) return;
                      e.preventDefault();
                      setDragOverDate(null);
                      try {
                        const data = JSON.parse(e.dataTransfer.getData('application/json') || '{}');
                        const targetDate = cell.date;
                        if (!data) return;
                        // For spans the comparison is against startDate
                        const oldDate = data.startDate || data.date;
                        if (oldDate !== targetDate) onMoveEvent(data, targetDate);
                      } catch {}
                    }}
                  >
                    <div className="cal-cell-day">{cell.day}</div>
                    <div className="cal-cell-points">
                      {(pointsByDate[cell.date] || []).slice(0, 3).map((e, idx) => {
                        const meta = CAL_KIND_META[e.kind] || {};
                        return (
                          <div
                            key={idx}
                            className="cal-event-chip"
                            style={{ borderLeftColor: meta.color }}
                            title={`${e.projectTitle} · ${e.label}${e.amount ? ` (${fmtNT(e.amount)})` : ''}（拖到別的日期可改）`}
                            draggable={!!onMoveEvent}
                            onDragStart={(ev) => {
                              if (!onMoveEvent) return;
                              ev.dataTransfer.effectAllowed = 'move';
                              ev.dataTransfer.setData('application/json', JSON.stringify(e));
                            }}
                          >
                            <span className="cal-event-emoji">{meta.emoji}</span>
                            <span className="cal-event-label">{e.projectTitle} · {e.label}</span>
                          </div>
                        );
                      })}
                      {(pointsByDate[cell.date] || []).length > 3 && (
                        <div className="cal-event-more">+{(pointsByDate[cell.date].length - 3)} 項</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Span bars: rendered as separate lane rows overlaying the week's cells */}
            {lanes.length > 0 && (
              <div className="cal-week-spans">
                {lanes.map((laneSegs, laneIdx) => (
                  <div key={laneIdx} className="cal-span-lane">
                    {laneSegs.map((seg, segIdx) => {
                      const meta = CAL_KIND_META[seg.event.kind] || {};
                      return (
                        <div
                          key={segIdx}
                          className={`cal-span-bar ${seg.continuesLeft ? 'continues-left' : ''} ${seg.continuesRight ? 'continues-right' : ''}`}
                          style={{
                            gridColumn: `${seg.startCol + 1} / ${seg.endCol + 2}`,
                            background: meta.color,
                          }}
                          title={`${seg.event.projectTitle} · ${seg.event.label}（${seg.event.startDate} → ${seg.event.endDate}）`}
                          draggable={!!onMoveEvent}
                          onDragStart={(ev) => {
                            if (!onMoveEvent) return;
                            ev.dataTransfer.effectAllowed = 'move';
                            ev.dataTransfer.setData('application/json', JSON.stringify(seg.event));
                          }}
                        >
                          <span className="cal-span-label">
                            {!seg.continuesLeft && <>{seg.event.projectTitle} · </>}
                            {seg.event.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CalendarListView({ allEvents }) {
  const todayISO = toISODate(TODAY);
  // Only show events from today onwards (past events are less relevant for planning)
  const futureEvents = allEvents.filter(e => e.date >= todayISO);

  // Group by date
  const groups = {};
  for (const e of futureEvents) {
    (groups[e.date] = groups[e.date] || []).push(e);
  }
  const dateKeys = Object.keys(groups).sort();

  if (dateKeys.length === 0) {
    return <div className="empty-state">沒有未來的事件。到各專案的階段或財務設定日期就會出現在這裡。</div>;
  }

  return (
    <div className="cal-list">
      {dateKeys.map(date => {
        const d = new Date(date);
        const weekday = ['週日','週一','週二','週三','週四','週五','週六'][d.getDay()];
        const isToday = date === todayISO;
        const daysFromToday = daysBetween(TODAY, d);
        return (
          <div key={date} className={`cal-list-day ${isToday ? 'today' : ''}`}>
            <div className="cal-list-date">
              <div className="cal-list-date-main">{d.getMonth() + 1} 月 {d.getDate()} 日</div>
              <div className="cal-list-date-sub">{weekday} · {isToday ? '今天' : daysFromToday === 1 ? '明天' : `${daysFromToday} 天後`}</div>
            </div>
            <div className="cal-list-events">
              {groups[date].map((e, i) => {
                const meta = CAL_KIND_META[e.kind] || {};
                return (
                  <div key={i} className="cal-list-event" style={{ borderLeftColor: meta.color }}>
                    <span className="cal-event-emoji">{meta.emoji}</span>
                    <div className="cal-list-event-body">
                      <div className="cal-list-event-title">
                        <strong>{e.projectTitle}</strong> · {e.label}
                        {e.stageLabel && (e.kind === 'item-due' || e.kind === 'item-start') && <span className="cal-list-event-stage"> ({e.stageLabel})</span>}
                      </div>
                      {e.amount != null && <div className="cal-list-event-amount">{fmtNT(e.amount)}</div>}
                      {e.detail && <div className="cal-list-event-detail">{e.detail}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Gantt view ----------
// Each project = one row. Each stage with start+end = a draggable bar on that row.
// Drag the bar to shift both start AND end by the same number of days.
// Drag the left/right edge handle to change only one side.
const GANTT_PX_PER_DAY = 30;
const GANTT_ROW_HEIGHT = 56;
const GANTT_LABEL_WIDTH = 180;
const GANTT_STAGE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function CalendarGanttView({ projects, onResizeStage }) {
  // Determine the time range we draw — earliest stage/project date to latest, plus buffer
  const range = useMemo(() => {
    const dates = [];
    for (const p of projects) {
      if (p.start) dates.push(new Date(p.start));
      if (p.due)   dates.push(new Date(p.due));
      for (const s of (p.stages || [])) {
        if (s.start) dates.push(new Date(s.start));
        if (s.end)   dates.push(new Date(s.end));
      }
    }
    // Always include TODAY so the "today line" is visible
    dates.push(new Date(TODAY));
    if (dates.length === 0) return null;
    const min = new Date(Math.min(...dates.map(d => d.getTime())));
    const max = new Date(Math.max(...dates.map(d => d.getTime())));
    // Add 14 days of buffer on each side
    min.setDate(min.getDate() - 14);
    max.setDate(max.getDate() + 14);
    const totalDays = daysBetween(min, max) + 1;
    return { start: min, end: max, totalDays };
  }, [projects]);

  if (!range || projects.length === 0) {
    return <div className="empty-state">沒有可顯示的專案。先建一個專案、給階段設定起／迄日期，就會在這裡看到甘特圖。</div>;
  }

  const scrollRef = useRef(null);
  const dayOffset = (iso) => daysBetween(range.start, new Date(iso));
  const totalWidth = range.totalDays * GANTT_PX_PER_DAY;
  const todayOffset = dayOffset(toISODate(TODAY)) * GANTT_PX_PER_DAY;

  // Auto-scroll to today (centered) on mount and whenever the date range shifts.
  useEffect(() => {
    if (!scrollRef.current) return;
    const containerWidth = scrollRef.current.clientWidth;
    const target = Math.max(0, GANTT_LABEL_WIDTH + todayOffset - containerWidth / 2);
    scrollRef.current.scrollLeft = target;
  }, [todayOffset]);

  // Month tick marks (top row of header)
  const monthTicks = [];
  let mc = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
  while (mc <= range.end) {
    const offset = daysBetween(range.start, mc) * GANTT_PX_PER_DAY;
    monthTicks.push({
      offset,
      label: `${mc.getFullYear()}.${String(mc.getMonth() + 1).padStart(2, '0')}`,
    });
    mc = new Date(mc.getFullYear(), mc.getMonth() + 1, 1);
  }

  // Day tick marks (bottom row of header) — every 5 days for readability.
  // Skip day 1 because the month tick already marks it.
  const dayTicks = [];
  const dc = new Date(range.start);
  dc.setHours(0, 0, 0, 0);
  while (dc <= range.end) {
    const day = dc.getDate();
    if (day !== 1 && day % 5 === 0) {
      const offset = daysBetween(range.start, dc) * GANTT_PX_PER_DAY;
      dayTicks.push({ offset, label: String(day) });
    }
    dc.setDate(dc.getDate() + 1);
  }

  return (
    <div className="gantt-scroll" ref={scrollRef}>
      <div className="gantt" style={{ width: GANTT_LABEL_WIDTH + totalWidth }}>
        {/* Header: month ticks (top) + day numbers (bottom) */}
        <div className="gantt-header" style={{ paddingLeft: GANTT_LABEL_WIDTH }}>
          <div className="gantt-header-track" style={{ width: totalWidth }}>
            {monthTicks.map((t, i) => (
              <div key={`m${i}`} className="gantt-month-tick" style={{ left: t.offset }}>
                <span className="gantt-month-label">{t.label}</span>
              </div>
            ))}
            {dayTicks.map((t, i) => (
              <div key={`d${i}`} className="gantt-day-tick" style={{ left: t.offset }}>
                <span className="gantt-day-label">{t.label}</span>
              </div>
            ))}
            <div className="gantt-today-line" style={{ left: todayOffset }} title={`今天 ${toISODate(TODAY)}`} />
          </div>
        </div>

        {/* Project rows */}
        <div className="gantt-body">
          {projects.map((p, pIdx) => (
            <GanttRow
              key={p.id}
              project={p}
              colorBase={GANTT_STAGE_COLORS[pIdx % GANTT_STAGE_COLORS.length]}
              dayOffset={dayOffset}
              totalWidth={totalWidth}
              todayOffset={todayOffset}
              onResizeStage={onResizeStage}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function GanttRow({ project, colorBase, dayOffset, totalWidth, todayOffset, onResizeStage }) {
  const stagesWithDates = (project.stages || []).filter(s => s.start && s.end);
  const dueOffset = project.due ? dayOffset(project.due) * GANTT_PX_PER_DAY : null;

  return (
    <div className="gantt-row" style={{ height: GANTT_ROW_HEIGHT }}>
      <div className="gantt-row-label" style={{ width: GANTT_LABEL_WIDTH }}>
        <div className="gantt-row-title">{project.title}</div>
        <div className="gantt-row-client">{project.client}</div>
      </div>
      <div className="gantt-row-track" style={{ width: totalWidth }}>
        <div className="gantt-today-line gantt-today-faint" style={{ left: todayOffset }} />
        {stagesWithDates.map((stage, sIdx) => (
          <GanttStageBar
            key={stage.id}
            project={project}
            stage={stage}
            color={colorBase}
            dayOffset={dayOffset}
            onResize={(change) => onResizeStage && onResizeStage(project.id, stage.id, change)}
          />
        ))}
        {dueOffset != null && (
          <div className="gantt-deadline" style={{ left: dueOffset }} title={`${project.title} 交件：${project.due}`}>
            <div className="gantt-deadline-flag">🚚</div>
          </div>
        )}
      </div>
    </div>
  );
}

function GanttStageBar({ project, stage, color, dayOffset, onResize }) {
  const barRef = useRef(null);
  const dragStateRef = useRef(null);
  // Local-only preview of bar position while dragging, so React state doesn't fire 50× a second
  const [preview, setPreview] = useState(null);

  const startISO = preview?.start ?? stage.start;
  const endISO   = preview?.end   ?? stage.end;
  const startOff = dayOffset(startISO);
  const endOff   = dayOffset(endISO);
  const left = startOff * GANTT_PX_PER_DAY;
  const width = Math.max(GANTT_PX_PER_DAY, (endOff - startOff + 1) * GANTT_PX_PER_DAY);

  const beginDrag = (mode) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragStateRef.current = {
      mode, // 'move' | 'resize-l' | 'resize-r'
      startX: e.clientX,
      origStart: stage.start,
      origEnd: stage.end,
    };
    const onMove = (mv) => {
      const st = dragStateRef.current;
      if (!st) return;
      const deltaPx = mv.clientX - st.startX;
      const deltaDays = Math.round(deltaPx / GANTT_PX_PER_DAY);
      if (deltaDays === 0) { setPreview(null); return; }
      if (st.mode === 'move') {
        setPreview({
          start: addDays(st.origStart, deltaDays),
          end:   addDays(st.origEnd, deltaDays),
        });
      } else if (st.mode === 'resize-l') {
        const newStart = addDays(st.origStart, deltaDays);
        // Don't let start go past end
        if (newStart <= st.origEnd) setPreview({ start: newStart, end: st.origEnd });
      } else if (st.mode === 'resize-r') {
        const newEnd = addDays(st.origEnd, deltaDays);
        if (newEnd >= st.origStart) setPreview({ start: st.origStart, end: newEnd });
      }
    };
    const onUp = () => {
      const st = dragStateRef.current;
      const pv = preview;
      // Read latest preview via ref so we don't miss the final value due to stale closure
      const finalPreview = barRef.current?.dataset?.pv ? JSON.parse(barRef.current.dataset.pv) : pv;
      dragStateRef.current = null;
      setPreview(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (finalPreview && (finalPreview.start !== stage.start || finalPreview.end !== stage.end)) {
        if (st && st.mode === 'move') {
          onResize({ start: finalPreview.start, end: finalPreview.end });
        } else if (st && st.mode === 'resize-l') {
          onResize({ start: finalPreview.start });
        } else if (st && st.mode === 'resize-r') {
          onResize({ end: finalPreview.end });
        }
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Stash latest preview on the DOM so onUp sees the final value (avoiding stale closure)
  useEffect(() => {
    if (barRef.current) {
      if (preview) barRef.current.dataset.pv = JSON.stringify(preview);
      else delete barRef.current.dataset.pv;
    }
  }, [preview]);

  return (
    <div
      ref={barRef}
      className={`gantt-bar ${preview ? 'dragging' : ''}`}
      style={{ left, width, background: color }}
      onMouseDown={beginDrag('move')}
      data-start={startISO}
      data-end={endISO}
      title={`${stage.label}：${startISO} → ${endISO}（拖移整段、或拖左右邊緣調長度）`}
    >
      <div className="gantt-handle gantt-handle-l" onMouseDown={beginDrag('resize-l')} />
      <span className="gantt-bar-label">{stage.label}</span>
      <div className="gantt-handle gantt-handle-r" onMouseDown={beginDrag('resize-r')} />
      <span className="gantt-date-popup gantt-date-popup-l">{startISO}</span>
      <span className="gantt-date-popup gantt-date-popup-r">{endISO}</span>
    </div>
  );
}

// ---------- Finance page (cash flow + cross-project summary) ----------
function FinancePage({ projects, allProjects, settings, onOpenSettings, onUpdateExtraExpenses, onUpdateCustomCategories }) {
  const handleExport = () => {
    const data = buildExportData(allProjects || projects, settings || {});
    const today = toISODate(TODAY);
    downloadJSON(data, `jt745-data-${today}.json`);
  };

  const hasSettings = settings && (settings.bankBalance !== undefined && settings.bankBalance !== null && settings.bankBalance !== '');
  const series = useMemo(
    () => hasSettings ? buildCashflowSeries(projects, settings, 12) : null,
    [projects, settings, hasSettings]
  );
  const [summaryOpen, setSummaryOpen] = useState(true);

  const monthlyFixed = Number(settings?.monthlyFixedExpense) || 0;
  const allocations = useMemo(
    () => computeFixedCostAllocations(allProjects || projects, monthlyFixed),
    [allProjects, projects, monthlyFixed]
  );

  const rows = projects.map(p => {
    const c = calcCosts(p, allocations[p.id], monthlyFixed);
    return {
      id: p.id,
      title: p.title,
      client: p.client,
      budget: Number(p.budget) || 0,
      netVAT: c.netVAT,
      outsourceTotal: c.outsourceTotal,
      fixedCost: c.fixedCost,
      profit: c.profit,
      pct: p.budget ? Math.round(c.profit / p.budget * 100) : 0,
    };
  });
  const totals = rows.reduce((a, r) => ({
    budget: a.budget + r.budget,
    netVAT: a.netVAT + r.netVAT,
    outsourceTotal: a.outsourceTotal + r.outsourceTotal,
    fixedCost: a.fixedCost + r.fixedCost,
    profit: a.profit + r.profit,
  }), { budget: 0, netVAT: 0, outsourceTotal: 0, fixedCost: 0, profit: 0 });

  return (
    <>
      <div className="finance-toolbar">
        <button className="btn btn-ghost small" onClick={handleExport} title="下載一個 JSON 檔，整理好所有現況讓 Claude 看">
          📥 匯出給 Claude
        </button>
      </div>

      <CashflowPanel
        series={series}
        hasSettings={hasSettings}
        onOpenSettings={onOpenSettings}
        defaultOpen={true}
      />

      <VatOverviewSection vatPeriods={series?.vatPeriods} />

      <section className="finance-summary">
        <div className="page-section-header collapsible">
          <button className="section-collapse-btn" onClick={() => setSummaryOpen(o => !o)} title={summaryOpen ? '收起' : '展開'}>
            <span className="chevron">{summaryOpen ? '▾' : '▸'}</span>
            <h3 className="page-section-title">跨專案財務摘要</h3>
          </button>
          {!summaryOpen && rows.length > 0 && (
            <span className="cashflow-stat">合計淨利 <strong className={totals.profit < 0 ? 'neg' : ''}>{fmtNT(totals.profit)}</strong></span>
          )}
        </div>
        {summaryOpen && (
          rows.length === 0 ? (
            <div className="empty-state">目前沒有進行中專案。</div>
          ) : (
            <div className="finance-table">
              <div className="finance-row head">
                <div>專案 / 客戶</div>
                <div className="num">合約金額</div>
                <div className="num">應繳營業稅</div>
                <div className="num">外包總額</div>
                <div className="num">分攤固定成本</div>
                <div className="num">淨利</div>
              </div>
              {rows.map(r => (
                <div key={r.id} className="finance-row">
                  <div className="finance-name-cell">
                    <div className="finance-title">{r.title}</div>
                    <div className="finance-client">{r.client}</div>
                  </div>
                  <div className="num" data-label="合約金額">{fmtNT(r.budget)}</div>
                  <div className="num" data-label="應繳營業稅">{fmtNT(r.netVAT)}</div>
                  <div className="num" data-label="外包總額">{fmtNT(r.outsourceTotal)}</div>
                  <div className="num" data-label="分攤固定成本">{fmtNT(r.fixedCost)}</div>
                  <div className={`num strong ${r.profit < 0 ? 'neg' : ''}`} data-label="淨利">
                    {fmtNT(r.profit)} <span className="pct">{r.pct}%</span>
                  </div>
                </div>
              ))}
              <div className="finance-row totals">
                <div className="finance-name-cell"><strong>合計（{rows.length} 個進行中）</strong></div>
                <div className="num strong" data-label="合約金額">{fmtNT(totals.budget)}</div>
                <div className="num" data-label="應繳營業稅">{fmtNT(totals.netVAT)}</div>
                <div className="num" data-label="外包總額">{fmtNT(totals.outsourceTotal)}</div>
                <div className="num" data-label="分攤固定成本">{fmtNT(totals.fixedCost)}</div>
                <div className={`num strong ${totals.profit < 0 ? 'neg' : ''}`} data-label="淨利">{fmtNT(totals.profit)}</div>
              </div>
            </div>
          )
        )}
      </section>

      <ExtraExpenseList
        series={series}
        expenses={settings.extraExpenses || []}
        customCategories={settings.customExpenseCategories || []}
        onChange={onUpdateExtraExpenses}
        onUpdateCustomCategories={onUpdateCustomCategories}
      />
    </>
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
  const [currentPage, setCurrentPage] = useState('projects'); // 'projects' | 'finance'

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

  const onUpdateExtraExpenses = (nextList) => {
    const next = { ...(globalSettings || {}), extraExpenses: nextList };
    setGlobalSettings(next);
    saveUserSettings(next);
  };

  const onUpdateCustomCategories = (nextList) => {
    const next = { ...(globalSettings || {}), customExpenseCategories: nextList };
    setGlobalSettings(next);
    saveUserSettings(next);
  };

  const onUpdateCustomOutsourceRoles = (nextList) => {
    const next = { ...(globalSettings || {}), customOutsourceRoles: nextList };
    setGlobalSettings(next);
    saveUserSettings(next);
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
        else if (focusedProjectId) {
          // Close info/costs panel on the focused card
          const p = projects.find(p => p.id === focusedProjectId);
          if (p && (p.infoOpen || p.costsOpen)) {
            onUpdateProject(focusedProjectId, { infoOpen: false, costsOpen: false });
          }
        }
      }
      if (!inField && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); setShowNew(true); }
      if (!inField && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); setTweak('darkMode', !t.darkMode); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showNew, expanded, t.darkMode, focusedProjectId, projects]);

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

  // Mutually-exclusive info/cost panels across ALL projects.
  // Clicking any project's 💲 / ⓘ closes whatever was open on other cards.
  const onTogglePanel = (projectId, panel /* 'info' | 'costs' */) => {
    const key = panel === 'info' ? 'infoOpen' : 'costsOpen';
    setProjects(prev => {
      const target = prev.find(p => p.id === projectId);
      const willOpen = target ? !target[key] : true;
      const next = prev.map(p => {
        if (p.id === projectId) {
          const updated = { ...p, infoOpen: false, costsOpen: false };
          updated[key] = willOpen;
          if (updated.infoOpen !== p.infoOpen || updated.costsOpen !== p.costsOpen) saveProjectInDB(updated);
          return updated;
        }
        // Close any open panels on other projects (and persist that closure)
        if (p.infoOpen || p.costsOpen) {
          const updated = { ...p, infoOpen: false, costsOpen: false };
          saveProjectInDB(updated);
          return updated;
        }
        return p;
      });
      return next;
    });
    // Also close any expanded stage when switching panels
    setExpanded(null);
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

  // 依交件日排序：把進行中專案按交件日由近到遠重排，已歸檔/垃圾桶保持原順序。
  // 沒填交件日的專案排到最後（避免它們搶到第一順位）。
  const sortByDueDate = () => {
    setProjects(prev => {
      const actives = prev.filter(p => !p.archived && !p.deleted);
      const others  = prev.filter(p =>  p.archived ||  p.deleted);
      const sorted = [...actives].sort((a, b) => {
        const da = a.due ? new Date(a.due).getTime() : Infinity;
        const db = b.due ? new Date(b.due).getTime() : Infinity;
        return da - db;
      });
      const next = [...sorted, ...others];
      saveOrderInDB(next.map(p => p.id));
      return next;
    });
  };

  const activeProjects = projects.filter(p => !p.archived && !p.deleted);
  const archivedProjects = projects.filter(p => p.archived && !p.deleted);
  const deletedProjects = projects.filter(p => p.deleted);
  const visible = tab === 'active' ? activeProjects : tab === 'archived' ? archivedProjects : deletedProjects;

  // Focus mode: the ID of the currently "focused" project (one with open info/cost
  // panel, or with an expanded stage). Other cards dim so the user can concentrate.
  const focusedProjectId = useMemo(() => {
    for (const p of projects) {
      if (p.infoOpen || p.costsOpen) return p.id;
    }
    return expanded?.projectId || null;
  }, [projects, expanded]);

  // Compute global fixed-cost allocation across ALL non-deleted projects.
  // Daily proportional split: concurrent projects share the daily fixed expense.
  const monthlyFixedExpense = Number(globalSettings?.monthlyFixedExpense) || 0;
  const fixedCostAllocations = useMemo(
    () => computeFixedCostAllocations(projects, monthlyFixedExpense),
    [projects, monthlyFixedExpense]
  );

  const totalBudget = activeProjects.reduce((a, p) => a + p.budget, 0);
  const urgentCount = activeProjects.filter(p => {
    const d = daysBetween(TODAY, new Date(p.due));
    return d >= 0 && d <= 14;
  }).length;
  const totalProfit = activeProjects.reduce((a, p) => a + calcCosts(p, fixedCostAllocations[p.id], monthlyFixedExpense).profit, 0);

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

      {focusedProjectId && (
        <div
          className="focus-backdrop"
          onClick={() => {
            const p = projects.find(p => p.id === focusedProjectId);
            if (p && (p.infoOpen || p.costsOpen)) {
              onUpdateProject(focusedProjectId, { infoOpen: false, costsOpen: false });
            }
            if (expanded) setExpanded(null);
          }}
        />
      )}

      <div className="app-body">
        <Sidebar
          currentPage={currentPage}
          onChange={setCurrentPage}
          counts={{ projects: activeProjects.length }}
        />

        <main className="app-main">
          {currentPage === 'projects' && (
            <>
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
                  {tab === 'active' && activeProjects.length > 1 && (
                    <>
                      <button className="btn btn-ghost small sort-by-due-btn" onClick={sortByDueDate} title="依交件日由近到遠重新排列卡片">
                        依交件日排序
                      </button>
                      <span className="sep">·</span>
                    </>
                  )}
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
                      onTogglePanel={onTogglePanel}
                      onDeleteProject={onDeleteProject}
                      fixedCostShare={fixedCostAllocations[p.id]}
                      monthlyFixedExpense={monthlyFixedExpense}
                      onOpenCashSettings={() => setShowCashSettings(true)}
                      outsourceRoles={[...DEFAULT_OUTSOURCE_ROLES, ...((globalSettings?.customOutsourceRoles) || [])]}
                      customOutsourceRoles={globalSettings?.customOutsourceRoles || []}
                      onUpdateCustomOutsourceRoles={onUpdateCustomOutsourceRoles}
                      isFocused={focusedProjectId === p.id}
                      anyFocused={!!focusedProjectId}
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
            </>
          )}

          {currentPage === 'finance' && (
            <FinancePage
              projects={activeProjects}
              allProjects={projects}
              settings={globalSettings || {}}
              onOpenSettings={() => setShowCashSettings(true)}
              onUpdateExtraExpenses={onUpdateExtraExpenses}
              onUpdateCustomCategories={onUpdateCustomCategories}
            />
          )}

          {currentPage === 'calendar' && (
            <CalendarPage
              projects={activeProjects}
              onMoveEvent={(eventInfo, newDate) => {
                const project = projects.find(p => p.id === eventInfo.projectId);
                if (!project) return;
                const patch = patchForCalendarEvent(project, eventInfo, newDate);
                if (patch) onUpdateProject(eventInfo.projectId, patch);
              }}
              onResizeStage={(projectId, stageId, change) => {
                const project = projects.find(p => p.id === projectId);
                if (!project) return;
                const patch = patchForStageBarChange(project, stageId, change);
                if (patch) onUpdateProject(projectId, patch);
              }}
            />
          )}
        </main>
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
