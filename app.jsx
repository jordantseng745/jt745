// Project tracker app — main React component
const { useState, useEffect, useMemo, useRef, useCallback } = React;

// ---------- Constants ----------
// Six-stage default template. Each stage has:
//   items     — default items shown when a project is created
//   altItems  — optional / case-by-case items the user can pick from a dropdown
//               to re-add after deleting, or to add for special projects
//   weight    — 該階段佔整個專案完成度的比重（六階段合計 100）。
//               拍攝最重、結案收尾最輕，讓完成度數字貼近「實際工作量」而非「階段數量」。
const DEFAULT_STAGES_TPL = [
  {
    label: '評估期',
    weight: 5,
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
    weight: 15,
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
    weight: 25,
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
    weight: 30,
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
    weight: 20,
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
    weight: 5,
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
// 收款排程裡「最後一筆」＝預計收款日最晚的那筆（追加款排在陣列最後，但日期可能比尾款早）
const getFinalPayment = (payments) => {
  const dated = (payments || []).filter(p => p && p.dueDate);
  if (dated.length === 0) return payments && payments[payments.length - 1];
  return dated.reduce((a, b) => (b.dueDate > a.dueDate ? b : a));
};
const getOutsourcePayDate = (project) => {
  if (project.outsourcePayDate) return project.outsourcePayDate;
  const payments = getPayments(project);
  const last = getFinalPayment(payments);
  if (!last?.dueDate) return '';
  // 「尾款入帳後 5 天」：尾款已收就用實際入帳日；還沒收就用預計日（逾期未收會被推到明天，外包也跟著往後）
  const base = (typeof getPaymentEffectiveDate === 'function' && getPaymentEffectiveDate(last)) || last.dueDate;
  return addDays(base, 5);
};
// 外包單筆「已付」狀態 helpers（向下相容：舊資料沒有這兩個欄位）
// 「已付」= 你已經把錢從銀行轉出去了；「未付」= 還沒付，現金流圖用預估日
// ---- 客戶收款「已收到」helpers（跟外包 paid/paidDate 同一套模式；舊資料沒欄位＝未收）----
const isPaymentReceived = (pay) => pay?.received === true;
// 一筆收款的「有效日期」：
//   已收 → 實際入帳日（現金流圖畫在真的進來的那天）
//   未收 → 預計日；但預計日已過還沒收到，錢就還不在銀行，視為「今天以後才會進來」
const getPaymentEffectiveDate = (pay) => {
  if (isPaymentReceived(pay) && pay.receivedDate) return pay.receivedDate;
  if (!pay?.dueDate) return '';
  const d = new Date(pay.dueDate); d.setHours(0, 0, 0, 0);
  // 推到「明天」：今天的餘額只能算真的進來的錢，逾期款要等它真的入帳才算
  return d < TODAY ? addDays(toISODate(TODAY), 1) : pay.dueDate;
};
// 未付外包同一套：預估付款日已過但還沒付 → 錢還在戶頭，推到明天
const getOutsourceEffectivePayDate = (project, o) => {
  if (isOutsourcePaid(o)) return o.paidDate || '';
  const est = getOutsourcePayDate(project);
  if (!est) return '';
  const d = new Date(est); d.setHours(0, 0, 0, 0);
  return d < TODAY ? addDays(toISODate(TODAY), 1) : est;
};
// 專案的收款狀態：從每筆款項推導，不另存欄位（避免手動狀態跟實際紀錄打架）
//   'none' 一筆都沒收 / 'partial' 收了一部分 / 'full' 全收齊
const getBillingStatus = (project) => {
  const pays = getPayments(project).filter(p => (Number(p.percentage) || 0) > 0);
  if (pays.length === 0) return 'none';
  const got = pays.filter(isPaymentReceived).length;
  return got === 0 ? 'none' : got === pays.length ? 'full' : 'partial';
};
const isFullyPaid = (project) => getBillingStatus(project) === 'full';
// 標記「已收／已付」時的預設日期：表定日（有延誤你再改），但不能是未來 → 提早收到就用今天
const defaultActualDate = (scheduled) => {
  const today = toISODate(TODAY);
  if (!scheduled) return today;
  return scheduled < today ? scheduled : today;
};
// 已收金額 / 已收比例
const getReceivedAmount = (project) => {
  const budget = Number(project.budget) || 0;
  return getPayments(project).filter(isPaymentReceived)
    .reduce((a, p) => a + budget * (Number(p.percentage) || 0) / 100, 0);
};
// ---- 追加款項（合約追加）----
// 款項是「百分比 × 合約金額」算出來的，所以不能只改合約金額——已收的頭款會被放大。
// 正確做法：合約加上追加額，原本每筆款項的百分比重算讓金額維持不變，再多一列「追加款」。
// 也記在 budgetAdditions 裡（原始合約存在 baseBudget），之後看得出「原本多少、後來加了多少」。
function applyBudgetAddition(project, amount, dueDate) {
  const add = Math.round(Number(amount) || 0);
  if (add <= 0) return null;
  const oldBudget = Number(project.budget) || 0;
  const newBudget = oldBudget + add;
  const rows = getPayments(project).map(p => ({
    ...p,
    percentage: oldBudget > 0 ? (Number(p.percentage) || 0) * oldBudget / newBudget : 0,
  }));
  const today = toISODate(TODAY);
  const d = new Date(today);
  rows.push({
    id: uid('pay'),
    label: `追加款 ${d.getMonth() + 1}/${d.getDate()}`,
    percentage: add / newBudget * 100,
    dueDate: dueDate || '',
    addition: true, addedAt: today, addedAmount: add,
  });
  return {
    budget: newBudget,
    payments: rows,
    baseBudget: (project.baseBudget != null ? Number(project.baseBudget) : oldBudget),
    budgetAdditions: [...(project.budgetAdditions || []), { amount: add, date: today, dueDate: dueDate || '' }],
  };
}
const getAddedBudget = (p) => (p && p.baseBudget != null) ? Math.max(0, (Number(p.budget) || 0) - Number(p.baseBudget)) : 0;
const isOutsourcePaid = (o) => o?.paid === true;
const getOutsourcePaidDate = (o) => (o?.paid && o?.paidDate) ? o.paidDate : '';
// 某筆外包「實際入帳日期」：已付 → 用實際付款日；未付 → 用專案的預估付款日
const getOutsourceEffectiveDate = (project, o) => {
  if (isOutsourcePaid(o) && o.paidDate) return o.paidDate;
  return getOutsourcePayDate(project);
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
  weight: tpl.weight,
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

// ---------- 儲存狀態總機（Save tracker）----------
// 所有「寫入資料庫」的函式都會跟這裡報備：開始了 / 成功了 / 失敗了。
// SaveIndicator 元件訂閱它，在畫面角落即時顯示「儲存中／已儲存／儲存失敗」。
//
// 為什麼要有 key：這個 App 的每次寫入都是「整筆專案覆蓋」（見 toRow），
// 不是只補一個欄位。所以同一個 key 後來寫成功了，就真的可以蓋掉先前那次失敗
// ——資料不會殘缺。不同 key 之間則互不相干，A 案失敗不會被 B 案的成功掩蓋。
const SaveTracker = (function () {
  let pending = 0;                 // 正在寫入中的數量
  const failures = new Map();      // key -> { msg, retry }  尚未被成功寫入取代的失敗
  let lastSavedAt = null;          // 最後一次成功寫入的時間戳
  const listeners = new Set();

  function snapshot() {
    let status;
    if (failures.size > 0)   status = 'error';
    else if (pending > 0)    status = 'saving';
    else if (lastSavedAt)    status = 'saved';
    else                     status = 'idle';
    let firstMsg = null;
    failures.forEach(function (v) { if (firstMsg === null) firstMsg = v.msg; });
    return {
      status: status,
      pending: pending,
      failedCount: failures.size,
      lastSavedAt: lastSavedAt,
      lastError: firstMsg,
    };
  }

  function emit() {
    const snap = snapshot();
    listeners.forEach(function (fn) { try { fn(snap); } catch (e) {} });
  }

  return {
    begin: function () { pending++; emit(); },
    ok: function (key) {
      pending = Math.max(0, pending - 1);
      failures.delete(key);          // 同一個 key 寫成功 → 先前的失敗已被覆蓋
      lastSavedAt = Date.now();
      emit();
    },
    fail: function (key, msg, retry) {
      pending = Math.max(0, pending - 1);
      failures.set(key, { msg: msg || '未知錯誤', retry: retry });
      emit();
    },
    // 把所有失敗的寫入重跑一次
    retryAll: function () {
      const jobs = [];
      failures.forEach(function (v) { if (v.retry) jobs.push(v.retry); });
      jobs.forEach(function (fn) { fn(); });
    },
    hasUnsaved: function () { return pending > 0 || failures.size > 0; },
    snapshot: snapshot,
    subscribe: function (fn) {
      listeners.add(fn);
      return function () { listeners.delete(fn); };
    },
  };
})();

// 把一個寫入動作包起來，自動向總機回報。
// key 用來識別「這是在寫哪一筆」，失敗後重試也是重跑同一個 run。
async function trackSave(key, run) {
  SaveTracker.begin();
  try {
    const result = await run();
    SaveTracker.ok(key);
    return result;
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    // 重試失敗會再度登記回 failures，這裡先接住避免噴出無關的 unhandled rejection
    SaveTracker.fail(key, msg, function () {
      trackSave(key, run).catch(function () {});
    });
    throw e;
  }
}

// ---------- 專案劇照（Supabase Storage）----------
// 圖片不進 projects 的 jsonb：那張表每次打勾都是整筆重寫，塞圖進去等於每打一個勾重傳一張圖。
// 圖片放 Storage bucket，專案資料只存一個公開網址（coverUrl）。
const COVER_BUCKET = 'project-stills';

// 瀏覽器端先縮圖再上傳，省流量也省載入時間
// 最長邊 2400px、JPEG 品質 0.85：檔案約 400–800KB。卡片會把圖放大到 2–3×，1600 會糊。
function resizeImageToBlob(file, maxSide, quality) {
  maxSide = maxSide || 2400; quality = quality || 0.85;
  return new Promise(function (resolve, reject) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error('無法壓縮圖片')); }, 'image/jpeg', quality);
    };
    img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('這個檔案不是可讀的圖片')); };
    img.src = url;
  });
}

// bucket 是「私有」的：專案資料只存路徑（coverPath），顯示時再向 Supabase 要一把
// 7 天有效的簽名網址。沒登入、或鑰匙過期，網址就打不開——未發表的案子不會外流。
async function uploadCoverImage(projectId, file) {
  const blob = await resizeImageToBlob(file);
  const path = projectId + '/' + Date.now() + '.jpg';
  return trackSave('cover:' + projectId, async function () {
    const { error } = await supa.storage.from(COVER_BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' });
    if (error) throw new Error(error.message || '上傳失敗');
    return path;
  });
}

// 刪掉 Storage 上不再使用的劇照（換圖、移除、彻底刪除專案時）。失敗只記 console，不擋操作。
async function deleteCoverImage(path) {
  if (!path) return;
  try {
    const { error } = await supa.storage.from(COVER_BUCKET).remove([path]);
    if (error) console.warn('[cover] delete failed:', error.message);
    signedCoverCache.delete(path);
  } catch (e) { console.warn('[cover] delete failed:', e && e.message); }
}

// 簽名網址快取：同一張圖在這次開啟期間只要一次，過期前 1 小時自動換新
const COVER_SIGN_SECONDS = 60 * 60 * 24 * 7;
const signedCoverCache = new Map(); // path -> { url, expiresAt, promise }
function getSignedCoverUrl(path) {
  if (!path) return Promise.resolve('');
  const now = Date.now();
  const hit = signedCoverCache.get(path);
  if (hit && hit.url && hit.expiresAt - now > 60 * 60 * 1000) return Promise.resolve(hit.url);
  if (hit && hit.promise) return hit.promise;
  const promise = supa.storage.from(COVER_BUCKET).createSignedUrl(path, COVER_SIGN_SECONDS)
    .then(function (res) {
      if (res.error || !res.data || !res.data.signedUrl) throw new Error((res.error && res.error.message) || '無法取得圖片');
      signedCoverCache.set(path, { url: res.data.signedUrl, expiresAt: now + COVER_SIGN_SECONDS * 1000 });
      return res.data.signedUrl;
    })
    .catch(function (e) { signedCoverCache.delete(path); console.error('[cover] signed url failed:', e.message); return ''; });
  signedCoverCache.set(path, { promise: promise });
  return promise;
}
function useCoverUrl(path) {
  const cached = path ? signedCoverCache.get(path) : null;
  const [url, setUrl] = useState(cached && cached.url ? cached.url : '');
  useEffect(() => {
    let alive = true;
    if (!path) { setUrl(''); return; }
    getSignedCoverUrl(path).then(u => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [path]);
  return url;
}

async function createProjectInDB(projectData) {
  // 新增沒有既有 id 可當 key，用一次性的 key；失敗不提供 retry
  // （重試新增有重複建立的風險，交給使用者自己再按一次「新增專案」）
  return trackSave('create:' + Date.now(), async function () {
    // Negative timestamp so newest projects sort to the top by default
    const { data, error } = await supa
      .from('projects')
      .insert({ data: projectData, position: -Date.now() })
      .select('id, data, position')
      .single();
    if (error) throw error;
    return { ...data.data, id: data.id, _position: data.position };
  });
}

async function saveProjectInDB(project) {
  if (!project?.id) return;
  // 先把要寫的內容拍成快照，重試時才不會受之後的編輯影響
  const payload = toRow(project);
  const id = project.id;
  return trackSave('project:' + id, async function () {
    const { error } = await supa
      .from('projects')
      .update({ data: payload })
      .eq('id', id);
    if (error) throw error;
  }).catch(function (e) {
    // 不往外拋：維持樂觀更新的操作手感，失敗改由角落的指示器呈現
    console.error('[saveProject] failed:', e.message);
  });
}

async function deleteProjectInDB(id) {
  return trackSave('delete:' + id, async function () {
    const { error } = await supa.from('projects').delete().eq('id', id);
    if (error) throw error;
  }).catch(function (e) {
    console.error('[deleteProject] failed:', e.message);
  });
}

async function saveOrderInDB(orderedIds) {
  const ids = orderedIds.slice();
  return trackSave('order', async function () {
    const results = await Promise.all(ids.map((id, i) =>
      supa.from('projects').update({ position: i }).eq('id', id)
    ));
    const bad = results.find(r => r && r.error);
    if (bad) throw bad.error;
  }).catch(function (e) {
    console.error('[saveOrder] failed:', e.message);
  });
}

// ---------- User settings (global cash-flow params) ----------
// 注意：這裡「載入失敗」和「載入成功但本來就是空的」必須分得出來。
// 分不出來的話，一次連線失敗會讓畫面看起來像「資料不見了」，
// 而且使用者若在那個狀態下按儲存，就會把空設定蓋回資料庫、真的洗掉資料。
// 失敗一律用 throw，由呼叫端記錄成 settingsError。
// 取得目前使用者 id。優先用呼叫端傳進來的（Tracker 手上本來就有 session），
// 沒傳才讀本機已保存的 session。
//
// ⚠️ 絕對不要改回 supa.auth.getUser()。
// getUser() 會「額外打一次網路請求」去跟 Auth 伺服器驗證 token；
// 而 loadProjects() 完全不需要這一步。這個不對稱正是 2026-08-08 那次
// 「專案都在、財務資料整片消失」最可能的成因：那一次額外請求失敗了，
// 專案照常載入，設定卻拿不到。getSession() 只讀本機、不打網路，穩定得多。
async function resolveUserId(userId) {
  if (userId) return userId;
  const { data, error } = await supa.auth.getSession();
  if (error) throw new Error('無法取得登入狀態：' + error.message);
  const id = data && data.session && data.session.user && data.session.user.id;
  if (!id) throw new Error('尚未登入');
  return id;
}

async function loadUserSettings(userId) {
  const uid = await resolveUserId(userId);
  const { data, error } = await supa
    .from('user_settings')
    .select('data')
    .eq('owner_id', uid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.data || {};
}

async function saveUserSettings(settings, userId) {
  const payload = JSON.parse(JSON.stringify(settings || {}));
  return trackSave('settings', async function () {
    const uid = await resolveUserId(userId);
    const { error } = await supa
      .from('user_settings')
      .upsert({ owner_id: uid, data: payload, updated_at: new Date().toISOString() });
    if (error) throw error;
  }).catch(function (e) {
    console.error('[saveUserSettings] failed:', e.message);
  });
}

// ---------- 財務綁定自我檢查（每次動到金額／日期邏輯後都要跑）----------
// 用一個合成專案，逐項改「使用者能改的每個金錢輸入」，確認所有該變的下游計算真的變了：
// 現金流事件、今日餘額、單案損益、收付款列表、營業稅。在 Console 打 __financeAudit() 看結果。
// 這不是單元測試框架，是給沒有 build step 的專案用的「改完按一下就知道有沒有斷線」。
function runFinanceAudit() {
  const T = toISODate(TODAY);
  const inFuture = (n) => addDays(T, n);
  const base = () => ({
    id: 'audit-p', title: '審查用案', client: '—', budget: 1000000, start: addDays(T, -60), due: inFuture(30),
    overseas: false, archived: false, deleted: false,
    payments: [
      { id: 'pay-1', label: '頭期款', percentage: 50, dueDate: inFuture(5) },
      { id: 'pay-2', label: '尾款',   percentage: 50, dueDate: inFuture(30) },
    ],
    outsources: [{ id: 'o1', name: '外包A', type: 'company', amount: 100000, taxable: true, paid: false, paidDate: null }],
    stages: [],
  });
  const settings = () => ({ startDate: addDays(T, -90), bankBalance: 500000, monthlyFixedExpense: 100000, deductionDay: 5, extraExpenses: [] });
  const sumBy = (ev, pred) => ev.filter(pred).reduce((a, e) => a + e.amount, 0);
  const snap = (p, st) => {
    const series = buildCashflowSeries([p], st, 12);
    const alloc = computeFixedCostAllocations([p], st.monthlyFixedExpense);
    const c = calcCosts(p, alloc[p.id], st.monthlyFixedExpense, 0);
    return {
      income: sumBy(series.events, e => e.amount > 0 && /^income/.test(e.kind)),
      incomeEvents: series.events.filter(e => /^income/.test(e.kind)).map(e => toISODate(e.date) + ':' + e.kind + ':' + Math.round(e.amount)).join('|'),
      outsourceOut: -sumBy(series.events, e => /^outsource/.test(e.kind)),
      outsourceEvents: series.events.filter(e => /^outsource/.test(e.kind)).map(e => toISODate(e.date) + ':' + e.kind).join('|'),
      extraOut: -sumBy(series.events, e => e.kind === 'extra'),
      fixedOut: -sumBy(series.events, e => e.kind === 'fixed'),
      vatOut: -sumBy(series.events, e => e.kind === 'vat'),
      todayBalance: computeTodayBalance([p], st),
      profit: c.profit, netVAT: c.netVAT, outsourceTotal: c.outsourceTotal, fixedCost: c.fixedCost,
      receivableRows: buildReceivableRows([p]).map(r => r.label + ':' + r.amount + ':' + r.bucket + ':' + (r.dueDate || '') + ':' + (r.receivedDate || '')).join('|'),
      payableRows: buildPaymentRows([p]).map(r => r.outsourceName + ':' + r.amount + ':' + r.bucket + ':' + (r.paidDate || r.effDate || '')).join('|'),
      inFinance: buildCashflowSeries([p], st, 12).events.length,
      // 跟另一個同期案子一起分攤時，本案拿到的固定成本（工作區間會影響它）
      overtime: Math.round(computeOvertimeAllocations([p], st.monthlyFixedExpense)[p.id] || 0),
      // 單案視窗的「逐月明細」各月加總必須等於分攤固定成本（跟一個同期案子合算）
      byMonthMatches: (() => {
        const q = Object.assign(base(), { id: 'audit-q', start: addDays(T, -30), due: inFuture(60) });
        const alloc = computeFixedCostAllocations([p, q], st.monthlyFixedExpense);
        const sum = computeProjectFixedByMonth([p, q], st.monthlyFixedExpense, p.id).reduce((a, r) => a + r.amount, 0);
        return Math.abs(sum - (alloc[p.id] || 0)) < 1;
      })(),
      fixedShareWithPeer: (() => { const q = Object.assign(base(), { id: 'audit-q' }); return Math.round(computeFixedCostAllocations([p, q], st.monthlyFixedExpense)[p.id] || 0); })(),
    };
  };
  const checks = [];
  const check = (name, mutate, expect) => {
    const p = base(), st = settings();
    const before = snap(p, st);
    const r = mutate(p, st) || {};
    const after = snap(r.p || p, r.st || st);
    const problems = [];
    for (const [key, rule] of Object.entries(expect)) {
      const b = before[key], a = after[key];
      let ok;
      if (rule === 'up') ok = a > b; else if (rule === 'down') ok = a < b;
      else if (rule === 'change') ok = a !== b; else if (rule === 'same') ok = a === b;
      else if (rule === 'zero') ok = a === 0; else if (typeof rule === 'function') ok = rule(a, b);
      if (!ok) problems.push(`${key}: 期望 ${typeof rule === 'function' ? '自訂條件' : rule}，實際 ${JSON.stringify(b)} → ${JSON.stringify(a)}`);
    }
    checks.push({ 檢查: name, 通過: problems.length === 0 ? '✓' : '✗', 問題: problems.join('；') });
  };

  check('合約金額 +100,000 → 收入、應收、稅、淨利都變', (p) => { p.budget += 100000; },
    { income: 'up', receivableRows: 'change', netVAT: 'up', profit: 'up' });
  check('頭款比例 50→30 → 兩筆收入事件金額變、總額不變', (p) => { p.payments[0].percentage = 30; p.payments[1].percentage = 70; },
    { incomeEvents: 'change', income: 'same' });
  check('尾款預計日往後 20 天 → 收入事件日期變、應收列表變、外包預估付款日跟著動', (p) => { p.payments[1].dueDate = inFuture(50); },
    { incomeEvents: 'change', receivableRows: 'change', outsourceEvents: 'change' });
  check('尾款標記已收（實際入帳日=今天−3）→ 事件變 income-received、今日餘額增加、應收列表變', (p) => { p.payments[1].received = true; p.payments[1].receivedDate = addDays(T, -3); },
    { incomeEvents: (a) => /income-received/.test(a), todayBalance: 'up', receivableRows: 'change' });
  check('頭款預計日已過但未收 → 收入推到明天、不進今日餘額（今日餘額只少了那筆的營業稅：稅照發票日繳）', (p) => { p.payments[0].dueDate = addDays(T, -10); },
    { incomeEvents: (a) => a.includes(inFuture(1) + ':income'),
      todayBalance: (a, b) => Math.abs((b - a) - (500000 * 0.05 / 1.05)) < 1 });
  check('已收但實際入帳日早於現金流起算日 → 不重複計入（已在期初餘額裡）', (p, st) => { p.payments[0].received = true; p.payments[0].receivedDate = addDays(T, -120); },
    { income: 'down', todayBalance: 'same' });
  check('外包金額 +50,000 → 支出事件、外包總額、淨利、應付列表都變', (p) => { p.outsources[0].amount += 50000; },
    { outsourceOut: 'up', outsourceTotal: 'up', profit: 'down', payableRows: 'change' });
  check('外包標記已付（實付日=今天−2）→ 事件變 outsource-paid、今日餘額減少', (p) => { p.outsources[0].paid = true; p.outsources[0].paidDate = addDays(T, -2); },
    { outsourceEvents: (a) => /outsource-paid/.test(a), todayBalance: 'down', payableRows: 'change' });
  check('外包預估付款日手動改 → 未付外包事件日期變', (p) => { p.outsourcePayDate = inFuture(60); },
    { outsourceEvents: 'change', payableRows: 'change' });
  check('外包改個人（不可抵稅）→ 應繳營業稅上升', (p) => { p.outsources[0].type = 'personal'; p.outsources[0].taxable = false; },
    { netVAT: 'up' });
  check('切成國外案 → 營業稅歸零', (p) => { p.overseas = true; },
    { netVAT: 'zero', vatOut: 'zero' });
  check('額外支出（已確認）→ 出現 extra 支出事件、今日餘額不變（日期在未來）', (p, st) => { st.extraExpenses = [{ id: 'x', name: '設備', type: 'equipment', amount: 80000, plannedDate: inFuture(10), confirmed: true }]; },
    { extraOut: 'up', todayBalance: 'same' });
  check('額外支出（未確認）→ 不影響現金流', (p, st) => { st.extraExpenses = [{ id: 'x', name: '設備', type: 'equipment', amount: 80000, plannedDate: inFuture(10), confirmed: false }]; },
    { extraOut: 'same' });
  check('每月固定支出 +20,000 → 固定支出事件、分攤固定成本、淨利都變', (p, st) => { st.monthlyFixedExpense += 20000; },
    { fixedOut: 'up', fixedCost: 'up', profit: 'down' });
  check('期初餘額 +100,000 → 今日餘額同步 +100,000', (p, st) => { st.bankBalance += 100000; },
    { todayBalance: (a, b) => Math.round(a - b) === 100000 });
  // 注意：單一案子時每個月本來就全額吸收，所以要跟一個同期案子一起算才看得出份額下降
  check('填了實際工作區間（中間停工）→ 與同期案子合算時本案份額下降、延期佔用費為 0', (p) => { p.extendedDue = inFuture(45); p.workPeriods = [{ start: addDays(T, -60), end: addDays(T, -35) }, { start: addDays(T, -5), end: '' }]; },
    { fixedShareWithPeer: 'down', overtime: 'zero', byMonthMatches: (a) => a === true });
  check('追加款 50,000（預計 40 天後收）→ 合約 +50,000、原頭款金額不變、收入 +50,000、應收多一筆', (p) => {
    p.payments[0].received = true; p.payments[0].receivedDate = addDays(T, -3);
    Object.assign(p, applyBudgetAddition(p, 50000, inFuture(40)));
  }, { income: (a, b) => Math.round(a - b) === 50000, receivableRows: (a, b) => a.split('|').length === b.split('|').length + 1 && a.includes('頭期款:500000'), profit: 'up' });
  check('歸檔（已交件）→ 仍計入現金流與收付款', (p) => { p.archived = true; p.deliveredAt = T; },
    { income: 'same', receivableRows: 'same', payableRows: 'same' });
  check('刪除 → 從現金流與收付款消失', (p) => { p.deleted = true; },
    { income: 'zero', receivableRows: (a) => a === '', payableRows: (a) => a === '' });

  const failed = checks.filter(c => c.通過 === '✗');
  if (typeof console !== 'undefined' && console.table) console.table(checks);
  console.log(failed.length === 0 ? `財務綁定檢查：${checks.length} 項全部通過` : `財務綁定檢查：${failed.length} 項失敗`, failed);
  return { total: checks.length, failed: failed.length, checks };
}
if (typeof window !== 'undefined') window.__financeAudit = runFinanceAudit;

// ---------- Celebration helpers ----------
// Stage burst: emerald-leaning, small. Project complete: warm-spectrum, big.
// Both colour sets lean warm/saturated — research on dopamine-eliciting palettes
// favours bright, varied warm tones over cool monochrome.
const STAGE_BURST_COLORS    = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#fbbf24'];
const PROJECT_BURST_COLORS  = ['#10b981', '#34d399', '#fbbf24', '#eab308', '#fb7185', '#fda4af', '#fde68a', '#fef3c7'];

// 單一項目的完成比例（0..1）：
//   有子細項 → 已完成子細項數 / 全部子細項數
//   無子細項 → 1（已完成）或 0（未完成）
function itemProgress(it) {
  if (isQtyItem(it)) return qtyRatio(it);
  if (it.children && it.children.length > 0) {
    const doneCount = it.children.filter(c => {
      const s = childStatus(c);
      return s === 'done' || s === 'confirmed';
    }).length;
    return doneCount / it.children.length;
  }
  const st = itemStatus(it);
  return (st === 'done' || st === 'confirmed') ? 1 : 0;
}
// 階段完成比例（0..1）：每個項目權重相等取平均。空階段 fallback 到 stage.status。
function stageProgress(stage) {
  if (!stage.items || stage.items.length === 0) {
    return stage.status === 'done' ? 1 : 0;
  }
  const total = stage.items.reduce((a, it) => a + itemProgress(it), 0);
  return total / stage.items.length;
}
// 階段權重：佔整個專案完成度的比重。
// 來源優先序：stage.weight（新專案建立時從模板帶入）→ 模板同名階段 → 找不到就當「平均份量」。
// 舊專案的階段多半沒有 weight、名稱也對不到新模板 → 全部 fallback 成相同權重，行為跟改版前一樣。
function getStageWeight(stage) {
  const w = Number(stage && stage.weight);
  if (w > 0) return w;
  const label = (stage && stage.label) || '';
  const tpl = findStageTemplate(label);
  if (tpl && Number(tpl.weight) > 0) return Number(tpl.weight);
  // 舊專案的階段名對不到新模板 → 用關鍵字推測份量（例：「交件收款」→ 收尾 5）
  if (/拍攝/.test(label) && /後製|後期/.test(label)) return 50; // 「拍攝後製」合併階段 = 30 + 20
  if (/拍攝/.test(label)) return 30;
  if (/美術/.test(label)) return 25;
  if (/後製|後期/.test(label)) return 20;
  if (/前期/.test(label)) return 15;
  if (/評估|簽約|啟動/.test(label)) return 5;
  if (/交件|交付|收款|結案/.test(label)) return 5;
  return 17; // ≈ 100 / 6，視為一個平均份量的階段
}
// 專案完成比例（0..100 整數）：各階段依權重加權平均。
// 拍攝（30）做完跳一大格、最終交付（5）只剩收尾時不會看起來還差一大塊。
function projectPct(project) {
  if (!project.stages || project.stages.length === 0) return 0;
  let acc = 0, wsum = 0;
  project.stages.forEach(s => {
    const w = getStageWeight(s);
    acc += stageProgress(s) * w;
    wsum += w;
  });
  return wsum > 0 ? Math.round((acc / wsum) * 100) : 0;
}
// 數「已完成的最小工作單位」總數：有子細項的細項算子細項，沒有的算細項本身。
// 給「距上次打開」摘要用。
function countDoneLeaves(project) {
  let done = 0;
  (project.stages || []).forEach(s => (s.items || []).forEach(it => {
    if (it.children && it.children.length > 0) {
      it.children.forEach(c => {
        const st = childStatus(c);
        if (st === 'done' || st === 'confirmed') done++;
      });
    } else {
      const st = itemStatus(it);
      if (st === 'done' || st === 'confirmed') done++;
    }
  }));
  return done;
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
  // 數字滾動：pct 變化時用 0.6 秒滾到新值（先快後慢），不是瞬間跳──回饋感差很多
  const [disp, setDisp] = useState(pct);
  const prevRef = useRef(pct);
  useEffect(() => {
    const from = prevRef.current, to = pct;
    prevRef.current = pct;
    if (from === to) return;
    let raf, start;
    const step = (ts) => {
      if (start === undefined) start = ts;
      const t = Math.min(1, (ts - start) / 600);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic：先快後慢
      setDisp(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [pct]);
  const off = c * (1 - disp / 100);
  return (
    <div className={`completion ${pct === 100 ? 'done' : ''}`}>
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle className="track" cx="28" cy="28" r={r} fill="none" strokeWidth="3" />
        <circle className="fill" cx="28" cy="28" r={r} fill="none" strokeWidth="3"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
      </svg>
      <div className="completion-text">{disp}%</div>
    </div>
  );
}

// 戰績列：已結案專案的累積成就。案子歸檔後不是「消失」，是「入列」。
// 「比預定早交」只累計提前的天數（completedAt 早於 due），遲交不倒扣——這裡是獎盃架，不是法庭。
function TrophyStrip({ projects, onHide }) {
  const count = projects.length;
  const totalBudget = projects.reduce((a, p) => a + (Number(p.budget) || 0), 0);
  const durations = projects
    .filter(p => p.start && (p.deliveredAt || p.completedAt || p.due))
    // 工期 = 起始 → 實際交件日（不含等尾款的時間）；舊案沒有 deliveredAt 就退回完成日／原定交件日
    .map(p => daysBetween(new Date(p.start), new Date(p.deliveredAt || p.completedAt || p.due)))
    .filter(d => d > 0);
  const avgDays = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
  const savedDays = projects.reduce((a, p) => {
    if (!p.completedAt || !p.due) return a;
    const d = daysBetween(new Date(p.completedAt), new Date(p.due));
    return d > 0 ? a + d : a;
  }, 0);
  return (
    <div className="trophy-strip">
      <span className="trophy-label">戰績</span>
      <span className="trophy-item">已結案 <strong>{count}</strong> 支</span>
      <span className="sep">·</span>
      <span className="trophy-item">合約總額 <strong>{fmtNT(totalBudget)}</strong></span>
      {avgDays !== null && (
        <><span className="sep">·</span><span className="trophy-item">平均工期 <strong>{avgDays}</strong> 天</span></>
      )}
      {savedDays > 0 && (
        <><span className="sep">·</span><span className="trophy-item saved">比預定早交 <strong>{savedDays}</strong> 天</span></>
      )}
      {onHide && <button className="trophy-hide" onClick={onHide} type="button" title="隱藏戰績列（之後可從上方「顯示戰績」找回）">隱藏</button>}
    </div>
  );
}

function StageBar({ variant, stages, selectedStageId, onClick, onCycle, onInsert, onDelete }) {
  // 長條 variant（預設）：多鄰國式的一條進度條。
  //   每段寬度 = 份量（固定，不再依狀態放大縮小）；每段依自己的完成比例從左填到右；
  //   填色連續 → 看起來就是一整條，總填色長度 = projectPct，跟圓環數字永遠一致。
  //   階段名稱移到長條下方，長條本身乾淨。點段落＝展開該階段，Shift+點＝切狀態（跟以前一樣）。
  if (variant === 'bar') {
    const weights = stages.map(getStageWeight);
    return (
      <div className="stage-bar variant-bar">
        <div className="stage-track">
          {stages.map((s, i) => {
            const prog = stageProgress(s);
            const cls = `segment status-${s.status} ${selectedStageId === s.id ? 'selected' : ''} ${prog > 0 && prog < 1 ? 'partial' : ''} ${prog >= 1 ? 'full' : ''}`;
            const handleClick = (e) => { if (e.shiftKey) onCycle(s.id); else onClick(s.id); };
            return (
              <React.Fragment key={s.id}>
                {i === 0 && <InsertGap onInsert={() => onInsert(0)} />}
                <button className={cls} data-stage-id={s.id} onClick={handleClick}
                  style={{ flexGrow: weights[i] }}
                  title={`${s.label} ${Math.round(prog * 100)}%（份量 ${weights[i]}%）— Shift+點擊切換狀態`}>
                  <span className="seg-fill" style={{ width: `${Math.round(prog * 1000) / 10}%` }} />
                </button>
                <InsertGap onInsert={() => onInsert(i + 1)} />
              </React.Fragment>
            );
          })}
        </div>
        <div className="stage-labels">
          {stages.map((s, i) => {
            const prog = stageProgress(s);
            return (
              <React.Fragment key={s.id}>
                {i === 0 && <span className="label-gap" />}
                <button type="button" className={`seg-name status-${s.status} ${selectedStageId === s.id ? 'selected' : ''}`}
                  style={{ flexGrow: weights[i] }} onClick={(e) => { if (e.shiftKey) onCycle(s.id); else onClick(s.id); }}>
                  <span className="seg-name-text">{s.label}</span>
                  <span className="seg-pct">{Math.round(prog * 100)}%</span>
                </button>
                <span className="label-gap" />
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  }
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
        ) : null;

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

// 數量型細項：{ kind:'qty', qtyDone, qtyTotal }，例如「拍攝 47 / 100 卡」→ 這一項算 47%。
// 用獨立欄位（不是把 done 變成數字），舊資料的 done: boolean 完全不受影響。
const isQtyItem = (it) => !!it && it.kind === 'qty' && (Number(it.qtyTotal) || 0) > 0;
const qtyRatio = (it) => {
  const t = Number(it.qtyTotal) || 0; if (t <= 0) return 0;
  return Math.max(0, Math.min(1, (Number(it.qtyDone) || 0) / t));
};
// 階段狀態自動連動（跟 ChecklistEditor.setItemStatus 同一套規則，抽出來給數量型共用）：
//   全部到「已完成／已確認」→ done；原本 done 但不再全完成 → active；原本 todo 但有人動了 → active
function deriveStageStatus(items, prevStatus) {
  const allDone = items.length > 0 && items.every(it => { const s = itemStatus(it); return s === 'done' || s === 'confirmed'; });
  const anyStarted = items.some(it => itemStatus(it) !== 'todo');
  if (allDone) return 'done';
  if (prevStatus === 'done' && !allDone) return 'active';
  if (prevStatus === 'todo' && anyStarted) return 'active';
  return prevStatus;
}
// 子細項的狀態：簡單從 status / done 推
function childStatus(c) {
  if (c.status && ITEM_STATES.includes(c.status)) return c.status;
  return c.done ? 'done' : 'todo';
}
// 項目狀態：有子細項時自動推導（不能手動覆蓋）；沒有時用本身的 status
function itemStatus(it) {
  if (isQtyItem(it)) {
    const r = qtyRatio(it);
    if (r >= 1) return it.status === 'confirmed' ? 'confirmed' : 'done';
    if (it.status === 'blocked') return 'blocked';
    return r > 0 ? 'active' : 'todo';
  }
  if (it.children && it.children.length > 0) {
    const sts = it.children.map(childStatus);
    if (sts.every(s => s === 'confirmed')) return 'confirmed';
    if (sts.every(s => s === 'done' || s === 'confirmed')) return 'done';
    if (sts.some(s => s === 'blocked')) return 'blocked';
    if (sts.some(s => s !== 'todo')) return 'active';
    return 'todo';
  }
  if (it.status && ITEM_STATES.includes(it.status)) return it.status;
  return it.done ? 'done' : 'todo';
}
// 統計子細項完成度（含 confirmed 算已完成）
function childProgress(it) {
  const cs = it.children || [];
  if (cs.length === 0) return null;
  const doneCount = cs.filter(c => {
    const s = childStatus(c);
    return s === 'done' || s === 'confirmed';
  }).length;
  return { done: doneCount, total: cs.length };
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
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginLeft: 6 }}><path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
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

// 子細項列：勾選 + 點文字編輯 + 顏色標記。
var CHILD_COLORS = ['', 'yellow', 'blue'];
var CHILD_COLOR_LABELS = { '': '無', yellow: '黃', blue: '藍' };
function ChildBar({ child, onToggle, onRemove, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const colorRef = useRef(null);
  const isDone = ['done', 'confirmed'].includes(childStatus(child));
  const color = child.color || '';

  useEffect(() => {
    if (!colorOpen) return;
    const handler = (e) => { if (colorRef.current && !colorRef.current.contains(e.target)) setColorOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [colorOpen]);

  return (
    <div className={`item-bar child ${isDone ? 'is-done' : ''} ${color ? 'child-color-' + color : ''}`}>
      <button
        className={`child-checkbox ${isDone ? 'checked' : ''}`}
        onClick={onToggle}
        title={isDone ? '點一下取消完成' : '點一下標記完成'}
        type="button"
      >
        {isDone ? '✓' : ''}
      </button>
      {editing ? (
        <input
          autoFocus
          type="text"
          className="input child-edit-input"
          defaultValue={child.text}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.target.blur();
            if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={(e) => {
            var v = e.target.value.trim();
            if (v && v !== child.text) onUpdate({ text: v });
            setEditing(false);
          }}
        />
      ) : (
        <span className="item-bar-text child-text-editable" onClick={() => setEditing(true)} title="點一下編輯文字">{child.text}</span>
      )}
      <div className="child-actions">
        <div className="child-color-picker" ref={colorRef}>
          <button className={`child-color-btn ${color ? 'child-color-' + color : 'child-color-none'}`} onClick={() => setColorOpen(o => !o)} title="顏色標記" type="button">●</button>
          {colorOpen && (
            <div className="child-color-menu">
              {CHILD_COLORS.map(c => (
                <button key={c || 'none'} className={`child-color-option ${c ? 'child-color-' + c : 'child-color-none'} ${c === color ? 'current' : ''}`} onClick={() => { onUpdate({ color: c }); setColorOpen(false); }} type="button">
                  {CHILD_COLOR_LABELS[c]}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="item-bar-action danger" onClick={() => { if (confirm('確定刪除這個子細項？')) onRemove(); }} title="刪除">×</button>
      </div>
    </div>
  );
}

// 父項目底下的「+ 自訂子細項」表單
function AddChildForm({ parentId, onAdd }) {
  const [text, setText] = useState('');
  return (
    <form
      className="add-child-form"
      onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; onAdd(parentId, text); setText(''); }}
    >
      <input
        className="input"
        placeholder="+ 自訂子細項…"
        value={text}
        onChange={e => setText(e.target.value)}
      />
      <button type="submit" className="add-item-btn" aria-label="加入子細項">+</button>
    </form>
  );
}

// 父項目底下的「一鍵生成系列」表單
function PerItemSeriesForm({ parentId, onGenerate }) {
  const [open, setOpen] = useState(false);
  const [prefix, setPrefix] = useState('Card ');
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(20);
  const fromN = parseInt(from, 10);
  const toN = parseInt(to, 10);
  const count = (!isNaN(fromN) && !isNaN(toN) && toN >= fromN) ? (toN - fromN + 1) : 0;
  return (
    <div className="series-generator child-series">
      <button className="series-toggle" type="button" onClick={() => setOpen(o => !o)}>
        <span className="chevron">{open ? '▾' : '▸'}</span>
        一鍵生成系列（例：Card 01–20）
      </button>
      {open && (
        <div className="series-form">
          <label>
            <span className="series-label">前綴</span>
            <input className="input" value={prefix} onChange={e => setPrefix(e.target.value)} placeholder="Card " />
          </label>
          <label>
            <span className="series-label">從</span>
            <input type="number" className="input" min="0" value={from} onChange={e => setFrom(e.target.value)} />
          </label>
          <label>
            <span className="series-label">到</span>
            <input type="number" className="input" min="0" value={to} onChange={e => setTo(e.target.value)} />
          </label>
          <button
            type="button"
            className="btn btn-primary small series-go"
            disabled={count <= 0 || count > 100}
            onClick={() => { onGenerate(parentId, prefix, from, to); setOpen(false); }}
          >
            生成 {count > 0 ? `${count} 項` : ''}
          </button>
        </div>
      )}
    </div>
  );
}

// 新增數量型項目：名稱 + 總數（例如「拍攝」「100」）
function AddQtyItemForm({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [total, setTotal] = useState('');
  if (!open) return <button type="button" className="btn btn-ghost small" onClick={() => setOpen(true)} title="新增一個用數量計的項目，例如拍攝 100 卡">＋ 數量型項目</button>;
  const submit = (e) => {
    e.preventDefault();
    if (onAdd(name, total)) { setName(''); setTotal(''); setOpen(false); }
    else alert('請填名稱，總數要大於 0。');
  };
  return (
    <form className="add-qty-form" onSubmit={submit}>
      <input className="input" autoFocus placeholder="項目名稱（例：拍攝）" value={name} onChange={e => setName(e.target.value)} />
      <input className="input qty-total-input" type="number" min="1" placeholder="總數" value={total} onChange={e => setTotal(e.target.value)} />
      <button type="submit" className="add-item-btn" aria-label="新增">+</button>
      <button type="button" className="btn btn-ghost small" onClick={() => setOpen(false)}>取消</button>
    </form>
  );
}

function ChecklistEditor({ stage, onUpdate }) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);
  const [dragOverItemId, setDragOverItemId] = useState(null);
  // 哪些項目是展開的（顯示子細項）。預設：有 children 的自動展開、沒 children 的收起。
  // user 顯式 toggle 之後覆蓋預設行為。
  const [itemExpand, setItemExpand] = useState({});
  const isExpanded = (it) => {
    if (it.id in itemExpand) return itemExpand[it.id];
    return (it.children?.length ?? 0) > 0;
  };
  const toggleExpand = (id) => {
    setItemExpand(prev => {
      const it = stage.items.find(x => x.id === id);
      if (!it) return prev;
      const currentlyExpanded = id in prev ? prev[id] : (it.children?.length ?? 0) > 0;
      return { ...prev, [id]: !currentlyExpanded };
    });
  };

  const setItemStatus = (id, newStatus) => {
    const items = stage.items.map(it => {
      // top-level 匹配：有 children 的不能改（從 children 推導），其他正常改
      if (it.id === id) {
        if (it.children && it.children.length > 0) return it; // 父項目狀態不可手動改
        return { ...it, status: newStatus, done: newStatus === 'done' || newStatus === 'confirmed' };
      }
      // 沒找到就看看 children 裡有沒有
      if (it.children && it.children.length > 0) {
        let found = false;
        const newChildren = it.children.map(c => {
          if (c.id !== id) return c;
          found = true;
          return { ...c, status: newStatus, done: newStatus === 'done' || newStatus === 'confirmed' };
        });
        if (found) return { ...it, children: newChildren };
      }
      return it;
    });
    let status = stage.status;
    // 階段自動完成的條件：所有項目都到「已完成」或「已確認」（放寬，因為子細項用勾選只能到 done）
    const allDone = items.length > 0 && items.every(it => {
      const s = itemStatus(it);
      return s === 'done' || s === 'confirmed';
    });
    const anyStarted = items.some(it => itemStatus(it) !== 'todo');
    if (allDone) status = 'done';
    else if (status === 'done' && !allDone) status = 'active';
    else if (status === 'todo' && anyStarted) status = 'active';
    onUpdate({ ...stage, items, status });
  };
  // 數量型：改「已完成數」或「總數」，並照同一套規則連動階段狀態
  const setItemQty = (id, patch) => {
    const items = stage.items.map(it => {
      if (it.id !== id) return it;
      const total = Math.max(1, Math.round(Number(patch.qtyTotal ?? it.qtyTotal) || 1));
      const done = Math.max(0, Math.min(total, Math.round(Number(patch.qtyDone ?? it.qtyDone) || 0)));
      return { ...it, kind: 'qty', qtyTotal: total, qtyDone: done, done: done >= total };
    });
    onUpdate({ ...stage, items, status: deriveStageStatus(items, stage.status) });
  };
  // 把現有的打勾型項目轉成數量型（問總數）
  const convertToQty = (id) => {
    const it = stage.items.find(x => x.id === id); if (!it) return;
    const raw = prompt(`「${it.text}」總共有幾個單位？（例如 100 卡、24 張）`, it.qtyTotal || '');
    if (raw == null) return;
    const total = parseInt(raw, 10);
    if (!(total > 0)) { alert('請填大於 0 的整數。'); return; }
    setItemQty(id, { qtyTotal: total, qtyDone: it.qtyDone || 0 });
  };
  const addQtyItem = (text, total) => {
    const t = (text || '').trim(); const n = parseInt(total, 10);
    if (!t || !(n > 0)) return false;
    onUpdate({ ...stage, items: [...stage.items, { id: uid('i'), kind: 'qty', text: t, qtyDone: 0, qtyTotal: n, done: false, status: 'todo', start: '', end: '' }] });
    return true;
  };
  const remove = (id) => {
    // 先試 top-level
    const filtered = stage.items.filter(it => it.id !== id);
    if (filtered.length !== stage.items.length) {
      onUpdate({ ...stage, items: filtered });
      return;
    }
    // 找 children
    onUpdate({
      ...stage,
      items: stage.items.map(it => {
        if (!it.children || it.children.length === 0) return it;
        const newChildren = it.children.filter(c => c.id !== id);
        return newChildren.length !== it.children.length ? { ...it, children: newChildren } : it;
      })
    });
  };
  // 新增子細項到指定父項目
  const addChildToParent = (parentId, text) => {
    const t = text.trim();
    if (!t) return;
    onUpdate({
      ...stage,
      items: stage.items.map(it => it.id === parentId
        ? { ...it, children: [...(it.children || []), { id: uid('i'), text: t, done: false, status: 'todo', start: '', end: '' }] }
        : it),
    });
  };
  // 一鍵生成系列到指定父項目
  const generateSeriesForParent = (parentId, prefix, from, to) => {
    const fromN = parseInt(from, 10);
    const toN = parseInt(to, 10);
    if (isNaN(fromN) || isNaN(toN) || fromN < 0 || toN < fromN) {
      alert('請填正確的起 / 迄數字（迄 ≥ 起 ≥ 0）。');
      return;
    }
    const count = toN - fromN + 1;
    if (count > 100) {
      alert('一次最多生成 100 項。請分批產生。');
      return;
    }
    const padDigits = String(toN).length;
    const newKids = [];
    for (let i = fromN; i <= toN; i++) {
      newKids.push({
        id: uid('i'),
        text: `${prefix}${String(i).padStart(padDigits, '0')}`,
        done: false,
        status: 'todo',
        start: '',
        end: '',
      });
    }
    onUpdate({
      ...stage,
      items: stage.items.map(it => it.id === parentId
        ? { ...it, children: [...(it.children || []), ...newKids] }
        : it),
    });
    // 自動展開該父項目
    setItemExpand(prev => ({ ...prev, [parentId]: true }));
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
        <div className="section-label">
          工作項目
          <span className="stage-pct-badge">{Math.round(stageProgress(stage) * 100)}%</span>
        </div>
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
          const hasChildren = (it.children?.length ?? 0) > 0;
          const expanded = isExpanded(it);
          const progress = childProgress(it);
          return (
            <React.Fragment key={it.id}>
            <div
              className={`item-bar status-${st} ${dragOverItemId === it.id ? 'reorder-target' : ''} ${hasChildren ? 'is-parent' : ''}`}
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
              <button
                className={`item-bar-toggle ${hasChildren ? 'has-children' : 'empty'}`}
                onClick={() => toggleExpand(it.id)}
                title={hasChildren ? (expanded ? '收起子細項' : `展開 ${it.children.length} 個子細項`) : '展開以加入子細項'}
                type="button"
              >
                {expanded ? '▾' : '▸'}
              </button>
              <div className="item-bar-actions-left">
                {it.link && <a href={it.link} target="_blank" rel="noopener noreferrer" className="item-bar-link" title={it.link}>↗</a>}
                <button className="item-bar-action" title={it.link ? '編輯連結' : '加入連結'} onClick={() => {
                  const v = prompt('貼上該項目的成果連結（留空可移除）：', it.link || '');
                  if (v === null) return;
                  onUpdate({ ...stage, items: stage.items.map(x => x.id === it.id ? { ...x, link: v.trim() || null } : x) });
                }}>
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M6 8a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5L7 3.5M8 6a2.5 2.5 0 0 0-3.5 0l-2 2a2.5 2.5 0 0 0 3.5 3.5L7 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                </button>
                <button className="item-bar-action item-preset-trigger" onClick={() => {
                  const items = stage.items.map(x => x.id === it.id ? { ...x, editing: 'select' } : x);
                  onUpdate({ ...stage, items });
                }} title="從預設項目選擇">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                {!isQtyItem(it) && !hasChildren && (
                  <button className="item-bar-action" onClick={() => convertToQty(it.id)} title="設為數量型（例如 100 卡，做一卡進度就前進一點）">#</button>
                )}
                <button className="item-bar-action danger" onClick={() => { if (confirm('確定刪除這個項目？')) remove(it.id); }} title="刪除">×</button>
              </div>
              {it.editing === 'select' ? (
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
                  </select>
                </div>
              ) : it.editing === 'input' ? (
                <input
                  autoFocus
                  type="text"
                  className="input item-bar-edit-input"
                  defaultValue={it.text}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.target.blur(); }
                    if (e.key === 'Escape') {
                      onUpdate({ ...stage, items: stage.items.map(x => x.id === it.id ? { ...x, editing: false } : x) });
                    }
                  }}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    onUpdate({
                      ...stage,
                      items: stage.items.map(x => x.id === it.id
                        ? { ...x, text: v || x.text, editing: false }
                        : x)
                    });
                  }}
                />
              ) : (
                <span
                  className="item-bar-text editable"
                  onClick={() => {
                    const items = stage.items.map(x => x.id === it.id ? { ...x, editing: 'input' } : x);
                    onUpdate({ ...stage, items });
                  }}
                  title="點一下直接編輯文字"
                >
                  {it.text}
                </span>
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
              {isQtyItem(it) ? (
                <div className={`qty-control status-${st}`} title="數量型：每完成一單位按一下 +，進度條會立刻往前">
                  <button type="button" className="qty-btn" onClick={() => setItemQty(it.id, { qtyDone: (Number(it.qtyDone) || 0) - 1 })} disabled={(Number(it.qtyDone) || 0) <= 0}>−</button>
                  <input type="number" className="qty-input" min="0" max={it.qtyTotal} value={Number(it.qtyDone) || 0}
                    onChange={e => setItemQty(it.id, { qtyDone: e.target.value })} />
                  <span className="qty-sep">/</span>
                  <button type="button" className="qty-total" onClick={() => convertToQty(it.id)} title="改總數">{it.qtyTotal}</button>
                  <button type="button" className="qty-btn" onClick={() => setItemQty(it.id, { qtyDone: (Number(it.qtyDone) || 0) + 1 })} disabled={(Number(it.qtyDone) || 0) >= it.qtyTotal}>+</button>
                  <span className="qty-pct">{Math.round(qtyRatio(it) * 100)}%</span>
                </div>
              ) : hasChildren ? (
                <span className={`item-bar-child-count status-${st}`} title={`${progress.done}/${progress.total} 已完成`}>
                  {progress.done}/{progress.total}
                </span>
              ) : (
                <ItemStatusDropdown value={st} onChange={(newSt) => setItemStatus(it.id, newSt)} />
              )}
            </div>
            {/* 展開時：子細項列表 + 加入子細項表單 + 一鍵生成系列 */}
            {expanded && (
              <div className="item-children-area">
                {(it.children || []).map(c => (
                  <ChildBar
                    key={c.id}
                    child={c}
                    onToggle={() => setItemStatus(c.id, ['done','confirmed'].includes(childStatus(c)) ? 'todo' : 'done')}
                    onRemove={() => remove(c.id)}
                    onUpdate={(patch) => {
                      onUpdate({
                        ...stage,
                        items: stage.items.map(x => x.id === it.id
                          ? { ...x, children: (x.children || []).map(ch => ch.id === c.id ? { ...ch, ...patch } : ch) }
                          : x)
                      });
                    }}
                  />
                ))}
                <div className="item-children-add">
                  <AddChildForm parentId={it.id} onAdd={addChildToParent} />
                  <PerItemSeriesForm parentId={it.id} onGenerate={generateSeriesForParent} />
                </div>
              </div>
            )}
            </React.Fragment>
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
        <AddQtyItemForm onAdd={addQtyItem} />
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

  // 超常發揮：這個階段比預定結束日早幾天完成（doneAt 由轉變偵測 effect 自動蓋章）
  const stageEarlyDays = (stage.doneAt && stage.end)
    ? daysBetween(new Date(stage.doneAt), new Date(stage.end)) : 0;

  const completeAll = () => {
    // 連同底下所有「子細項」一起標成完成——否則有子細項的大細項會因為子項沒打滿而卡在未完成，
    // 整個專案完成度就永遠湊不到 100%（97% bug 的根源）。
    const items = stage.items.map(it => ({
      ...it,
      status: 'done',
      done: true,
      // 數量型：直接填滿
      ...(isQtyItem(it) ? { qtyDone: it.qtyTotal } : {}),
      children: (it.children || []).map(c => ({ ...c, status: 'done', done: true })),
    }));
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
          {stageEarlyDays > 0 && (
            <span className="early-badge" title={`預定 ${fmtDate(new Date(stage.end))}，實際 ${fmtDate(new Date(stage.doneAt))} 完成`}>
              提前 {stageEarlyDays} 天完成
            </span>
          )}
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
                <button className="delete-item visible" onClick={() => { if (confirm('確定刪除這筆參考資料？')) rmRef(r.id); }} title="刪除">×</button>
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
// ---------- 實際工作區間（決策 28）----------
// 中間停工的案子可以填多段 {start, end}；最後一段 end 留空＝到交件日（含延期）為止。
// 沒填的案子＝原本的「起始 → 交件」一段。分攤公式不變，只是「數天數」時改用這些區間。
function hasWorkPeriods(p) {
  return Array.isArray(p && p.workPeriods) && p.workPeriods.some(w => w && w.start);
}
function getWorkPeriods(p) {
  const effEnd = (p && (p.extendedDue || p.due)) || '';
  if (!hasWorkPeriods(p)) return (p && p.start && effEnd) ? [{ start: p.start, end: effEnd }] : [];
  const list = p.workPeriods
    .filter(w => w && w.start)
    .map(w => ({ start: w.start, end: (w.end || effEnd) }))
    .filter(w => w.end && w.start <= w.end)
    .sort((a, b) => a.start.localeCompare(b.start));
  // 重疊的段合併，避免同一天算兩次
  const merged = [];
  for (const w of list) {
    const last = merged[merged.length - 1];
    if (last && w.start <= last.end) { if (w.end > last.end) last.end = w.end; }
    else merged.push({ ...w });
  }
  return merged;
}
// 這些區間在 [monthStart, monthEnd] 裡總共佔幾天（含頭尾）
function daysInMonthForPeriods(periods, monthStart, monthEnd) {
  let days = 0;
  for (const w of periods) {
    const ps = new Date(w.start); ps.setHours(0, 0, 0, 0);
    const pe = new Date(w.end);   pe.setHours(0, 0, 0, 0);
    if (isNaN(ps) || isNaN(pe)) continue;
    const segStart = ps > monthStart ? ps : monthStart;
    const segEnd   = pe < monthEnd   ? pe : monthEnd;
    if (segStart > segEnd) continue;
    days += Math.round((segEnd - segStart) / 86400000) + 1;
  }
  return days;
}
// 總工作天數（含頭尾）
function totalWorkDays(p) {
  return getWorkPeriods(p).reduce((a, w) => {
    const d = daysBetween(new Date(w.start), new Date(w.end));
    return a + (isNaN(d) ? 0 : Math.max(0, d) + 1);
  }, 0);
}

// 某個案子在「專案損益」的分攤固定成本是怎麼湊出來的：逐月列出（天數、當月同時在跑的案子、拿到多少）。
// 公式跟 computeFixedCostAllocations 完全相同，只是把加總的過程攤開；各月加總＝該案的分攤固定成本。
function computeProjectFixedByMonth(projects, monthlyFixedExpense, projectId) {
  const monthly = Number(monthlyFixedExpense) || 0;
  const valid = (projects || []).filter(p => !p.deleted && p.start && p.due);
  const target = valid.find(p => p.id === projectId);
  if (!target || monthly === 0) return [];
  const rows = [];
  for (const w of getWorkPeriods(target)) {
    const s = new Date(w.start), e = new Date(w.end);
    if (isNaN(s) || isNaN(e) || s > e) continue;
    const cursor = new Date(s.getFullYear(), s.getMonth(), 1);
    const stop = new Date(e.getFullYear(), e.getMonth(), 1);
    while (cursor <= stop) {
      const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
      if (!rows.find(r => r.key === key)) {
        const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1); monthStart.setHours(0, 0, 0, 0);
        const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0); monthEnd.setHours(0, 0, 0, 0);
        let totalDays = 0, myDays = 0; const others = [];
        for (const p of valid) {
          const d = daysInMonthForPeriods(getWorkPeriods(p), monthStart, monthEnd);
          if (d <= 0) continue;
          totalDays += d;
          if (p.id === projectId) myDays = d; else others.push({ title: p.title, days: d });
        }
        if (myDays > 0) rows.push({
          key, label: `${cursor.getFullYear()}/${cursor.getMonth() + 1}`,
          days: myDays, totalDays, others,
          amount: monthly * myDays / totalDays,
          daysInMonth: monthEnd.getDate(),
        });
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }
  return rows;
}

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
    for (const w of getWorkPeriods(p)) {   // 沒填實際區間＝起始→交件一段，跟以前一樣
      const s = new Date(w.start);
      const e = new Date(w.end);
      if (isNaN(s) || isNaN(e) || s > e) continue;
      const cursor = new Date(s.getFullYear(), s.getMonth(), 1);
      const stop = new Date(e.getFullYear(), e.getMonth(), 1);
      while (cursor <= stop) {
        monthSet.add(`${cursor.getFullYear()}-${cursor.getMonth()}`);
        cursor.setMonth(cursor.getMonth() + 1);
      }
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
      const days = daysInMonthForPeriods(getWorkPeriods(p), monthStart, monthEnd); // 含頭尾；沒填區間＝起始→交件
      if (days <= 0) continue; // no overlap with this month
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

// 逐月固定成本分攤明細（現金流版）：
// 用付款日決定資金何時到位。到月底為止累計收到的款項 − 外包 = 可付房租的錢。
// 款項還沒進來的案子不能付房租。上月缺口會遞延，新款項進來時先付本月、再補舊洞。
// 案子結束後餘額繼續扣到花完為止。
// ⚠ 這張表是「現金版」，跟「專案損益」的天數比例分攤是兩套刻意不同的規則（使用者 2026-09-08 確認要這套）。
//   收款時間：已收 → 實際入帳日；未收 → 表定收款日（不推到明天，否則沒標記已收的案子會被當成沒錢付房租）。
//   外包：只扣到月底為止「已付（實付日）或表定要付（預估付款日）」的，還沒付的錢還在戶頭裡。
function computeMonthlyFixedBreakdown(projects, monthlyFixedExpense) {
  var monthly = Number(monthlyFixedExpense) || 0;
  var valid = (projects || []).filter(function(p) { return !p.deleted && p.start && p.due; });
  if (monthly === 0 || valid.length === 0) return [];

  // 每案的付款時程 + 外包總額
  var paymentSchedules = {};
  var outsourceMap = {};
  for (var i = 0; i < valid.length; i++) {
    var p = valid[i];
    var budget = Number(p.budget) || 0;
    var payments = getPayments(p);
    var schedule = [];
    for (var pi = 0; pi < payments.length; pi++) {
      var pay = payments[pi];
      if (!pay.dueDate) continue;
      var amount = budget * (Number(pay.percentage) || 0) / 100;
      // 已收就用實際入帳日（使用者在專案裡標的），沒收到才用表定日
      var d = new Date((isPaymentReceived(pay) && pay.receivedDate) ? pay.receivedDate : pay.dueDate); d.setHours(0, 0, 0, 0);
      schedule.push({ date: d, amount: amount, label: pay.label, percentage: Number(pay.percentage) || 0 });
    }
    schedule.sort(function(a, b) { return a.date - b.date; });
    paymentSchedules[p.id] = schedule;
    // 外包：已付 → 實付日；未付 → 預估付款日（尾款後 5 天）；完全沒日期的保守當作一開始就扣
    var outs = [];
    (p.outsources || []).forEach(function(o) {
      var amt = Number(o.amount) || 0; if (amt === 0) return;
      var ds = isOutsourcePaid(o) ? (o.paidDate || '') : getOutsourcePayDate(p);
      var od = ds ? new Date(ds) : null; if (od) od.setHours(0, 0, 0, 0);
      outs.push({ date: (od && !isNaN(od)) ? od : null, amount: amt });
    });
    outsourceMap[p.id] = outs;
  }

  // 到某月底為止，案子累計收到多少錢 − 外包 = 可用資金上限
  function cumulativeMarginByMonth(projId, monthEnd) {
    var schedule = paymentSchedules[projId] || [];
    var received = 0;
    for (var i = 0; i < schedule.length; i++) {
      if (schedule[i].date <= monthEnd) received += schedule[i].amount;
    }
    // 只扣「到月底為止已經（或表定要）付出去」的外包，還沒付的錢還在戶頭裡可以付房租
    var paidOut = 0;
    var outs = outsourceMap[projId] || [];
    for (var k = 0; k < outs.length; k++) {
      if (outs[k].date === null || outs[k].date <= monthEnd) paidOut += outs[k].amount;
    }
    return Math.max(0, received - paidOut);
  }

  // 取得到某月底已收到哪些款項的標示文字
  function getPaymentInfo(projId, monthEnd) {
    var schedule = paymentSchedules[projId] || [];
    var parts = [];
    for (var i = 0; i < schedule.length; i++) {
      if (schedule[i].date <= monthEnd) {
        var d = schedule[i].date;
        var dateStr = (d.getMonth() + 1) + '/' + d.getDate();
        parts.push(schedule[i].percentage + '% ' + schedule[i].label + ' (' + dateStr + ')');
      }
    }
    return parts.length > 0 ? '已收 ' + parts.join(' + ') : '';
  }

  var absorbed = {};
  for (var i = 0; i < valid.length; i++) absorbed[valid[i].id] = 0;

  // 收集專案涵蓋的月份
  var monthSet = new Set();
  for (var i = 0; i < valid.length; i++) {
    var p = valid[i];
    var periodsOfP = getWorkPeriods(p);   // 沒填實際區間＝起始→交件一段（決策 28）
    for (var wi = 0; wi < periodsOfP.length; wi++) {
      var s = new Date(periodsOfP[wi].start);
      var e = new Date(periodsOfP[wi].end);
      if (isNaN(s) || isNaN(e) || s > e) continue;
      var cursor = new Date(s.getFullYear(), s.getMonth(), 1);
      var stop = new Date(e.getFullYear(), e.getMonth(), 1);
      while (cursor <= stop) {
        monthSet.add(cursor.getFullYear() + '-' + cursor.getMonth());
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }
  }

  var sortedKeys = Array.from(monthSet).sort(function(a, b) {
    var pa = a.split('-'), pb = b.split('-');
    return (Number(pa[0]) - Number(pb[0])) || (Number(pa[1]) - Number(pb[1]));
  });

  var result = [];
  var ki = 0;
  var safetyLimit = 36;
  var accumulatedDeficit = 0;

  while (safetyLimit-- > 0) {
    var year, month, key;

    if (ki < sortedKeys.length) {
      key = sortedKeys[ki];
      var parts = key.split('-');
      year = Number(parts[0]);
      month = Number(parts[1]);
      ki++;
    } else {
      var anyLeft = false;
      for (var j = 0; j < valid.length; j++) {
        var totalMargin = cumulativeMarginByMonth(valid[j].id, new Date(9999, 0));
        if (totalMargin - absorbed[valid[j].id] > 1) { anyLeft = true; break; }
      }
      if (!anyLeft) break;
      var last = result[result.length - 1];
      year = last.year;
      month = last.month + 1;
      if (month > 11) { month = 0; year++; }
      key = year + '-' + month;
    }

    var monthStart = new Date(year, month, 1); monthStart.setHours(0, 0, 0, 0);
    var monthEnd = new Date(year, month + 1, 0); monthEnd.setHours(0, 0, 0, 0);
    var carryIn = accumulatedDeficit;
    var sharesMap = {};

    // ── 第一步：付本月房租 ──
    var uncoveredCurrent = monthly;
    var totalDays = 0;
    var activeCandidates = [];
    for (var j = 0; j < valid.length; j++) {
      var proj = valid[j];
      var availableMargin = cumulativeMarginByMonth(proj.id, monthEnd);
      var rem = availableMargin - absorbed[proj.id];
      if (rem <= 0) continue;
      var days = daysInMonthForPeriods(getWorkPeriods(proj), monthStart, monthEnd); // 含頭尾；沒填區間＝起始→交件（決策 28）
      if (days <= 0) continue;
      activeCandidates.push({ id: proj.id, title: proj.title, days: days });
      totalDays += days;
    }
    if (totalDays > 0) {
      for (var ci = 0; ci < activeCandidates.length; ci++) {
        var c = activeCandidates[ci];
        var availableMargin = cumulativeMarginByMonth(c.id, monthEnd);
        var rem = availableMargin - absorbed[c.id];
        var proportional = monthly * c.days / totalDays;
        var capped = Math.min(proportional, rem);
        sharesMap[c.id] = { id: c.id, title: c.title, days: c.days, current: capped, backfill: 0, paymentInfo: getPaymentInfo(c.id, monthEnd) };
        absorbed[c.id] += capped;
        uncoveredCurrent -= capped;
      }
    }
    // 本月沒人扛的部分，找有餘額的案子補
    var maxIter = 10;
    while (uncoveredCurrent > 1 && maxIter-- > 0) {
      var fillers = [];
      var totalRem = 0;
      for (var j = 0; j < valid.length; j++) {
        var proj = valid[j];
        var availableMargin = cumulativeMarginByMonth(proj.id, monthEnd);
        var rem = availableMargin - absorbed[proj.id];
        if (rem <= 0) continue;
        fillers.push({ id: proj.id, title: proj.title, remaining: rem });
        totalRem += rem;
      }
      if (fillers.length === 0 || totalRem < 1) break;
      var filled = 0;
      for (var fi = 0; fi < fillers.length; fi++) {
        var f = fillers[fi];
        var share = uncoveredCurrent * f.remaining / totalRem;
        var capped = Math.min(share, f.remaining);
        if (sharesMap[f.id]) {
          sharesMap[f.id].current += capped;
        } else {
          sharesMap[f.id] = { id: f.id, title: f.title, days: 0, current: capped, backfill: 0, paymentInfo: getPaymentInfo(f.id, monthEnd) };
        }
        absorbed[f.id] += capped;
        filled += capped;
      }
      uncoveredCurrent -= filled;
    }

    // ── 第二步：補上月累計缺口 ──
    var uncoveredBackfill = accumulatedDeficit;
    if (uncoveredBackfill > 1) {
      var maxIter2 = 10;
      while (uncoveredBackfill > 1 && maxIter2-- > 0) {
        var fillers2 = [];
        var totalRem2 = 0;
        for (var j = 0; j < valid.length; j++) {
          var proj = valid[j];
          var availableMargin = cumulativeMarginByMonth(proj.id, monthEnd);
          var rem = availableMargin - absorbed[proj.id];
          if (rem <= 0) continue;
          fillers2.push({ id: proj.id, title: proj.title, remaining: rem });
          totalRem2 += rem;
        }
        if (fillers2.length === 0 || totalRem2 < 1) break;
        var filled2 = 0;
        for (var fi = 0; fi < fillers2.length; fi++) {
          var f = fillers2[fi];
          var share = uncoveredBackfill * f.remaining / totalRem2;
          var capped = Math.min(share, f.remaining);
          if (sharesMap[f.id]) {
            sharesMap[f.id].backfill += capped;
          } else {
            sharesMap[f.id] = { id: f.id, title: f.title, days: 0, current: 0, backfill: capped, paymentInfo: getPaymentInfo(f.id, monthEnd) };
          }
          absorbed[f.id] += capped;
          filled2 += capped;
        }
        uncoveredBackfill -= filled2;
      }
    }

    // ── 組裝結果 ──
    var sharesArr = [];
    for (var sid in sharesMap) {
      var s = sharesMap[sid];
      s.amount = s.current + s.backfill;
      if (s.amount > 0) sharesArr.push(s);
    }

    var currentDeficit = uncoveredCurrent > 1 ? uncoveredCurrent : 0;
    var remainingBackfill = uncoveredBackfill > 1 ? uncoveredBackfill : 0;
    accumulatedDeficit = currentDeficit + remainingBackfill;

    var label = year + ' 年 ' + (month + 1) + ' 月';
    result.push({
      key: key, year: year, month: month, label: label, total: monthly,
      carryIn: carryIn > 1 ? Math.round(carryIn) : 0,
      projects: sharesArr,
      deficit: currentDeficit > 1 ? Math.round(currentDeficit) : 0,
      carryOut: accumulatedDeficit > 1 ? Math.round(accumulatedDeficit) : 0
    });

    if (sharesArr.length === 0 && ki >= sortedKeys.length) break;
  }

  return result;
}

// 延期佔用費（差額法）：比較「有延期」vs「沒延期」的分攤結果，差額就是延期造成的額外成本。
// 不會重複收費、帳永遠對得上。沒有任何案延期時回傳空物件。

// 延期佔用費（差額法）：比較「有延期」vs「沒延期」的分攤結果，差額就是延期造成的額外成本。
// 不會重複收費、帳永遠對得上。沒有任何案延期時回傳空物件。
function computeOvertimeAllocations(projects, monthlyFixedExpense) {
  const monthly = Number(monthlyFixedExpense) || 0;
  if (monthly === 0) return {};
  const hasAny = (projects || []).some(p => p.extendedDue && new Date(p.extendedDue) > new Date(p.due));
  if (!hasAny) return {};
  // 真實分攤（用 extendedDue || due，已在 computeFixedCostAllocations 裡）
  const real = computeFixedCostAllocations(projects, monthly);
  // 假設全部沒延期的分攤
  var stripped = projects.map(function(p) { return p.extendedDue ? Object.assign({}, p, { extendedDue: '' }) : p; });
  const hypo = computeFixedCostAllocations(stripped, monthly);
  var segmented = {};
  (projects || []).forEach(function(p) { if (hasWorkPeriods(p)) segmented[p.id] = true; });
  var out = {};
  for (var id in real) {
    // 填了實際工作區間的案子：真實區間已經講明，沒有「原定 vs 延期」的差額概念
    out[id] = segmented[id] ? 0 : Math.max(0, (real[id] || 0) - (hypo[id] || 0));
  }
  return out;
}

// ---------- Cost Panel ----------
// fixedCostOverride: optional. When given (from computeFixedCostAllocations), use
// it as the project's allocated fixed cost. When omitted, fall back to the
// legacy per-project fixedMonthly * months calc (for projects that pre-date the
// global setting).
function calcCosts(project, fixedCostOverride, monthlyFixedExpenseGlobal, overtimeOverride) {
  const start = project.start ? new Date(project.start) : null;
  const effDue = new Date(project.extendedDue || project.due || '');
  const isSegmented = hasWorkPeriods(project);
  const workSegments = isSegmented ? getWorkPeriods(project).length : 1;
  const days = isSegmented
    ? Math.max(1, totalWorkDays(project))
    : ((start && !isNaN(start) && !isNaN(effDue)) ? Math.max(1, daysBetween(start, effDue)) : 0);
  const months = days / 30;

  let totalFixedAlloc;
  if (typeof fixedCostOverride === 'number') {
    totalFixedAlloc = fixedCostOverride;
  } else {
    const fallbackMonthly = (typeof monthlyFixedExpenseGlobal === 'number' && monthlyFixedExpenseGlobal > 0)
      ? monthlyFixedExpenseGlobal
      : (project.fixedMonthly || 0);
    totalFixedAlloc = fallbackMonthly * months;
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
  const overtimeFixed = typeof overtimeOverride === 'number' ? Math.max(0, overtimeOverride) : 0;
  const baseFixedCost = totalFixedAlloc - overtimeFixed;
  const fixedCost = totalFixedAlloc;
  const profit = budget - fixedCost - outsourceTotal - netVAT;

  return { days, months, fixedCost, baseFixedCost, overtimeFixed, outsourceTotal, companyOutsource, personalOutsource, salesVAT, creditableInputTax, netVAT, profit, preTax, isOverseas, isSegmented, workSegments };
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
      // 已收 → 實際入帳日；未收 → 預計日（逾期未收則推到今天，錢還沒進來就不能算進餘額）
      const effStr = getPaymentEffectiveDate(pay);
      if (!effStr) continue;
      const d = new Date(effStr);
      if (isNaN(d) || d < start || d > end) continue;
      const amt = budget * (Number(pay.percentage) || 0) / 100;
      if (amt === 0) continue;
      const received = isPaymentReceived(pay);
      const overdue = !received && pay.dueDate && new Date(pay.dueDate) < TODAY;
      events.push({
        date: d,
        amount: amt,
        label: `${p.title} · ${pay.label}${received ? '（已收）' : overdue ? '（逾期未收）' : '（預估）'}`,
        kind: received ? 'income-received' : 'income',
      });
    }
    // 外包付款：每筆獨立成事件。已付用 paidDate（kind='outsource-paid'），未付用 outsourcePayDate（kind='outsource'）
    for (const o of (p.outsources || [])) {
      const amt = Number(o.amount) || 0;
      if (amt === 0) continue;
      const paid = isOutsourcePaid(o);
      const dateStr = getOutsourceEffectivePayDate(p, o);
      if (!dateStr) continue;
      const d = new Date(dateStr);
      if (isNaN(d) || d < start || d > end) continue;
      const roleLabel = o.name || '外包';
      events.push({
        date: d,
        amount: -amt,
        label: paid ? `${p.title} · ${roleLabel}（已付）` : `${p.title} · ${roleLabel}（預估）`,
        kind: paid ? 'outsource-paid' : 'outsource',
      });
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
    // 進項稅扣抵：每筆 taxable outsource 用「實際入帳日」決定稅期（已付用 paidDate，未付用 outsourcePayDate）
    for (const o of (p.outsources || [])) {
      if (!o.taxable) continue;
      const amt = Number(o.amount) || 0;
      if (amt <= 0) continue;
      const dateStr = isOutsourcePaid(o) ? (o.paidDate || '') : getOutsourcePayDate(p);
      if (!dateStr) continue;
      const d = new Date(dateStr);
      if (isNaN(d)) continue;
      const info = vatPeriodInfo(d);
      if (info) ensureVatPeriod(info).inputVAT += amt * 0.05;
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
        date: (isPaymentReceived(pay) && pay.receivedDate) ? pay.receivedDate : pay.dueDate,
        received: isPaymentReceived(pay),
        kind: 'payment-in',
        projectId: p.id,
        projectTitle: p.title,
        label: pay.label,
        amount: budget * (Number(pay.percentage) || 0) / 100,
        paymentId: pay.id,
      });
    }

    // Outsource payments (outgoing money) — paid status aware
    // 未付的外包合併成一個事件（共用 outsourcePayDate）；已付的每筆獨立事件（落在各自的 paidDate）
    const unpaidOutsources = (p.outsources || []).filter(o => !isOutsourcePaid(o));
    const unpaidTotal = unpaidOutsources.reduce((a, o) => a + (Number(o.amount) || 0), 0);
    const outDate = getOutsourcePayDate(p);
    if (outDate && unpaidTotal > 0) {
      events.push({
        date: outDate,
        kind: 'payment-out',
        projectId: p.id,
        projectTitle: p.title,
        label: unpaidOutsources.length > 1 ? `外包付款（預估，${unpaidOutsources.length} 筆）` : '外包付款（預估）',
        amount: unpaidTotal,
      });
    }
    // 已付的外包：每筆一個事件
    for (const o of (p.outsources || [])) {
      if (!isOutsourcePaid(o)) continue;
      const amt = Number(o.amount) || 0;
      if (amt === 0 || !o.paidDate) continue;
      events.push({
        date: o.paidDate,
        kind: 'payment-out-paid',
        projectId: p.id,
        projectTitle: p.title,
        outsourceId: o.id,
        label: (o.name || '外包') + '（已付）',
        amount: amt,
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
        // 已收的款項拖動改的是「實際入帳日」；未收的才是改預計日
        payments: getPayments(project).map(p => p.id !== paymentId ? p
          : isPaymentReceived(p) ? { ...p, receivedDate: newDate } : { ...p, dueDate: newDate }),
      };
    case 'payment-out':
      // 未付合併事件 → 改 outsourcePayDate（所有未付的外包跟著移動）
      return { outsourcePayDate: newDate };
    case 'payment-out-paid':
      // 已付單筆 → 改該筆的 paidDate
      return {
        outsources: (project.outsources || []).map(o =>
          o.id === eventInfo.outsourceId ? { ...o, paidDate: newDate } : o
        ),
      };
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
  const overtimeAlloc = computeOvertimeAllocations(allProjects, monthlyFixed);

  const projectToExport = (p) => {
    const c = calcCosts(p, allocations[p.id], monthlyFixed, overtimeAlloc[p.id]);
    const payments = getPayments(p);
    const pct = projectPct(p);
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
        "已收": isPaymentReceived(pay),
        "實際入帳日": isPaymentReceived(pay) ? (pay.receivedDate || null) : null,
      })),
      "收款狀態": { none: '未收款', partial: '部分收款', full: '已收齊' }[getBillingStatus(p)],
      "實際交件日": p.deliveredAt || null,
      "外包預估付款日": getOutsourcePayDate(p) || null,
      "外包明細": (p.outsources || []).map(o => ({
        "項目": o.name || '(未命名)',
        "類型": o.type === 'company' ? '公司' : '個人',
        "金額": Number(o.amount) || 0,
        "可抵稅": !!o.taxable,
        "已付": isOutsourcePaid(o),
        "實付日": isOutsourcePaid(o) ? (o.paidDate || null) : null,
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
        "類型": pt.kind === 'income-received' ? '收入（已收）'
              : pt.kind === 'income' ? '收入（預估）'
              : pt.kind === 'fixed' ? '每月固定支出'
              : pt.kind === 'outsource' ? '外包付款（預估）'
              : pt.kind === 'outsource-paid' ? '外包付款（已付）'
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
  const activeProfitTotal = active.reduce((a, p) => a + calcCosts(p, allocations[p.id], monthlyFixed, overtimeAlloc[p.id]).profit, 0);
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
    const oldFinal = getFinalPayment(payments);
    if (oldFinal && oldFinal.id === id && oldFinal.dueDate && dueDate) {
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

  // 標記「已收到」：第一次打勾預設入帳日＝今天，可再改
  const setReceived = (id, received) => {
    const next = payments.map(p => p.id === id
      ? { ...p, received: received, receivedDate: received ? (p.receivedDate || defaultActualDate(p.dueDate)) : null }
      : p);
    onUpdate({ ...project, payments: next });
  };
  const setReceivedDate = (id, receivedDate) => {
    const next = payments.map(p => p.id === id ? { ...p, receivedDate } : p);
    onUpdate({ ...project, payments: next });
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

  // 追加款項（合約追加）
  const [addOpen, setAddOpen] = useState(false);
  const [addAmt, setAddAmt] = useState('');
  const [addDue, setAddDue] = useState('');
  const submitAddition = () => {
    const patch = applyBudgetAddition(project, addAmt, addDue);
    if (!patch) { alert('追加金額要大於 0。'); return; }
    onUpdate({ ...project, ...patch });
    setAddOpen(false); setAddAmt(''); setAddDue('');
  };

  const outsourcePayDate = getOutsourcePayDate(project);
  const hasOutsources = (project.outsources || []).length > 0;
  const finalPay = getFinalPayment(payments);
  const outsourceOffset = (outsourcePayDate && finalPay?.dueDate)
    ? daysBetween(new Date(finalPay.dueDate), new Date(outsourcePayDate))
    : null;

  return (
    <div className="cost-section">
      <div className="cost-section-h">
        <div className="cost-block-h">
          <span>收款排程</span>
          <span className="ghost-pill">合計 {Math.round(totalPct * 10) / 10}%</span>
          {getAddedBudget(project) > 0 && (
            <span className="ghost-pill addition">原 {fmtNT(project.baseBudget)} ＋ 追加 {fmtNT(getAddedBudget(project))}</span>
          )}
        </div>
        <button type="button" className="btn btn-ghost small" onClick={() => setAddOpen(o => !o)} title="客戶同意追加費用：合約金額加上去、原本款項金額不變、多一列追加款">
          {addOpen ? '取消追加' : '+ 追加款項'}
        </button>
      </div>
      {addOpen && (
        <div className="addition-form">
          <span className="addition-label">追加金額（含稅）</span>
          <MoneyInput value={addAmt} onChange={setAddAmt} />
          <span className="addition-label">預計收款日</span>
          <input type="date" className="date-input compact" value={addDue} onChange={e => setAddDue(e.target.value)} />
          <button type="button" className="btn btn-primary small" onClick={submitAddition}>確認追加</button>
          <div className="field-hint">合約金額會加上這筆；原本頭款、尾款的<strong>金額不變</strong>（百分比自動重算）；現金流、應收、損益、成本分攤全部跟著更新。</div>
        </div>
      )}

      <div className="payment-list">
        <div className="payment-row head">
          <div>款項</div>
          <div className="center">比例</div>
          <div>預計收款日</div>
          <div className="right">金額（含稅）</div>
          <div>已收</div>
          <div></div>
        </div>
        {payments.map(p => (
          <div key={p.id} className={`payment-row ${isPaymentReceived(p) ? 'is-received' : ''} ${p.addition ? 'is-addition' : ''}`}>
            <div className="payment-label">{p.label}{p.addition && <span className="addition-tag" title={`${p.addedAt} 追加 ${fmtNT(p.addedAmount)}`}>追加</span>}</div>
            <div className="pct-input-wrap">
              <input type="number" className="num-input pct-input"
                min="0" max="100" step="0.5"
                value={Math.round((Number(p.percentage) || 0) * 10) / 10}
                onChange={e => setPercentage(p.id, e.target.value)} />
              <span className="pct-sign">%</span>
            </div>
            <input type="date" className="date-input compact"
              value={p.dueDate || ''}
              onChange={e => setDate(p.id, e.target.value)} />
            <div className="num-val right">{fmtNT(budget * (Number(p.percentage) || 0) / 100)}</div>
            <div className="received-cell">
              <div className={`check-box ${isPaymentReceived(p) ? 'checked' : ''}`}
                onClick={() => setReceived(p.id, !isPaymentReceived(p))}
                title={isPaymentReceived(p) ? '已收到，點一下取消' : '錢進來了？點一下標記已收'}>
              </div>
              {isPaymentReceived(p) && (
                <input type="date" className="date-input compact received-date"
                  value={p.receivedDate || ''}
                  onChange={e => setReceivedDate(p.id, e.target.value)}
                  title="實際入帳日" />
              )}
            </div>
            {payments.length > 1 ? (
              <button className="delete-item visible" onClick={() => { if (confirm('確定刪除這筆款項？剩餘的會自動補到 100%。')) deletePayment(p.id); }} title="刪除這筆款項（剩餘的會自動補到 100%）">×</button>
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
            {outsourceOffset !== 5 && finalPay?.dueDate && (
              <>
                {' '}
                <button
                  className="link-btn-inline"
                  onClick={() => setOutsourcePayDate(addDays(finalPay.dueDate, 5))}
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

function CostPanel({ project, onUpdate, fixedCostShare, overtimeShare, monthlyFixedExpense, onOpenCashSettings, outsourceRoles, customOutsourceRoles, onUpdateCustomOutsourceRoles, onOpenFullFinance, presentation }) {
  // 外包區可收折：收起時連外包總額一起藏（給客戶看時用）；簡報模式預設收起
  const [outOpen, setOutOpen] = useState(!presentation);
  useEffect(() => { setOutOpen(!presentation); }, [presentation]);
  const c = useMemo(
    () => calcCosts(project, fixedCostShare, monthlyFixedExpense, overtimeShare),
    [project, fixedCostShare, overtimeShare, monthlyFixedExpense]
  );
  const update = (patch) => onUpdate({ ...project, ...patch });
  const [detailsOpen, setDetailsOpen] = useState(true);

  const addOutsource = () => {
    update({ outsources: [...(project.outsources || []), { id: uid('o'), name: '', type: 'company', amount: 0, taxable: true, paid: false, paidDate: null }] });
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

  // 這個面板只放「跟這個案子直接相關、可以給客戶看」的數字：合約、外包、收款。
  // 固定成本分攤、稅務、淨利屬於公司內部財務，統一在「財務 → 專案損益」看。
  const billing = getBillingStatus(project);
  const receivedAmt = getReceivedAmount(project);
  const profitPct = project.budget ? Math.round((c.profit / project.budget) * 100) : 0;

  return (
    <div className="cost-panel">
      <div className="cost-header">
        <div>
          <div className="detail-eyebrow">{project.title} · 合約與外包</div>
          <h3 className="detail-title">收付款</h3>
          {onOpenFullFinance && (
            <button className="btn btn-ghost small full-finance-btn" onClick={() => onOpenFullFinance(project.id)} title="到財務頁看這個案子的完整計算（固定成本分攤、稅務、淨利）">
              完整損益 →
            </button>
          )}
        </div>
        <div className="cost-summary">
          <div className="summary-item">
            <div className="summary-label">合約金額（含稅）</div>
            <div className="summary-value">{fmtNT(project.budget)}</div>
            {getAddedBudget(project) > 0 && <div className="summary-sub">原 {fmtNT(project.baseBudget)} ＋ 追加 {fmtNT(getAddedBudget(project))}</div>}
          </div>
          {outOpen && (
            <div className="summary-item">
              <div className="summary-label">外包費用</div>
              <div className="summary-value">{fmtNT(c.outsourceTotal)}</div>
            </div>
          )}
          <div className={`summary-item ${billing === 'full' ? 'profit' : ''}`}>
            <div className="summary-label">已收款</div>
            <div className="summary-value">
              {fmtNT(receivedAmt)}
              <span className="pct">{project.budget ? Math.round(receivedAmt / project.budget * 100) : 0}%</span>
            </div>
          </div>
          {/* 一眼看到賺或賠：賺＝大綠字 %，賠＝大紅字負金額（分攤明細在財務頁） */}
          <div className={`summary-item big-pnl ${c.profit < 0 ? 'loss' : 'gain'}`} title="淨利 = 合約 − 外包 − 分攤固定成本 − 營業稅。完整計算按「完整損益 →」">
            <div className="summary-label">{c.profit < 0 ? '虧損' : '利潤'}</div>
            <div className="summary-value big">
              {c.profit < 0 ? `−${fmtNT(Math.abs(c.profit))}` : `${profitPct}%`}
            </div>
            <div className="summary-sub">{c.profit < 0 ? `${profitPct}%` : fmtNT(c.profit)}</div>
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
      <div className="cost-type-row">
        <span className="cost-type-label">案件類型</span>
        <div className="type-toggle">
          <button className={!project.overseas ? 'on' : ''} onClick={() => update({ overseas: false })}>國內案</button>
          <button className={project.overseas ? 'on' : ''} onClick={() => update({ overseas: true })}>國外案</button>
        </div>
        <span className="cost-type-hint">{project.overseas ? '國外案免營業稅' : '含稅價，稅務明細在「財務 → 專案損益」'}</span>
      </div>

      {/* Payment schedule (cash in) */}
      <PaymentSchedule project={project} onUpdate={onUpdate} />

      {/* Outsource list */}
      <div className={`cost-section outsource-section ${outOpen ? '' : 'collapsed'}`}>
        <div className="cost-section-h">
          <button type="button" className="cost-block-h collapsible-h" onClick={() => setOutOpen(o => !o)} title={outOpen ? '收起外包明細（連金額一起藏）' : '展開外包明細'}>
            <span className="chevron">{outOpen ? '▾' : '▸'}</span>
            <span>外包支出</span>
            {outOpen ? (
              <>
                <span className="ghost-pill">公司 {fmtNT(c.companyOutsource)}</span>
                <span className="ghost-pill">個人 {fmtNT(c.personalOutsource)}</span>
              </>
            ) : (
              <span className="ghost-pill muted">已收起</span>
            )}
          </button>
          {outOpen && (
            <div style={{ display: 'flex', gap: 6 }}>
              {onUpdateCustomOutsourceRoles && (
                <button className="btn btn-ghost small" onClick={addCustomRole}>+ 新增角色</button>
              )}
              <button className="btn btn-ghost small" onClick={addOutsource}>+ 新增外包項目</button>
            </div>
          )}
        </div>

        {outOpen && (
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
                <button className="delete-item visible" onClick={() => { if (confirm('確定刪除這筆外包？')) removeOutsource(o.id); }} title="刪除">×</button>
              </div>
            );
          })}
        </div>
        )}
      </div>
      </>)}
    </div>
  );
}

// ---------- 單案財務（完整版）----------
// 這就是原本專案卡片「$」面板的完整內容，一字不減地搬到財務頁：
// 可編輯的（外包、收款日、國內外、起始日）照樣可編輯。卡片上的面板改為精簡版給客戶看。
function ProjectFinanceDetail({ project, onUpdate, fixedCostShare, overtimeShare, monthlyFixedExpense, onOpenCashSettings, outsourceRoles, customOutsourceRoles, onUpdateCustomOutsourceRoles, allProjects }) {
  const [fixedDetailOpen, setFixedDetailOpen] = useState(false);
  const fixedByMonth = useMemo(
    () => (allProjects ? computeProjectFixedByMonth(allProjects, monthlyFixedExpense, project.id) : []),
    [allProjects, monthlyFixedExpense, project.id, project.workPeriods, project.start, project.due, project.extendedDue]
  );
  const c = useMemo(
    () => calcCosts(project, fixedCostShare, monthlyFixedExpense, overtimeShare),
    [project, fixedCostShare, overtimeShare, monthlyFixedExpense]
  );
  const update = (patch) => onUpdate({ ...project, ...patch });

  const addOutsource = () => {
    update({ outsources: [...(project.outsources || []), { id: uid('o'), name: '', type: 'company', amount: 0, taxable: true, paid: false, paidDate: null }] });
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
    if ((outsourceRoles || []).includes(name)) { alert(`角色「${name}」已經存在。`); return; }
    onUpdateCustomOutsourceRoles && onUpdateCustomOutsourceRoles([...(customOutsourceRoles || []), name]);
  };

  const profitPct = project.budget ? Math.round((c.profit / project.budget) * 100) : 0;
  const extDays = (project.extendedDue && project.due && new Date(project.extendedDue) > new Date(project.due))
    ? daysBetween(new Date(project.due), new Date(project.extendedDue)) : 0;

  return (
    <div className="cost-panel finance-detail">
      <div className="cost-header">
        <div>
          <div className="detail-eyebrow">{project.title} · {project.client}</div>
          <h3 className="detail-title">財務概覽</h3>
        </div>
        <div className="cost-summary">
          <div className="summary-item">
            <div className="summary-label">合約金額（含稅）</div>
            <div className="summary-value">{fmtNT(project.budget)}</div>
            {getAddedBudget(project) > 0 && <div className="summary-sub">原 {fmtNT(project.baseBudget)} ＋ 追加 {fmtNT(getAddedBudget(project))}</div>}
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
          <div className="cost-block-h"><span>公司固定成本</span></div>
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
            <input type="date" className="date-input compact" value={project.start || ''} onChange={e => update({ start: e.target.value })} />
          </div>
          <div className="cost-row-line">
            <span>{c.isSegmented ? '實際工作天數' : '跨期天數'}</span>
            <span className="num-val">{c.days} 天 ({c.months.toFixed(1)} 月){c.isSegmented ? `・${c.workSegments} 段` : ''}</span>
          </div>
          {c.isSegmented && (
            <div className="cost-row-line">
              <span>工作區間</span>
              <span className="num-val muted">{getWorkPeriods(project).map(w => `${fmtDate(new Date(w.start))}–${w.end === (project.extendedDue || project.due) && !(project.workPeriods || []).find(x => x.start === w.start && x.end) ? '進行中' : fmtDate(new Date(w.end))}`).join('、')}</span>
            </div>
          )}
          <div className="cost-row-line emphasis">
            <span>{c.overtimeFixed > 0 ? '分攤固定成本（原訂期間）' : '實際分攤固定成本'}</span>
            <span className="num-val">{fmtNT(c.baseFixedCost)}</span>
          </div>
          {c.overtimeFixed > 0 && (
            <div className="cost-row-line emphasis overtime">
              <span>延期佔用費（加時 {extDays} 天）</span>
              <span className="num-val">＋{fmtNT(c.overtimeFixed)}</span>
            </div>
          )}
          {c.overtimeFixed > 0 && (
            <div className="cost-row-line emphasis total-fixed">
              <span>固定成本合計</span>
              <span className="num-val">{fmtNT(c.fixedCost)}</span>
            </div>
          )}
          <div className="cost-row-hint">
            按月分攤：當月固定支出由當月活躍的所有專案，依各案在當月的天數比例分擔。當月只有一案時，該案吸收當月全額。
            {c.overtimeFixed > 0 && <><br/>此案已延期：原訂交件後多佔用的時間，按實際逾期天數以全額月費率單獨向本案收取，<strong>不影響其他案的分攤</strong>。</>}
          </div>
          {fixedByMonth.length > 0 && (
            <div className="fixed-by-month">
              <button type="button" className="link-btn-inline" onClick={() => setFixedDetailOpen(o => !o)}>
                {fixedDetailOpen ? '▾ 收起逐月明細' : '▸ 這個數字怎麼來的（逐月明細）'}
              </button>
              {fixedDetailOpen && (
                <div className="fbm-list">
                  {fixedByMonth.map(r => (
                    <div key={r.key} className={`fbm-row ${r.others.length === 0 ? 'alone' : ''}`}>
                      <span className="fbm-month">{r.label}</span>
                      <span className="fbm-days">{r.days} / {r.daysInMonth} 天</span>
                      <span className="fbm-others">{r.others.length === 0 ? '當月只有這一案 → 扛整個月' : `同月：${r.others.map(o => `${o.title} ${o.days} 天`).join('、')}`}</span>
                      <span className="fbm-amt">{fmtNT(Math.round(r.amount))}</span>
                    </div>
                  ))}
                  <div className="fbm-row total">
                    <span className="fbm-month">合計</span><span></span><span></span>
                    <span className="fbm-amt">{fmtNT(Math.round(fixedByMonth.reduce((a, r) => a + r.amount, 0)))}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tax */}
        <div className="cost-block">
          <div className="cost-block-h"><span>稅務</span></div>
          <div className="cost-row-line">
            <span>案件類型</span>
            <div className="type-toggle">
              <button className={!project.overseas ? 'on' : ''} onClick={() => update({ overseas: false })}>國內案</button>
              <button className={project.overseas ? 'on' : ''} onClick={() => update({ overseas: true })}>國外案</button>
            </div>
          </div>
          {c.isOverseas ? (
            <>
              <div className="cost-row-line emphasis"><span>應繳營業稅</span><span className="num-val">{fmtNT(0)}</span></div>
              <div className="tax-hint">境外交易依加值型及非加值型營業稅法規定，於一定金額內免徵營業稅。</div>
            </>
          ) : (
            <>
              <div className="cost-row-line"><span>銷項稅（含稅價拆算）</span><span className="num-val">{fmtNT(c.salesVAT)}</span></div>
              <div className="cost-row-line"><span>可抵扣進項稅</span><span className="num-val">− {fmtNT(c.creditableInputTax)}</span></div>
              <div className="cost-row-line emphasis"><span>應繳營業稅</span><span className="num-val">{fmtNT(c.netVAT)}</span></div>
              <div className="tax-hint">合約金額為含稅價，稅額 = 含稅價 ÷ 1.05 × 5%。公司外包可抵進項稅，個人外包無發票不可抵。<br/>此處顯示單案估算，<strong>公司實際繳稅</strong>會跨案合併（同期銷項減進項，含跨期留底結轉），以現金流量表為準。</div>
            </>
          )}
        </div>
      </div>

      <PaymentSchedule project={project} onUpdate={onUpdate} />

      <div className="cost-section">
        <div className="cost-section-h">
          <div className="cost-block-h">
            <span>外包支出</span>
            <span className="ghost-pill">公司 {fmtNT(c.companyOutsource)}</span>
            <span className="ghost-pill">個人 {fmtNT(c.personalOutsource)}</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {onUpdateCustomOutsourceRoles && <button className="btn btn-ghost small" onClick={addCustomRole}>+ 新增角色</button>}
            <button className="btn btn-ghost small" onClick={addOutsource}>+ 新增外包項目</button>
          </div>
        </div>
        <div className="outsource-list">
          <div className="outsource-row head">
            <div>角色 / 項目</div><div>類型</div><div>金額</div><div className="center">可抵稅</div><div></div>
          </div>
          {(project.outsources || []).length === 0 && <div className="empty-row">尚無外包支出。點上方按鈕新增。</div>}
          {(project.outsources || []).map(o => {
            const rolesList = outsourceRoles || DEFAULT_OUTSOURCE_ROLES;
            const showOrphan = o.name && !rolesList.includes(o.name);
            const customs = customOutsourceRoles || [];
            return (
              <div key={o.id} className="outsource-row">
                <select className="input select" value={o.name || ''} onChange={e => updateOutsource(o.id, { name: e.target.value })}>
                  <option value="" disabled>選擇角色…</option>
                  {showOrphan && <option value={o.name}>{o.name}</option>}
                  {customs.length > 0 ? (
                    <>
                      <optgroup label="預設">{DEFAULT_OUTSOURCE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}</optgroup>
                      <optgroup label="自訂">{customs.map(r => <option key={r} value={r}>{r}</option>)}</optgroup>
                    </>
                  ) : DEFAULT_OUTSOURCE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <div className="type-toggle">
                  <button className={o.type === 'company' ? 'on' : ''} onClick={() => updateOutsource(o.id, { type: 'company', taxable: true })}>公司</button>
                  <button className={o.type === 'personal' ? 'on' : ''} onClick={() => updateOutsource(o.id, { type: 'personal', taxable: false })}>個人</button>
                </div>
                <MoneyInput value={o.amount} onChange={v => updateOutsource(o.id, { amount: v })} />
                <div className="center">
                  <div className={`check-box ${o.taxable ? 'checked' : ''} ${o.type === 'personal' ? 'disabled' : ''}`}
                    onClick={() => { if (o.type === 'company') updateOutsource(o.id, { taxable: !o.taxable }); }}
                    title={o.type === 'personal' ? '個人外包無法抵稅' : '可抵扣 5% 進項稅'}></div>
                </div>
                <button className="delete-item visible" onClick={() => { if (confirm('確定刪除這筆外包？')) removeOutsource(o.id); }} title="刪除">×</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ProjectFinanceModal({ project, onClose, ...detailProps }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!project) return null;
  return ReactDOM.createPortal(
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-wide finance-modal">
        <button className="modal-close" onClick={onClose} title="關閉 (Esc)">×</button>
        <ProjectFinanceDetail project={project} {...detailProps} />
      </div>
    </div>,
    document.body
  );
}

// ---------- Project Card ----------
function ProjectCard({ project, expandedStageId, costsOpen, onStageClick, onCycleStage, onCloseDetail, onUpdateStage, onDeleteStage, onInsertStage, onUpdateProject, onTogglePanel, onDeleteProject, onArchive, archiveMode = 'deliver', onRestore, onPurgeProject, density, stageVariant, dragHandleProps, dropTargetProps, isDragging, isOver, panelStyle, fixedCostShare, overtimeShare, monthlyFixedExpense, onOpenCashSettings, outsourceRoles, customOutsourceRoles, onUpdateCustomOutsourceRoles, isFocused, anyFocused, onOpenFullFinance, presentation }) {
  const origDue = new Date(project.due);
  const isExtended = !!project.extendedDue && new Date(project.extendedDue) > origDue;
  const effDue = isExtended ? new Date(project.extendedDue) : origDue;
  const days = daysBetween(TODAY, effDue);
  const warn = days <= 14 && days >= 0;
  const extDays = isExtended ? daysBetween(origDue, new Date(project.extendedDue)) : 0;

  const [showEditModal, setShowEditModal] = useState(false);
  const cardRef = useRef(null);
  const heroRef = useRef(null);      // 卡片頭部（標題＋倒數＋進度條）＝劇照的框，面板展開不會改變它
  const stageRowRef = useRef(null);
  const [coverFrame, setCoverFrame] = useState(null);
  const openEdit = () => {
    const el = heroRef.current || cardRef.current;
    if (el) setCoverFrame({ w: el.offsetWidth, h: el.offsetHeight });
    setShowEditModal(true);
  };
  const panelOpen = !!expandedStageId || !!project.infoOpen || !!project.costsOpen;
  // 面板打開時頭部要黏在畫面上方、只露出進度條那一列：需要知道頭部與進度條列的高度
  useEffect(() => {
    if (!panelOpen) return;
    const card = cardRef.current, hero = heroRef.current, row = stageRowRef.current;
    if (!card || !hero || !row || typeof ResizeObserver === 'undefined') return;
    const apply = () => {
      card.style.setProperty('--hero-h', hero.offsetHeight + 'px');
      card.style.setProperty('--stage-h', row.offsetHeight + 'px');
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(hero); ro.observe(row);
    return () => ro.disconnect();
  }, [panelOpen]);

  // 用全域的 projectPct（會處理子細項 + 階段等權重平均）。
  const pct = projectPct(project);
  // 「完成」= 進度 100%，或已經按過「已交件」（歸檔）。歸檔的案子就算細項沒全勾，也要以交件狀態顯示
  const canArchive = pct === 100 || !!project.archived;
  // 超常發揮：完成日早於「原定」交件日才算提前（延期後才趕上不算，對自己誠實）
  const earlyDays = (canArchive && project.completedAt && !isNaN(origDue))
    ? daysBetween(new Date(project.completedAt), origDue) : 0;
  const cardColor = colorById(project.color);
  const [metaOpen, setMetaOpen] = useState(false);
  const billing = getBillingStatus(project);
  const coverUrl = useCoverUrl(project.coverPath);

  // current stage = first 'active', else last 'done', else first
  const currentStage = project.stages.find(s => s.status === 'active')
    || [...project.stages].reverse().find(s => s.status === 'done')
    || project.stages[0];

  return (
    <div
      className={`card ${density === 'dense' ? 'dense' : ''} ${isDragging ? 'dragging' : ''} ${isOver ? 'drag-over' : ''} ${canArchive ? 'celebrate' : ''} ${isFocused ? 'focused' : ''} ${anyFocused && !isFocused ? 'dimmed' : ''} ${cardColor.hex ? 'has-color' : ''} ${metaOpen ? 'meta-open' : ''} ${coverUrl ? 'has-cover' : ''} ${panelOpen ? 'panel-open' : ''}`}
      ref={cardRef}
      data-screen-label={project.title}
      data-project-id={project.id}
      style={cardColor.hex ? { '--card-color': cardColor.hex } : undefined}
      {...dropTargetProps}
    >
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
              archiveMode === 'restore' ? (
                <button className="card-action" onClick={() => onArchive(project.id)} title="移回進行中">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7a4 4 0 1 1 1.2 2.8M3 5v2h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  恢復進行中
                </button>
              ) : (
                <button className="card-action archive-cta" onClick={() => onArchive(project.id)} title="製作結束、已交給客戶。卡片會離開主畫面；款項未收齊的話，仍會留在「收付款」頁追蹤">
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10v2H2zM3 6v5h8V6M5.5 8h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  已交件
                </button>
              )
            )}
            <button className="card-action" onClick={openEdit} title="編輯專案基本資料">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10.5 2.5l1 1-7 7H3v-1.5l7-7z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button className={`card-action ${project.infoOpen ? 'on' : ''}`} onClick={() => onTogglePanel(project.id, 'info')} title="專案資訊">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/><path d="M7 6v4M7 4v.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            </button>
            <button className={`card-action ${project.costsOpen ? 'on' : ''}`} onClick={() => onTogglePanel(project.id, 'costs')} title="財務細節">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M3.5 3.5h5a2 2 0 1 1 0 4h-3a2 2 0 1 0 0 4h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
            </button>
            <button className="card-action danger" onClick={() => { if (confirm(`確定把「${project.title}」移到垃圾桶？`)) onDeleteProject(project.id); }} title="移到垃圾桶（可從垃圾桶分頁復原）">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 4h8M5.5 4V2.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1V4M4 4l.5 7a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1L10 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </>
        )}
      </div>
      <span className="card-rim" aria-hidden="true" />
      <div className="card-hero" ref={heroRef}>
      {coverUrl && (
        <div className="card-cover" aria-hidden="true"
          style={{ backgroundImage: `url("${coverUrl}")`, '--cx': `${Number(project.coverX) || 0}%`, '--cy': `${Number(project.coverY) || 0}%`, '--cover-zoom': Number(project.coverZoom) || 1 }} />
      )}
      <div className="card-row">
        <div className="card-title-block">
          <div className="project-title">{project.title}</div>
          <div className="client-name">{project.client}</div>
        </div>

        <div className="card-right">
          <div className={`countdown ${canArchive ? 'done' : (isExtended ? 'overtime' : (warn ? 'warn' : ''))}`}>
            {canArchive ? (
              <>
                <div className="countdown-num">
                  <span className="done-check">✓</span><span className="unit">已完成</span>
                </div>
                <div className="countdown-label">
                  <span className="due-date">{fmtDate(project.deliveredAt ? new Date(project.deliveredAt) : effDue)}</span>
                  <span className="due-sep">·</span>
                  <span>{project.deliveredAt ? '已交件' : '交件'}</span>
                </div>
                {earlyDays > 0 && (
                  <div className="early-note">提前 {earlyDays} 天完成</div>
                )}
                {billing !== 'full' && (
                  <div className="billing-note">待收 {fmtNT((Number(project.budget) || 0) - getReceivedAmount(project))}</div>
                )}
              </>
            ) : (
              <>
                <div className="countdown-num">
                  {days < 0 ? `+${Math.abs(days)}` : days}<span className="unit">{days < 0 ? '天逾期' : '天'}</span>
                </div>
                <div className="countdown-label">
                  <span className="due-date">{fmtDate(effDue)}</span>
                  <span className="due-sep">·</span>
                  <span>{isExtended ? '延長賽' : (warn ? '緊急' : '距交件')}</span>
                </div>
                {isExtended && (
                  <div className="overtime-note">原定 {fmtDate(origDue)}・加時 {extDays} 天</div>
                )}
              </>
            )}
          </div>
          <CompletionRing pct={pct} />
        </div>
      </div>

      {/* 詳細資訊摺疊區（移到 card-row 之外，避免擠進去）*/}
      <div className="card-meta-row">
        <button className="card-meta-toggle" type="button" onClick={() => setMetaOpen(o => !o)} title={metaOpen ? '收起詳細資訊' : '展開詳細資訊'}>
          <span>詳細資訊</span>
          <span className="chevron">{metaOpen ? '▾' : '▸'}</span>
        </button>
        {metaOpen && (
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
            {canArchive && (
              <>
                <span className="sep">·</span>
                <div className="meta-item">
                  <span className="meta-label">交件結果</span>
                  {project.completedAt ? (
                    earlyDays > 0 ? (
                      <span className="meta-value result-early">提前 {earlyDays} 天（原定 {fmtDate(origDue)}・實際 {fmtDate(project.completedAt)}）</span>
                    ) : earlyDays < 0 ? (
                      <span className="meta-value result-late">超時 {-earlyDays} 天（原定 {fmtDate(origDue)}・實際 {fmtDate(project.completedAt)}）</span>
                    ) : (
                      <span className="meta-value result-early">準時交件（{fmtDate(origDue)}）</span>
                    )
                  ) : (
                    <span className="meta-value muted">完成日未記錄，可在編輯視窗補填</span>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="card-stage-row" ref={stageRowRef}>
        <div className="stage-lead">
          <div className="drag-handle" title="拖曳排序" {...dragHandleProps}></div>
          <div className="stage-tag">{currentStage.label}</div>
          {hasWorkPeriods(project) && <span className="seg-badge" title="這案子中間有停工：固定成本只算實際工作區間（編輯專案可改）">分段</span>}
        </div>
        <StageBar
          variant={stageVariant}
          stages={project.stages}
          selectedStageId={expandedStageId}
          onClick={(sid) => onStageClick(sid)}
          onCycle={(sid) => onCycleStage(project.id, sid)}
          onInsert={(idx) => onInsertStage(project.id, idx)}
        />
      </div>
      </div>{/* /card-hero */}

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
          onOpenFullFinance={onOpenFullFinance}
          presentation={presentation}
          fixedCostShare={fixedCostShare}
          overtimeShare={overtimeShare}
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
          coverFrame={coverFrame}
          onClose={() => setShowEditModal(false)}
          onSave={(patch) => { onUpdateProject(project.id, patch); setShowEditModal(false); }}
        />
      )}
    </div>
  );
}

// MUJI 風暖灰色票（給卡片左邊條 + 編輯 modal 選色用）
const PROJECT_COLORS = [
  { id: 'none', name: '無',  hex: null,       label: '預設' },
  { id: 'sand', name: '沙',  hex: '#d4a574',  label: '沙' },
  { id: 'moss', name: '苔',  hex: '#84a59d',  label: '苔' },
  { id: 'clay', name: '陶',  hex: '#b97e6f',  label: '陶' },
  { id: 'mist', name: '霧',  hex: '#8eaab5',  label: '霧' },
  { id: 'tea',  name: '茶',  hex: '#a8b67c',  label: '茶' },
  { id: 'lotus',name: '藕',  hex: '#cba0a4',  label: '藕' },
  { id: 'ink',  name: '墨',  hex: '#4a5568',  label: '墨' },
];
const colorById = (id) => PROJECT_COLORS.find(c => c.id === id) || PROJECT_COLORS[0];

// 劇照取景：像 Facebook 封面——拖曳移動、滑桿縮放。存的是 translate %（x/y）和 zoom，
// 卡片用同一組 CSS 變數畫，所以預覽框＝卡片實際看到的範圍（框的長寬比對齊收合狀態的卡片）。
function CoverCropEditor({ url, x, y, zoom, onChange, frame }) {
  // frame = 打開視窗那一刻量到的卡片尺寸 → 預覽框用同樣的長寬比，看到的範圍才會一樣
  const aspect = (frame && frame.w > 0 && frame.h > 0) ? (frame.w / frame.h) : (1120 / 236);
  const boxRef = useRef(null);
  const [nat, setNat] = useState(null);      // 圖片原始尺寸，用來限制不能拖出邊界
  const drag = useRef(null);
  useEffect(() => {
    let alive = true; const img = new Image();
    img.onload = () => { if (alive) setNat({ w: img.naturalWidth, h: img.naturalHeight }); };
    img.src = url;
    return () => { alive = false; };
  }, [url]);
  // 允許的最大位移（%）：cover 縮放後多出來的部分的一半
  const limits = (z) => {
    const box = boxRef.current; if (!box || !nat) return { mx: 100, my: 100 };
    const W = box.clientWidth, H = box.clientHeight;
    const s = Math.max(W / nat.w, H / nat.h);
    const rw = nat.w * s * z, rh = nat.h * s * z;
    return { mx: Math.max(0, (rw - W) / 2) / W * 100, my: Math.max(0, (rh - H) / 2) / H * 100 };
  };
  const clamp = (v, m) => Math.max(-m, Math.min(m, v));
  const onPointerDown = (e) => {
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, x0: x, y0: y };
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const box = boxRef.current; if (!box) return;
    const { mx, my } = limits(zoom);
    const nx = clamp(drag.current.x0 + (e.clientX - drag.current.sx) / box.clientWidth * 100, mx);
    const ny = clamp(drag.current.y0 + (e.clientY - drag.current.sy) / box.clientHeight * 100, my);
    onChange({ coverX: Math.round(nx * 10) / 10, coverY: Math.round(ny * 10) / 10 });
  };
  const onPointerUp = () => { drag.current = null; };
  const setZoom = (z) => {
    const { mx, my } = limits(z);
    onChange({ coverZoom: z, coverX: clamp(x, mx), coverY: clamp(y, my) });
  };
  return (
    <div className="cover-crop">
      <div ref={boxRef} className="cover-crop-box" style={{ aspectRatio: String(aspect) }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        title="拖曳移動取景位置">
        <div className="cover-crop-img" style={{ backgroundImage: `url("${url}")`, '--cx': `${x}%`, '--cy': `${y}%`, '--cover-zoom': zoom }} />
        <div className="cover-crop-hint">拖曳移動</div>
      </div>
      <div className="cover-crop-tools">
        <span className="cover-crop-label">縮放</span>
        <input type="range" min="1" max="3" step="0.05" value={zoom} onChange={e => setZoom(Number(e.target.value))} />
        <span className="cover-crop-zoom">{zoom.toFixed(2)}×</span>
        <button type="button" className="btn btn-ghost small" onClick={() => onChange({ coverX: 0, coverY: 0, coverZoom: 1 })}>重設</button>
      </div>
    </div>
  );
}

function EditProjectModal({ project, onClose, onSave, coverFrame }) {
  const [form, setForm] = useState({
    title: project.title || '',
    client: project.client || '',
    budget: project.budget || '',
    start: project.start || '',
    due: project.due || '',
    extendedDue: project.extendedDue || '',
    completedAt: project.completedAt || '',
    color: project.color || 'none',
    coverPath: project.coverPath || '',
    coverX: Number(project.coverX) || 0,
    coverY: Number(project.coverY) || 0,
    coverZoom: Number(project.coverZoom) || 1,
    workPeriods: Array.isArray(project.workPeriods) ? project.workPeriods.map(w => ({ start: w.start || '', end: w.end || '' })) : [],
  });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const coverPreviewUrl = useCoverUrl(form.coverPath);
  // 「中間有停工」開關：打開時預設一段（起始→留空＝到交件日）
  const segmented = form.workPeriods.length > 0;
  const setSegmented = (on) => setForm(f => ({ ...f, workPeriods: on ? (f.workPeriods.length ? f.workPeriods : [{ start: f.start || '', end: '' }]) : [] }));
  const setPeriod = (i, patch) => setForm(f => ({ ...f, workPeriods: f.workPeriods.map((w, j) => j === i ? { ...w, ...patch } : w) }));
  const addPeriod = () => setForm(f => ({ ...f, workPeriods: [...f.workPeriods, { start: '', end: '' }] }));
  const removePeriod = (i) => setForm(f => ({ ...f, workPeriods: f.workPeriods.filter((_, j) => j !== i) }));

  const onPickCover = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) { alert('請選圖片檔（JPG / PNG / HEIC 轉 JPG 後）。'); return; }
    setUploading(true);
    try {
      const path = await uploadCoverImage(project.id, file);
      setForm(f => {
        if (f.coverPath && f.coverPath !== project.coverPath) deleteCoverImage(f.coverPath); // 這次視窗裡傳過、還沒存的舊圖
        return { ...f, coverPath: path, coverX: 0, coverY: 0, coverZoom: 1 };
      });
    } catch (err) {
      alert('劇照上傳失敗：' + (err && err.message ? err.message : err) + '\n\n如果是第一次用，請先到 Supabase 後台建立 "' + COVER_BUCKET + '" 這個 bucket。');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const valid = form.title.trim() && form.client.trim() && form.budget && form.due;

  const submit = (e) => {
    e.preventDefault();
    if (!valid) return;
    if (project.coverPath && project.coverPath !== form.coverPath) deleteCoverImage(project.coverPath);
    onSave({
      title: form.title.trim(),
      client: form.client.trim(),
      budget: Number(form.budget),
      start: form.start,
      due: form.due,
      extendedDue: form.extendedDue || '',
      completedAt: form.completedAt || '',
      color: form.color,
      coverPath: form.coverPath || '',
      coverX: form.coverX || 0,
      coverY: form.coverY || 0,
      coverZoom: form.coverZoom || 1,
      workPeriods: form.workPeriods.filter(w => w.start).map(w => ({ start: w.start, end: w.end || '' })),
    });
  };

  // 用 portal 掛到 body：卡片有 backdrop-filter，會把 position:fixed 的子元素困在卡片框內
  return ReactDOM.createPortal(
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal edit-project">
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
            <label className="field-label">交件日期（原定）</label>
            <input className="date-input" type="date" value={form.due} onChange={e => setForm({ ...form, due: e.target.value })} />
          </div>
          <div className="field">
            <label className="field-label">延期到（選填）</label>
            <input className="date-input" type="date" value={form.extendedDue}
              min={form.due || undefined}
              onChange={e => setForm({ ...form, extendedDue: e.target.value })} />
            <div className="field-hint">
              專案延期才填。填了之後：倒數改用這天、卡片轉橘色「延長賽」，並對<strong>本案</strong>按逾期天數加收「延期佔用費」；<strong>不影響其他案</strong>的固定成本分攤。留空＝沒有延期。
              {form.extendedDue && (
                <> <button type="button" className="link-btn-inline" onClick={() => setForm({ ...form, extendedDue: '' })}>清除延期</button></>
              )}
            </div>
          </div>
          <div className="field">
            <label className="field-label">實際完成日（選填）</label>
            <input className="date-input" type="date" value={form.completedAt}
              onChange={e => setForm({ ...form, completedAt: e.target.value })} />
            <div className="field-hint">
              專案達 100% 時系統會自動記錄。這欄是給<strong>更早完成的舊案</strong>補填用——填了之後「詳細資訊」會顯示這案當初提前或超時幾天。
              {form.completedAt && (
                <> <button type="button" className="link-btn-inline" onClick={() => setForm({ ...form, completedAt: '' })}>清除</button></>
              )}
            </div>
          </div>
          <div className="field">
            <label className="field-label">實際工作區間（選填）</label>
            <label className="toggle-row">
              <input type="checkbox" checked={segmented} onChange={e => setSegmented(e.target.checked)} />
              <span>這個案子中間有停工——固定成本只算實際工作的日子</span>
            </label>
            {segmented && (
              <div className="period-list">
                {form.workPeriods.map((w, i) => (
                  <div key={i} className="period-row">
                    <span className="period-idx">第 {i + 1} 段</span>
                    <input type="date" className="date-input compact" value={w.start} onChange={e => setPeriod(i, { start: e.target.value })} />
                    <span className="period-arrow">→</span>
                    <input type="date" className="date-input compact" value={w.end} min={w.start || undefined} onChange={e => setPeriod(i, { end: e.target.value })} />
                    <span className="period-hint">{w.end ? '' : '留空＝做到交件日'}</span>
                    <button type="button" className="delete-item visible" onClick={() => removePeriod(i)} title="刪除這段" disabled={form.workPeriods.length <= 1}>×</button>
                  </div>
                ))}
                <button type="button" className="btn btn-ghost small" onClick={addPeriod}>+ 再加一段</button>
                <div className="field-hint">其他案子照原本算法；只有這個案子會依這些區間分攤每月固定支出。停工期間的月租由當時在跑的其他案子分攤。有填的話「延期佔用費」不再另計。</div>
              </div>
            )}
          </div>
          <div className="field">
            <label className="field-label">專案劇照（選填）</label>
            <div className={`cover-field ${form.coverPath ? 'has-img' : ''}`}>
              {form.coverPath
                ? (coverPreviewUrl
                    ? <CoverCropEditor url={coverPreviewUrl} x={form.coverX} y={form.coverY} zoom={form.coverZoom} frame={coverFrame}
                        onChange={(v) => setForm(f => ({ ...f, ...v }))} />
                    : <div className="cover-preview empty">載入中…</div>)
                : <div className="cover-preview empty">尚未上傳</div>}
              <div className="cover-actions">
                <button type="button" className="btn btn-ghost small" disabled={uploading} onClick={() => fileRef.current && fileRef.current.click()}>
                  {uploading ? '上傳中…' : (form.coverPath ? '更換圖片' : '選擇圖片')}
                </button>
                {form.coverPath && !uploading && (
                  <button type="button" className="btn btn-ghost small" onClick={() => setForm(f => ({ ...f, coverPath: '' }))}>移除</button>
                )}
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickCover} />
              </div>
            </div>
            <div className="field-hint">上方預覽就是卡片的取景框：<strong>拖曳移動、下方滑桿縮放</strong>，把重點擺在你要的位置。圖片存在私有空間，只有登入後看得到。</div>
          </div>
          <div className="field">
            <label className="field-label">卡片色彩</label>
            <div className="color-swatches">
              {PROJECT_COLORS.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className={`color-swatch ${form.color === c.id ? 'on' : ''} ${c.id === 'none' ? 'none' : ''}`}
                  style={c.hex ? { background: c.hex } : undefined}
                  onClick={() => setForm({ ...form, color: c.id })}
                  title={c.label}
                >
                  {form.color === c.id && <span className="check">✓</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => { if (form.coverPath && form.coverPath !== project.coverPath) deleteCoverImage(form.coverPath); onClose(); }}>取消 (Esc)</button>
            <button type="submit" className="btn btn-primary" disabled={!valid}>儲存</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
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
      if (kind === 'income-received') return '#10b981'; // 已收：實心綠
      if (kind === 'income') return '#6ee7b7';          // 未收：淡綠（預估）
      if (kind === 'fixed') return '#ef4444';
      if (kind === 'outsource') return '#fbbf24'; // 未付：淡橙黃（預估）
      if (kind === 'outsource-paid') return '#f59e0b'; // 已付：實心橙
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
        if (kind === 'fixed')            return 'rgba(239, 68, 68, 0.30)';  // 紅
        if (kind === 'outsource')        return 'rgba(251, 191, 36, 0.20)'; // 淡橙黃（未付，半透明）
        if (kind === 'outsource-paid')   return 'rgba(245, 158, 11, 0.40)'; // 橙（已付）
        if (kind === 'extra')            return 'rgba(139, 92, 246, 0.30)'; // 紫
        if (kind === 'vat')              return 'rgba(146, 64, 14, 0.30)';  // 棕
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

// 「還能撐多久」：從今天到餘額第一次轉負的那天。>6 個月藍、3–6 個月紫、<3 個月紅。
function RunwayBanner({ series }) {
  if (!series) return null;
  const today = new Date(TODAY);
  let days = null;
  if (series.goesNegative && series.negativeAt) days = daysBetween(today, new Date(series.negativeAt.date));
  const months = days == null ? null : days / 30.44;
  const tone = days == null ? 'blue' : days < 0 ? 'red' : months < 3 ? 'red' : months <= 6 ? 'purple' : 'blue';
  let big, sub;
  if (days == null) { big = '12 個月內不見底'; sub = `以今天（${fmtDate(today)}）起算，未來 12 個月餘額都在零以上`; }
  else if (days < 0) { big = '已經見底'; sub = `餘額在 ${fmtDate(new Date(series.negativeAt.date))} 已轉負`; }
  else {
    const m = Math.floor(months), d = Math.round(days - m * 30.44);
    big = m >= 1 ? `還剩 ${m} 個月${d > 0 ? ` ${d} 天` : ''}` : `還剩 ${days} 天`;
    sub = `以今天（${fmtDate(today)}）起算，${fmtDate(new Date(series.negativeAt.date))} 見底`;
  }
  return (
    <div className={`runway tone-${tone}`}>
      <div className="runway-label">資金還能撐</div>
      <div className="runway-big">{big}</div>
      <div className="runway-sub">{sub}</div>
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
              <RunwayBanner series={series} />
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
    { id: 'payments', label: '收付款', count: counts.unpaidOutsources },
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
              <button className="delete-item visible" onClick={() => { if (confirm('確定刪除這筆額外支出？')) deleteEntry(ex.id); }} title="刪除">×</button>
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
  'payment-out':      { color: '#fbbf24', emoji: '💸', name: '外包付款（預估）' },
  'payment-out-paid': { color: '#f59e0b', emoji: '✓',  name: '外包付款（已付）' },
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
function FixedCostBreakdownSection({ projects, monthlyFixed, defaultOpen = false }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const breakdown = useMemo(
    () => computeMonthlyFixedBreakdown(projects, monthlyFixed),
    [projects, monthlyFixed]
  );

  if (breakdown.length === 0) return null;

  return (
    <section className="finance-summary">
      <div className="page-section-header collapsible">
        <button className="section-collapse-btn" onClick={() => setOpen(o => !o)} title={open ? '收起' : '展開'}>
          <span className="chevron">{open ? '▾' : '▸'}</span>
          <h3 className="page-section-title">每月固定成本分攤表</h3>
        </button>
        {!open && (
          <span className="cashflow-stat">涵蓋 <strong>{breakdown.length}</strong> 個月</span>
        )}
      </div>
      {open && (
        <div className="fixed-breakdown">
          {breakdown.map(m => {
            var totalNeeded = m.total + m.carryIn;
            return (
            <div key={m.key} className={'fb-month' + (m.deficit > 0 ? ' fb-month-has-deficit' : '')}>
              <div className="fb-month-header">
                <span className="fb-month-label">{m.label}</span>
                <span className="fb-month-total">{fmtNT(m.total)}</span>
              </div>
              {m.carryIn > 0 && (
                <div className="fb-carry-in">上月累計缺口：{fmtNT(m.carryIn)}</div>
              )}
              <div className="fb-bars">
                {m.projects.map(s => {
                  var currentPct = totalNeeded > 0 ? Math.round(s.current / totalNeeded * 100) : 0;
                  var backfillPct = totalNeeded > 0 ? Math.round(s.backfill / totalNeeded * 100) : 0;
                  var hasBackfill = s.backfill > 0;
                  return (
                    <div key={s.id} className="fb-bar-row">
                      <div className="fb-bar-label">
                        <span className="fb-project-name">{s.title}</span>
                        <span className="fb-days">{s.days > 0 ? s.days + ' 天' : '餘額支付'}</span>
                        {s.paymentInfo && <span className="fb-payment-info">{s.paymentInfo}</span>}
                      </div>
                      <div className="fb-bar-track">
                        <div className="fb-bar-fill" style={{ width: currentPct + '%' }}></div>
                        {hasBackfill && <div className="fb-bar-fill fb-bar-fill-backfill" style={{ width: backfillPct + '%', left: currentPct + '%', position: 'absolute', top: 0 }}></div>}
                      </div>
                      <div className="fb-bar-amount">
                        {fmtNT(Math.round(s.amount))}
                        {hasBackfill && (
                          <span className="fb-split-detail">（本月 {fmtNT(Math.round(s.current))} + <span className="fb-backfill-text">補缺口 {fmtNT(Math.round(s.backfill))}</span>）</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {m.deficit > 0 && (
                  <div className="fb-bar-row fb-deficit">
                    <div className="fb-bar-label">
                      <span className="fb-project-name">缺口</span>
                      <span className="fb-days">無案負擔</span>
                    </div>
                    <div className="fb-bar-track">
                      <div className="fb-bar-fill fb-bar-fill-deficit" style={{ width: Math.round(m.deficit / totalNeeded * 100) + '%' }}></div>
                    </div>
                    <div className="fb-bar-amount fb-deficit-amount">{fmtNT(Math.round(m.deficit))}</div>
                  </div>
                )}
              </div>
              {m.carryOut > 0 && (
                <div className="fb-carry-out">累計缺口結轉：{fmtNT(m.carryOut)}</div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------- 付款分頁（外包付款狀態追蹤） ----------
// 把所有非刪除專案的外包扁平化成一張列表，按狀態 + 月份分組。
// Step 2：只顯示列表（不能打勾）；Step 3 才會加 checkbox + Modal 確認；Step 5 才會加概覽列、逾期警示。
function buildPaymentRows(projects) {
  var today = new Date(TODAY); today.setHours(0, 0, 0, 0);
  var rows = [];
  (projects || []).forEach(function(p) {
    if (p.deleted) return;
    (p.outsources || []).forEach(function(o) {
      if (!o || (Number(o.amount) || 0) === 0) return;
      var paid = isOutsourcePaid(o);
      var effDate = paid ? (o.paidDate || '') : getOutsourcePayDate(p);
      var dateObj = effDate ? new Date(effDate) : null;
      if (dateObj) dateObj.setHours(0, 0, 0, 0);
      var bucket;
      if (paid) {
        bucket = 'paid';
      } else if (!dateObj || isNaN(dateObj)) {
        bucket = 'undated';
      } else if (dateObj < today) {
        bucket = 'overdue';
      } else {
        var sameMonth = dateObj.getFullYear() === today.getFullYear() && dateObj.getMonth() === today.getMonth();
        var nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        var sameNextMonth = dateObj.getFullYear() === nextMonth.getFullYear() && dateObj.getMonth() === nextMonth.getMonth();
        if (sameMonth) bucket = 'thisMonth';
        else if (sameNextMonth) bucket = 'nextMonth';
        else bucket = 'future';
      }
      rows.push({
        projectId: p.id,
        projectTitle: p.title,
        outsourceId: o.id,
        outsourceName: o.name || '（未命名）',
        outsourceRole: o.name || '',
        type: o.type || 'company',
        amount: Number(o.amount) || 0,
        paid: paid,
        paidDate: paid ? (o.paidDate || '') : null,
        predictedDate: getOutsourcePayDate(p),
        effDate: effDate,
        daysOverdue: (!paid && dateObj && dateObj < today) ? Math.round((today - dateObj) / 86400000) : 0,
        bucket: bucket,
      });
    });
  });
  return rows;
}

function rowKey(r) { return r.projectId + '_' + r.outsourceId; }

// 算到今天為止的現金餘額：從起算日餘額開始，套用所有日期 ≤ 今天的事件
// 用 buildCashflowSeries 已經算好的 running balance（points 陣列），找最後一個 date ≤ 今天的 point
function computeTodayBalance(projects, settings) {
  if (!settings || (Number(settings.bankBalance) || 0) === 0 && !settings.startDate) return null;
  var series = buildCashflowSeries(projects || [], settings, 12);
  var today = new Date(TODAY); today.setHours(0, 0, 0, 0);
  var balance = series.startBalance;
  // points 是已按時間排序的（含每個事件後的 balance）
  for (var i = 0; i < series.points.length; i++) {
    var pt = series.points[i];
    var d = new Date(pt.date); d.setHours(0, 0, 0, 0);
    if (d > today) break;
    balance = pt.balance;
  }
  return balance;
}

// ===== 收款（客戶那邊的錢）=====
function buildReceivableRows(projects) {
  var today = new Date(TODAY); today.setHours(0, 0, 0, 0);
  var nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  var monthAfterStart = new Date(today.getFullYear(), today.getMonth() + 2, 1);
  var rows = [];
  (projects || []).forEach(function(p) {
    if (p.deleted) return;
    var budget = Number(p.budget) || 0;
    getPayments(p).forEach(function(pay) {
      var amount = budget * (Number(pay.percentage) || 0) / 100;
      if (amount === 0) return;
      var received = isPaymentReceived(pay);
      var dateObj = pay.dueDate ? new Date(pay.dueDate) : null;
      if (dateObj) dateObj.setHours(0, 0, 0, 0);
      var bucket, daysOverdue = 0;
      if (received) bucket = 'paid';
      else if (!dateObj || isNaN(dateObj)) bucket = 'undated';
      else if (dateObj < today) { bucket = 'overdue'; daysOverdue = daysBetween(dateObj, today); }
      else if (dateObj < nextMonthStart) bucket = 'thisMonth';
      else if (dateObj < monthAfterStart) bucket = 'nextMonth';
      else bucket = 'future';
      rows.push({
        projectId: p.id, paymentId: pay.id, projectTitle: p.title, client: p.client,
        label: pay.label, amount: amount, dueDate: pay.dueDate || '',
        received: received, receivedDate: pay.receivedDate || '',
        bucket: bucket, daysOverdue: daysOverdue, archived: !!p.archived,
      });
    });
  });
  return rows;
}

function ReceivablesView({ projects, settings, onUpdateProject }) {
  var todayBalance = useMemo(function() { return computeTodayBalance(projects, settings); }, [projects, settings]);
  var allRows = useMemo(function() { return buildReceivableRows(projects); }, [projects]);
  var groups = useMemo(function() {
    var g = { overdue: [], thisMonth: [], nextMonth: [], future: [], undated: [], paid: [] };
    allRows.forEach(function(r) { g[r.bucket].push(r); });
    ['overdue', 'thisMonth', 'nextMonth', 'future'].forEach(function(k) {
      g[k].sort(function(a, b) { return (a.dueDate || '').localeCompare(b.dueDate || ''); });
    });
    g.paid.sort(function(a, b) { return (b.receivedDate || '').localeCompare(a.receivedDate || ''); });
    return g;
  }, [allRows]);

  var setRowReceived = function(r, received, date) {
    var project = projects.find(function(p) { return p.id === r.projectId; });
    if (!project) return;
    var next = getPayments(project).map(function(pay) {
      if (pay.id !== r.paymentId) return pay;
      return Object.assign({}, pay, {
        received: received,
        receivedDate: received ? (date || pay.receivedDate || defaultActualDate(pay.dueDate)) : null,
      });
    });
    onUpdateProject(r.projectId, { payments: next });
  };

  var thisMonthKey = toISODate(TODAY).slice(0, 7);
  var sumOf = function(list) { return list.reduce(function(a, r) { return a + r.amount; }, 0); };
  var monthDueRows = allRows.filter(function(r) { return (r.dueDate || '').slice(0, 7) === thisMonthKey; });
  var monthReceived = sumOf(allRows.filter(function(r) { return r.received && (r.receivedDate || '').slice(0, 7) === thisMonthKey; }));
  var monthPending = sumOf(monthDueRows.filter(function(r) { return !r.received; }));
  var overdueAmt = sumOf(groups.overdue);

  if (allRows.length === 0) {
    return (
      <div className="payments-empty">
        <h3>還沒有收款排程</h3>
        <p className="muted">專案建立後會自動有頭期款／尾款，可在專案的「$」面板調整。</p>
      </div>
    );
  }

  return (
    <>
      <div className="pay-balance-bar">
        <div className="pay-balance-left">
          <span className="pay-balance-label">目前現金餘額</span>
          <span className={'pay-balance-value' + (todayBalance != null && todayBalance < 0 ? ' negative' : '')}>
            {todayBalance != null ? fmtNT(Math.round(todayBalance)) : '—'}
          </span>
          <span className="pay-balance-hint">已實現（只算真的收到、真的付出的）</span>
        </div>
      </div>
      <div className="pay-overview">
        <PayStat label="本月應收" value={sumOf(monthDueRows)} />
        <PayStat label="本月已收" value={monthReceived} accent="done" />
        <PayStat label="本月待收" value={monthPending} accent={monthPending > 0 ? 'active' : 'muted'} />
        {overdueAmt > 0 && <PayStat label="逾期未收" value={overdueAmt} accent="danger" warn={true} />}
      </div>

      <ReceivableGroup title="逾期未收" rows={groups.overdue} emptyHide={true} accent="danger" showDays={true} onSet={setRowReceived} />
      <ReceivableGroup title="本月待收" rows={groups.thisMonth} emptyHide={false} accent="active" onSet={setRowReceived} />
      <ReceivableGroup title="下月待收" rows={groups.nextMonth} emptyHide={true} accent="muted" onSet={setRowReceived} />
      <ReceivableGroup title="未來待收" rows={groups.future} emptyHide={true} accent="muted" onSet={setRowReceived} />
      {groups.undated.length > 0 && (
        <ReceivableGroup title="未排程（缺收款日）" rows={groups.undated} emptyHide={false} accent="muted" onSet={setRowReceived} />
      )}
      <ReceivableGroup title="已收" rows={groups.paid} emptyHide={true} accent="done" defaultCollapsed={true} onSet={setRowReceived} />
    </>
  );
}

function ReceivableGroup({ title, rows, emptyHide, accent, showDays, defaultCollapsed, onSet }) {
  var [collapsed, setCollapsed] = useState(!!defaultCollapsed);
  if (emptyHide && rows.length === 0) return null;
  var total = rows.reduce(function(s, r) { return s + r.amount; }, 0);
  return (
    <div className={'pay-group pay-group-' + (accent || 'muted')}>
      <button className="pay-group-header" onClick={() => setCollapsed(c => !c)} type="button">
        <span className="chevron">{collapsed ? '▸' : '▾'}</span>
        <span className="pay-group-title">{title}</span>
        <span className="pay-group-meta">{rows.length} 筆 · {fmtNT(total)}</span>
      </button>
      {!collapsed && (
        <div className="pay-group-body">
          {rows.length === 0 ? (
            <div className="pay-empty">無</div>
          ) : rows.map(function(r) {
            return (
              <div key={r.projectId + '_' + r.paymentId} className={'pay-row' + (r.received ? ' pay-row-paid' : '')}>
                {r.received
                  ? <span className="pay-paid-marker" title="已收到">✓</span>
                  : <button className="pay-receive-btn" type="button" onClick={() => onSet(r, true)} title="錢進來了，標記為已收（入帳日預設今天，可改）">收到了</button>}
                <div className="pay-row-main">
                  <div className="pay-row-name">
                    <span className="pay-outsource-name">{r.label}</span>
                    <span className="pay-project-name">{r.projectTitle} · {r.client}{r.archived ? '（已交件）' : ''}</span>
                  </div>
                  <div className="pay-row-meta">
                    <span className="pay-amount">{fmtNT(r.amount)}</span>
                    {r.received ? (
                      <span className="pay-date received-inline">
                        入帳
                        <input type="date" className="date-input compact" value={r.receivedDate}
                          onChange={e => onSet(r, true, e.target.value)} title="實際入帳日" />
                      </span>
                    ) : (
                      <span className="pay-date">{r.dueDate ? '預計 ' + r.dueDate : '無預計日'}</span>
                    )}
                    {showDays && r.daysOverdue > 0 && <span className="pay-overdue">逾期 {r.daysOverdue} 天</span>}
                    {r.received && (
                      <button className="pay-undo-btn" type="button" title="撤銷已收狀態"
                        onClick={() => { if (confirm('撤銷「' + r.projectTitle + ' · ' + r.label + '」的已收狀態？')) onSet(r, false); }}>↺</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===== 收付款頁：收款（錢進來）／付款（錢出去）兩個分頁 =====
function PaymentsPage({ projects, settings, onUpdateProject, onBatchUpdateProjects }) {
  var [mode, setMode] = useState('receive'); // 'receive' | 'pay'
  var overdueRecv = useMemo(function() { return buildReceivableRows(projects).filter(function(r) { return r.bucket === 'overdue'; }).length; }, [projects]);
  var unpaidOut = useMemo(function() { return buildPaymentRows(projects).filter(function(r) { return !r.paid; }).length; }, [projects]);
  return (
    <section className="payments-page">
      <div className="subnav">
        <button className={'subnav-item' + (mode === 'receive' ? ' on' : '')} onClick={() => setMode('receive')} type="button">
          收款{overdueRecv > 0 && <span className="subnav-badge danger">{overdueRecv}</span>}
        </button>
        <button className={'subnav-item' + (mode === 'pay' ? ' on' : '')} onClick={() => setMode('pay')} type="button">
          付款{unpaidOut > 0 && <span className="subnav-badge">{unpaidOut}</span>}
        </button>
      </div>
      {mode === 'receive'
        ? <ReceivablesView projects={projects} settings={settings} onUpdateProject={onUpdateProject} />
        : <PayablesView projects={projects} settings={settings} onUpdateProject={onUpdateProject} onBatchUpdateProjects={onBatchUpdateProjects} />}
    </section>
  );
}

function PayablesView({ projects, settings, onUpdateProject, onBatchUpdateProjects }) {
  var [selected, setSelected] = useState({}); // { [rowKey]: true }
  var [modalRows, setModalRows] = useState(null); // 開 modal 時暫存的列表
  var [undoConfirming, setUndoConfirming] = useState(null); // 撤銷的兩步驟確認：rowKey | null

  // 目前現金餘額（即時更新：勾選確認付款後會立刻反映）
  var todayBalance = useMemo(function() { return computeTodayBalance(projects, settings); }, [projects, settings]);

  var allRows = useMemo(function() { return buildPaymentRows(projects); }, [projects]);
  var groups = useMemo(function() {
    var g = { overdue: [], thisMonth: [], nextMonth: [], future: [], undated: [], paid: [] };
    allRows.forEach(function(r) { g[r.bucket].push(r); });
    ['overdue', 'thisMonth', 'nextMonth', 'future'].forEach(function(k) {
      g[k].sort(function(a, b) { return (a.effDate || '').localeCompare(b.effDate || ''); });
    });
    g.paid.sort(function(a, b) { return (b.paidDate || '').localeCompare(a.paidDate || ''); });
    return g;
  }, [allRows]);

  // 自動清除已不存在的選取（例如 row 已被付款）
  useEffect(function() {
    var validKeys = {};
    allRows.forEach(function(r) { if (!r.paid) validKeys[rowKey(r)] = true; });
    setSelected(function(prev) {
      var next = {};
      var changed = false;
      Object.keys(prev).forEach(function(k) {
        if (validKeys[k]) next[k] = true;
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [allRows]);

  var selectedCount = Object.keys(selected).length;
  var selectedRows = allRows.filter(function(r) { return selected[rowKey(r)]; });
  var selectedTotal = selectedRows.reduce(function(s, r) { return s + r.amount; }, 0);

  var toggleSelect = function(r) {
    var k = rowKey(r);
    setSelected(function(prev) {
      var next = Object.assign({}, prev);
      if (next[k]) delete next[k]; else next[k] = true;
      return next;
    });
  };
  var clearSelection = function() { setSelected({}); };

  var openConfirmModal = function() {
    if (selectedRows.length === 0) return;
    setModalRows(selectedRows.slice());
  };
  var closeModal = function() { setModalRows(null); };

  // 真正寫入：把選取的外包標記為已付
  var commitPayment = function(rows) {
    var patches = {}; // projectId -> { outsources: [...] }
    rows.forEach(function(r) {
      var p = projects.find(function(x) { return x.id === r.projectId; });
      if (!p) return;
      if (!patches[r.projectId]) {
        patches[r.projectId] = { outsources: (p.outsources || []).map(function(o) { return Object.assign({}, o); }) };
      }
    });
    rows.forEach(function(r) {
      var patch = patches[r.projectId];
      if (!patch) return;
      patch.outsources = patch.outsources.map(function(o) {
        return o.id === r.outsourceId ? Object.assign({}, o, { paid: true, paidDate: r.paidDate || toISODate(TODAY) }) : o;
      });
    });
    onBatchUpdateProjects(patches);
    clearSelection();
    closeModal();
  };

  // 單筆撤銷已付（兩步驟確認）
  var requestUndoPaid = function(r) {
    var k = rowKey(r);
    if (undoConfirming === k) {
      // 第二次點擊 → 真的撤銷
      var p = projects.find(function(x) { return x.id === r.projectId; });
      if (!p) { setUndoConfirming(null); return; }
      var newOutsources = (p.outsources || []).map(function(o) {
        return o.id === r.outsourceId ? Object.assign({}, o, { paid: false, paidDate: null }) : o;
      });
      onUpdateProject(r.projectId, { outsources: newOutsources });
      setUndoConfirming(null);
    } else {
      setUndoConfirming(k);
      // 3 秒沒按第二次就取消
      setTimeout(function() {
        setUndoConfirming(function(prev) { return prev === k ? null : prev; });
      }, 3000);
    }
  };

  // 概覽列數字
  var sumOf = function(arr) { return arr.reduce(function(s, r) { return s + r.amount; }, 0); };
  var monthRows = groups.overdue.concat(groups.thisMonth);
  var monthDue = sumOf(monthRows);
  var monthPaid = sumOf(groups.paid.filter(function(r) {
    if (!r.paidDate) return false;
    var d = new Date(r.paidDate);
    return d.getFullYear() === TODAY.getFullYear() && d.getMonth() === TODAY.getMonth();
  }));
  var monthPending = sumOf(groups.thisMonth);
  var overdueAmt = sumOf(groups.overdue);

  // 匯出本月付款明細
  var handleExport = function() {
    var rows = monthRows.concat(groups.paid.filter(function(r) {
      if (!r.paidDate) return false;
      var d = new Date(r.paidDate);
      return d.getFullYear() === TODAY.getFullYear() && d.getMonth() === TODAY.getMonth();
    }));
    var payload = {
      _說明: '這是本月付款明細快照。已付的金額會從銀行扣款；未付的是預估付款日。',
      月份: (TODAY.getFullYear()) + '-' + String(TODAY.getMonth() + 1).padStart(2, '0'),
      本月應付: monthDue,
      本月已付: monthPaid,
      本月待付: monthPending,
      逾期待付: overdueAmt,
      明細: rows.map(function(r) {
        return {
          專案: r.projectTitle,
          外包: r.outsourceName,
          類型: r.type === 'company' ? '公司' : '個人',
          金額: r.amount,
          狀態: r.paid ? '已付' : (r.daysOverdue > 0 ? '逾期 ' + r.daysOverdue + ' 天' : '待付'),
          日期: r.paid ? r.paidDate : (r.effDate ? '預估 ' + r.effDate : '無'),
        };
      }),
    };
    var dateStr = toISODate(TODAY);
    downloadJSON(payload, 'jt745-payments-' + dateStr + '.json');
  };

  if (allRows.length === 0) {
    return (
      <div className="payments-empty">
        <h3>還沒有外包項目</h3>
        <p className="muted">在任一專案的「$」面板新增外包後，會自動出現在這裡。</p>
      </div>
    );
  }

  var groupProps = {
    selected: selected,
    onToggleSelect: toggleSelect,
    undoConfirming: undoConfirming,
    onRequestUndoPaid: requestUndoPaid,
  };

  return (
    <>
      <div className="pay-balance-bar">
        <div className="pay-balance-left">
          <span className="pay-balance-label">目前現金餘額</span>
          <span className={'pay-balance-value' + (todayBalance != null && todayBalance < 0 ? ' negative' : '')}>
            {todayBalance != null ? fmtNT(Math.round(todayBalance)) : '—'}
          </span>
          <span className="pay-balance-hint">已實現（只算真的收到、真的付出的）</span>
        </div>
        <button className="pay-export-btn" onClick={handleExport} title="匯出本月付款明細給 Claude 對帳">📥 匯出</button>
      </div>
      <div className="pay-overview">
        <PayStat label="本月應付" value={monthDue} />
        <PayStat label="本月已付" value={monthPaid} accent="done" />
        <PayStat label="本月待付" value={monthPending} accent={monthPending > 0 ? 'active' : 'muted'} />
        {overdueAmt > 0 && <PayStat label="逾期" value={overdueAmt} accent="danger" warn={true} />}
      </div>

      <PaymentGroup title="逾期待付" rows={groups.overdue} emptyHide={true} accent="danger" showDays={true} {...groupProps} />
      <PaymentGroup title="本月待付" rows={groups.thisMonth} emptyHide={false} accent="active" {...groupProps} />
      <PaymentGroup title="下月待付" rows={groups.nextMonth} emptyHide={true} accent="muted" {...groupProps} />
      <PaymentGroup title="未來待付" rows={groups.future} emptyHide={true} accent="muted" {...groupProps} />
      {groups.undated.length > 0 && (
        <PaymentGroup title="未排程（缺尾款日）" rows={groups.undated} emptyHide={false} accent="muted" {...groupProps} />
      )}
      <PaymentGroup title="已付" rows={groups.paid} emptyHide={true} accent="done" defaultCollapsed={true} {...groupProps} />

      {selectedCount > 0 && (
        <div className="pay-floating-toolbar">
          <span className="pay-toolbar-info">已選取 <strong>{selectedCount}</strong> 筆 · 合計 <strong>{fmtNT(selectedTotal)}</strong></span>
          <div className="pay-toolbar-actions">
            <button className="btn btn-ghost" onClick={clearSelection}>取消選取</button>
            <button className="btn btn-primary" onClick={openConfirmModal}>確認付款 →</button>
          </div>
        </div>
      )}

      {modalRows && (
        <ConfirmPaymentModal
          rows={modalRows}
          onCancel={closeModal}
          onConfirm={commitPayment}
          onRemoveRow={(r) => setModalRows(function(prev) { return prev.filter(function(x) { return rowKey(x) !== rowKey(r); }); })}
        />
      )}
    </>
  );
}

function PaymentGroup({ title, rows, emptyHide, accent, showDays, defaultCollapsed, selected, onToggleSelect, undoConfirming, onRequestUndoPaid }) {
  var [collapsed, setCollapsed] = useState(!!defaultCollapsed);
  if (emptyHide && rows.length === 0) return null;
  var total = rows.reduce(function(s, r) { return s + r.amount; }, 0);
  return (
    <div className={'pay-group pay-group-' + (accent || 'muted')}>
      <button className="pay-group-header" onClick={() => setCollapsed(c => !c)} type="button">
        <span className="chevron">{collapsed ? '▸' : '▾'}</span>
        <span className="pay-group-title">{title}</span>
        <span className="pay-group-meta">{rows.length} 筆 · {fmtNT(total)}</span>
      </button>
      {!collapsed && (
        <div className="pay-group-body">
          {rows.length === 0 ? (
            <div className="pay-empty">無</div>
          ) : (
            rows.map(function(r) {
              var k = rowKey(r);
              return (
                <PaymentRow
                  key={k}
                  row={r}
                  showDays={showDays}
                  isSelected={!!(selected && selected[k])}
                  onToggleSelect={onToggleSelect}
                  undoConfirming={undoConfirming === k}
                  onRequestUndoPaid={onRequestUndoPaid}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function PaymentRow({ row, showDays, isSelected, onToggleSelect, undoConfirming, onRequestUndoPaid }) {
  var dateLabel = row.paid
    ? '已付 ' + row.paidDate
    : (row.effDate ? '預估 ' + row.effDate : '無預估日');
  return (
    <div className={'pay-row' + (row.paid ? ' pay-row-paid' : '') + (isSelected ? ' pay-row-selected' : '')}>
      {!row.paid && (
        <button
          className={'pay-checkbox' + (isSelected ? ' checked' : '')}
          onClick={() => onToggleSelect(row)}
          type="button"
          title={isSelected ? '取消選取' : '選取（之後一次確認）'}
        >
          {isSelected ? '✓' : ''}
        </button>
      )}
      {row.paid && <span className="pay-paid-marker" title="已付清">✓</span>}
      <div className="pay-row-main">
        <div className="pay-row-name">
          <span className="pay-outsource-name">{row.outsourceName}</span>
          <span className="pay-project-name">{row.projectTitle}</span>
        </div>
        <div className="pay-row-meta">
          <span className="pay-amount">{fmtNT(row.amount)}</span>
          <span className="pay-date">{dateLabel}</span>
          {showDays && row.daysOverdue > 0 && (
            <span className="pay-overdue">逾期 {row.daysOverdue} 天</span>
          )}
          {row.paid && (
            <button
              className={'pay-undo-btn' + (undoConfirming ? ' confirming' : '')}
              onClick={() => onRequestUndoPaid(row)}
              type="button"
              title={undoConfirming ? '再按一次確認撤銷' : '撤銷已付狀態'}
            >
              {undoConfirming ? '確認撤銷？' : '↺'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PayStat({ label, value, accent, warn }) {
  return (
    <div className={'pay-stat pay-stat-' + (accent || 'default') + (warn ? ' pay-stat-warn' : '')}>
      <span className="pay-stat-label">{label}</span>
      <span className="pay-stat-value">{fmtNT(value)}{warn && <span className="pay-stat-warn-icon">⚠</span>}</span>
    </div>
  );
}

function ConfirmPaymentModal({ rows, onCancel, onConfirm, onRemoveRow }) {
  var todayISO = toISODate(TODAY);
  // 每筆各自帶「表定付款日，但不晚於今天」；要一起改可用上方「全部設為」
  var [dates, setDates] = useState(function() {
    var m = {}; rows.forEach(function(r) { m[rowKey(r)] = defaultActualDate(r.effDate); }); return m;
  });
  var [bulk, setBulk] = useState('');
  var setOne = function(r, d) { setDates(function(prev) { var n = Object.assign({}, prev); n[rowKey(r)] = d; return n; }); };
  var applyBulk = function(d) { setBulk(d); if (!d) return; setDates(function(prev) { var n = Object.assign({}, prev); rows.forEach(function(r) { n[rowKey(r)] = d; }); return n; }); };
  var allFilled = rows.every(function(r) { return !!dates[rowKey(r)]; });
  var total = rows.reduce(function(s, r) { return s + r.amount; }, 0);
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal pay-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">確認以下 {rows.length} 筆已付？</h2>
        {rows.length > 1 && (
          <div className="pay-modal-date">
            <label>全部設為同一天</label>
            <input type="date" className="date-input" value={bulk} onChange={(e) => applyBulk(e.target.value)} />
            <span className="muted" style={{ fontSize: 12 }}>留空＝各筆用自己的表定日</span>
          </div>
        )}
        <div className="pay-modal-list">
          {rows.map(function(r) {
            return (
              <div key={rowKey(r)} className="pay-modal-row">
                <div className="pay-modal-row-name">
                  <span className="pay-outsource-name">{r.outsourceName}</span>
                  <span className="pay-project-name">{r.projectTitle}{r.effDate ? ' · 表定 ' + r.effDate : ''}</span>
                </div>
                <input type="date" className="date-input compact" value={dates[rowKey(r)] || ''} onChange={(e) => setOne(r, e.target.value)} title="實際付款日" />
                <span className="pay-amount">{fmtNT(r.amount)}</span>
                {rows.length > 1 && (
                  <button className="pay-modal-remove" onClick={() => onRemoveRow(r)} type="button" title="從本次確認中移除（不取消勾選）">×</button>
                )}
              </div>
            );
          })}
        </div>
        <div className="pay-modal-total">
          <span>合計</span>
          <strong>{fmtNT(total)}</strong>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>取消</button>
          <button
            className="btn btn-primary"
            disabled={rows.length === 0 || !allFilled}
            onClick={() => onConfirm(rows.map(function(r) { return Object.assign({}, r, { paidDate: dates[rowKey(r)] }); }))}
          >
            全部確認已付
          </button>
        </div>
      </div>
    </div>
  );
}

function FinancePage({ projects, allProjects, settings, onOpenSettings, onUpdateExtraExpenses, onUpdateCustomCategories,
                       onUpdateProject, outsourceRoles, customOutsourceRoles, onUpdateCustomOutsourceRoles,
                       initialDetailId, onConsumeInitialDetail }) {
  // 單案財務視窗：從專案損益表點列打開；也可由專案卡片的「完整損益 →」帶著 id 跳過來
  const [detailId, setDetailId] = useState(null);
  useEffect(() => {
    if (initialDetailId) { setDetailId(initialDetailId); onConsumeInitialDetail && onConsumeInitialDetail(); }
  }, [initialDetailId]);
  const detailProject = detailId ? (allProjects || projects).find(p => p.id === detailId) : null;
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
  // 子分頁：每次點進財務預設是現金流量表；其他報表要看才點，不再全部疊在同一條捲軸上
  const [sub, setSub] = useState(initialDetailId ? 'pnl' : 'cashflow'); // cashflow | pnl | fixed | vat | whatif
  const SUBS = [
    { id: 'cashflow', label: '現金流' },
    { id: 'pnl',      label: '專案損益' },
    { id: 'fixed',    label: '成本分攤' },
    { id: 'vat',      label: '營業稅' },
    { id: 'whatif',   label: '試算' },
  ];

  const monthlyFixed = Number(settings?.monthlyFixedExpense) || 0;
  const allocations = useMemo(
    () => computeFixedCostAllocations(allProjects || projects, monthlyFixed),
    [allProjects, projects, monthlyFixed]
  );
  const overtimeAlloc = useMemo(
    () => computeOvertimeAllocations(allProjects || projects, monthlyFixed),
    [allProjects, projects, monthlyFixed]
  );

  const rows = projects.map(p => {
    const c = calcCosts(p, allocations[p.id], monthlyFixed, overtimeAlloc[p.id]);
    return {
      id: p.id,
      title: p.title,
      client: p.client,
      archived: !!p.archived,
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
        <div className="subnav">
          {SUBS.map(t => (
            <button key={t.id} type="button" className={`subnav-item ${sub === t.id ? 'on' : ''}`} onClick={() => setSub(t.id)}>{t.label}</button>
          ))}
        </div>
        <button className="btn btn-ghost small" onClick={handleExport} title="下載一個 JSON 檔，整理好所有現況讓 Claude 看">
          📥 匯出給 Claude
        </button>
      </div>

      {sub === 'cashflow' && (
        <>
          <CashflowPanel
            series={series}
            hasSettings={hasSettings}
            onOpenSettings={onOpenSettings}
            defaultOpen={true}
          />
          {/* 試算面板也放在圖下面：打額外支出時圖立刻變，不用來回切分頁 */}
          <ExtraExpenseList
            series={series}
            expenses={settings.extraExpenses || []}
            customCategories={settings.customExpenseCategories || []}
            onChange={onUpdateExtraExpenses}
            onUpdateCustomCategories={onUpdateCustomCategories}
          />
        </>
      )}

      {sub === 'vat' && <VatOverviewSection vatPeriods={series?.vatPeriods} />}

      {sub === 'pnl' && (
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
                <div key={r.id} className={`finance-row clickable ${r.archived ? 'is-archived' : ''}`}
                  onClick={() => setDetailId(r.id)} title="點開看這個案子的完整財務計算" role="button" tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailId(r.id); } }}>
                  <div className="finance-name-cell">
                    <div className="finance-title">
                      {r.title}
                      {r.archived && <span className="finance-archived-tag">已歸檔</span>}
                    </div>
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
                <div className="finance-name-cell"><strong>合計（{rows.length} 個案子{rows.filter(r => r.archived).length > 0 ? `，含 ${rows.filter(r => r.archived).length} 個已歸檔` : ''}）</strong></div>
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
      )}

      {sub === 'fixed' && (
        <FixedCostBreakdownSection
          projects={allProjects || projects}
          monthlyFixed={monthlyFixed}
          defaultOpen={true}
        />
      )}

      {sub === 'whatif' && (
        <ExtraExpenseList
          series={series}
          expenses={settings.extraExpenses || []}
          customCategories={settings.customExpenseCategories || []}
          onChange={onUpdateExtraExpenses}
          onUpdateCustomCategories={onUpdateCustomCategories}
        />
      )}

      {detailProject && (
        <ProjectFinanceModal
          project={detailProject}
          allProjects={allProjects || projects}
          onClose={() => setDetailId(null)}
          onUpdate={(p) => onUpdateProject && onUpdateProject(detailProject.id, p)}
          fixedCostShare={allocations[detailProject.id]}
          overtimeShare={overtimeAlloc[detailProject.id]}
          monthlyFixedExpense={monthlyFixed}
          onOpenCashSettings={onOpenSettings}
          outsourceRoles={outsourceRoles}
          customOutsourceRoles={customOutsourceRoles}
          onUpdateCustomOutsourceRoles={onUpdateCustomOutsourceRoles}
        />
      )}
    </>
  );
}

// ---------- 儲存狀態指示器 ----------
// 訂閱 SaveTracker，隨時反映「這台電腦打的東西，進資料庫了沒」。
function useSaveStatus() {
  const [snap, setSnap] = useState(() => SaveTracker.snapshot());
  useEffect(() => SaveTracker.subscribe(setSnap), []);
  // 「3 分鐘前」這種字要會自己走，所以每 20 秒逼它重畫一次
  const [, tick] = useState(0);
  useEffect(() => {
    const h = setInterval(() => tick(n => n + 1), 20000);
    return () => clearInterval(h);
  }, []);
  return snap;
}

function relativeTime(ts) {
  if (!ts) return '';
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 10)   return '剛剛';
  if (secs < 60)   return secs + ' 秒前';
  const mins = Math.floor(secs / 60);
  if (mins < 60)   return mins + ' 分鐘前';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)    return hrs + ' 小時前';
  return Math.floor(hrs / 24) + ' 天前';
}

function SaveIndicator({ settingsError, onReloadPage }) {
  const s = useSaveStatus();

  // 設定載入失敗 → 這是最嚴重的狀態，蓋過一切
  if (settingsError) {
    return (
      <div className="save-indicator is-error" role="status" aria-live="polite">
        <span className="save-dot"></span>
        <span className="save-text">
          <strong>資料載入失敗</strong>
          <span className="save-sub">{settingsError}</span>
        </span>
        <button className="save-action" onClick={onReloadPage}>重新載入</button>
      </div>
    );
  }

  if (s.status === 'error') {
    return (
      <div className="save-indicator is-error" role="status" aria-live="polite">
        <span className="save-dot"></span>
        <span className="save-text">
          <strong>{s.failedCount} 筆變更沒存進去</strong>
          <span className="save-sub">{s.lastError}</span>
        </span>
        <button className="save-action" onClick={() => SaveTracker.retryAll()}>重試</button>
      </div>
    );
  }

  if (s.status === 'saving') {
    return (
      <div className="save-indicator is-saving" role="status" aria-live="polite">
        <span className="save-dot"></span>
        <span className="save-text">儲存中…</span>
      </div>
    );
  }

  if (s.status === 'saved') {
    return (
      <div className="save-indicator is-saved" role="status" aria-live="polite">
        <span className="save-dot"></span>
        <span className="save-text">
          已儲存
          <span className="save-sub">{relativeTime(s.lastSavedAt)}</span>
        </span>
      </div>
    );
  }

  // idle：這次開啟後還沒動過任何東西
  return (
    <div className="save-indicator is-idle" role="status">
      <span className="save-dot"></span>
      <span className="save-text">已連線<span className="save-sub">尚無變更</span></span>
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
  // 登入者 id：App 早就拿到了，直接往下傳，省掉每次讀寫設定都要再打一次驗證請求
  const uid = session?.user?.id;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [projects, _setProjectsRaw] = useState([]);
  const [dataReady, setDataReady] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [tab, setTab] = useState('active'); // 'active' | 'archived'
  const [expanded, setExpanded] = useState(null); // { projectId, stageId }
  const [showNew, setShowNew] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  // globalSettings 的三種狀態，必須分得清楚：
  //   null            → 還在載入（尚未知道內容）
  //   {} 或有內容的物件 → 載入成功
  //   settingsError    → 載入失敗（此時 globalSettings 仍為 null，且禁止任何儲存）
  const [globalSettings, _setGlobalSettingsRaw] = useState(null);
  const [settingsError, setSettingsError] = useState(null);
  const [showCashSettings, setShowCashSettings] = useState(false);
  // ── Undo 堆疊（最多 5 步，同時記錄 projects + globalSettings）──
  const undoStackRef = useRef([]);
  const undoProjectsRef = useRef([]);
  const undoSettingsRef = useRef(null);
  // 鍵盤快捷鍵的 handler 只綁一次，會記住第一次 render 的值，
  // 所以 settingsError 要透過 ref 讀，才拿得到當下的狀態。
  const settingsErrorRef = useRef(null);
  useEffect(() => { settingsErrorRef.current = settingsError; }, [settingsError]);
  useEffect(() => { undoProjectsRef.current = projects; }, [projects]);
  useEffect(() => { undoSettingsRef.current = globalSettings; }, [globalSettings]);
  const dataReadyRef = useRef(false);
  useEffect(() => { dataReadyRef.current = dataReady; }, [dataReady]);
  const pushUndo = () => {
    if (!dataReadyRef.current) return;
    undoStackRef.current.push({
      projects: JSON.parse(JSON.stringify(undoProjectsRef.current)),
      settings: JSON.parse(JSON.stringify(undoSettingsRef.current || {}))
    });
    if (undoStackRef.current.length > 5) undoStackRef.current.shift();
  };
  const setProjects = (updater) => {
    pushUndo();
    _setProjectsRaw(updater);
  };
  const setGlobalSettings = (val) => {
    pushUndo();
    _setGlobalSettingsRaw(val);
  };
  const performUndo = () => {
    if (undoStackRef.current.length === 0) return;
    if (!confirm('確定要復原上一步操作嗎？')) return;
    var prev = undoStackRef.current.pop();
    _setProjectsRaw(prev.projects);
    prev.projects.forEach(function(p) { saveProjectInDB(p); });
    // 設定沒載入成功時不要回寫，否則會用空設定覆蓋資料庫
    if (!settingsErrorRef.current && prev.settings) {
      _setGlobalSettingsRaw(prev.settings);
      saveUserSettings(prev.settings, uid);
    }
  };
  useEffect(() => {
    var handler = function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        performUndo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  const [currentPage, setCurrentPage] = useState('projects'); // 'projects' | 'finance' | 'payments' | 'calendar'
  // 從專案卡片「完整損益 →」跳到財務頁並直接打開該案的視窗
  const [financeDetailId, setFinanceDetailId] = useState(null);
  const openFinanceDetail = (id) => { setFinanceDetailId(id); setCurrentPage('finance'); };
  // 簡報模式：給客戶看畫面時，一鍵把敏感數字收起來——主畫面的合計金額／預估淨利、戰績列、
  // 專案面板的外包區（含金額）。純顯示偏好，存在這台電腦，不進資料庫。
  const PRESENTATION_KEY = 'jt745-presentation';
  const [presentation, setPresentation] = useState(() => {
    try { return localStorage.getItem(PRESENTATION_KEY) === '1' || localStorage.getItem('jt745-hide-profit') === '1'; } catch (e) { return false; }
  });
  const togglePresentation = () => {
    setPresentation(v => {
      try { localStorage.setItem(PRESENTATION_KEY, v ? '0' : '1'); localStorage.removeItem('jt745-hide-profit'); } catch (e) {}
      return !v;
    });
  };
  // 戰績列可以單獨隱藏（跟簡報模式無關）
  const HIDE_TROPHY_KEY = 'jt745-hide-trophy';
  const [hideTrophy, setHideTrophy] = useState(() => {
    try { return localStorage.getItem(HIDE_TROPHY_KEY) === '1'; } catch (e) { return false; }
  });
  const setTrophyHidden = (v) => { setHideTrophy(v); try { localStorage.setItem(HIDE_TROPHY_KEY, v ? '1' : '0'); } catch (e) {} };
  const [sidebarOpen, setSidebarOpen] = useState(false); // 漢堡按鈕控制
  useEffect(() => {
    if (!sidebarOpen) return;
    const onDown = (e) => {
      if (e.target.closest && (e.target.closest('.sidebar') || e.target.closest('.sidebar-toggle'))) return;
      setSidebarOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setSidebarOpen(false); };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey); };
  }, [sidebarOpen]);

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
    loadUserSettings(uid)
      .then(s => { if (!cancelled) { _setGlobalSettingsRaw(s || {}); setSettingsError(null); } })
      .catch(err => {
        if (cancelled) return;
        // 關鍵：失敗時不要退回成 {}。退成 {} 會讓畫面看起來像「資料不見了」，
        // 而且後續任何儲存都會把這份空設定蓋回資料庫，真的把資料洗掉。
        console.error('[loadUserSettings] failed:', err.message);
        setSettingsError(err.message || '無法連線');
      });
    return () => { cancelled = true; };
  }, [uid]);

  const retrySettingsLoad = () => {
    setSettingsError(null);
    loadUserSettings(uid)
      .then(s => { _setGlobalSettingsRaw(s || {}); setSettingsError(null); })
      .catch(err => setSettingsError(err.message || '無法連線'));
  };

  // 設定還沒載入完 / 載入失敗時，一律擋下儲存——否則會用空資料覆蓋資料庫。
  const canWriteSettings = () => {
    if (settingsError) {
      alert('設定尚未成功載入，現在儲存會覆蓋掉資料庫裡原本的資料。\n\n請先按角落的「重新載入」，確認銀行餘額等資料都回來了，再修改。');
      return false;
    }
    if (globalSettings === null) {
      alert('設定還在載入中，請稍等一兩秒再試。');
      return false;
    }
    return true;
  };

  const onSaveCashSettings = (patch) => {
    if (!canWriteSettings()) return;
    const next = { ...globalSettings, ...patch };
    setGlobalSettings(next);
    saveUserSettings(next, uid);
    setShowCashSettings(false);
  };

  const onUpdateExtraExpenses = (nextList) => {
    if (!canWriteSettings()) return;
    const next = { ...globalSettings, extraExpenses: nextList };
    setGlobalSettings(next);
    saveUserSettings(next, uid);
  };

  const onUpdateCustomCategories = (nextList) => {
    if (!canWriteSettings()) return;
    const next = { ...globalSettings, customExpenseCategories: nextList };
    setGlobalSettings(next);
    saveUserSettings(next, uid);
  };

  const onUpdateCustomOutsourceRoles = (nextList) => {
    if (!canWriteSettings()) return;
    const next = { ...globalSettings, customOutsourceRoles: nextList };
    setGlobalSettings(next);
    saveUserSettings(next, uid);
  };

  // 玻璃的動態高光：把游標相對位置寫進該塊玻璃的 CSS 變數（--mx / --my）
  useEffect(() => {
    const SEL = '.card:not(.has-cover), .card-hero, .sidebar, .subnav, .tabs-wrap, .modal, .save-indicator, .pay-overview, .cashflow-panel, .finance-table, .pay-group, .btn.btn-ghost, .sidebar-toggle, .card-right, .stage-labels';
    let raf = 0, ev = null;
    const onMove = (e) => {
      ev = e;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = ev.target && ev.target.closest ? ev.target.closest(SEL) : null;
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (!r.width) return;
        el.style.setProperty('--mx', ((ev.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        el.style.setProperty('--my', ((ev.clientY - r.top) / r.height * 100).toFixed(1) + '%');
      });
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => { document.removeEventListener('pointermove', onMove); if (raf) cancelAnimationFrame(raf); };
  }, []);

  // 有東西還沒存進資料庫就想關視窗 → 攔下來問一次
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!SaveTracker.hasUnsaved()) return;
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // 名言起始畫面：每天第一次打開才顯示（localStorage 記今天顯示過了沒），
  // 按「知道了」或點任何地方就淡出回到專案畫面。
  const QUOTE_SPLASH_KEY = 'jt745-quote-splash-date';
  const [showQuoteSplash, setShowQuoteSplash] = useState(() => {
    try { return localStorage.getItem(QUOTE_SPLASH_KEY) !== toISODate(TODAY); } catch (e) { return false; }
  });
  const [splashClosing, setSplashClosing] = useState(false);
  const closeSplash = () => {
    if (splashClosing) return;
    try { localStorage.setItem(QUOTE_SPLASH_KEY, toISODate(TODAY)); } catch (e) {}
    setSplashClosing(true);
    setTimeout(() => setShowQuoteSplash(false), 450);
  };
  useEffect(() => {
    if (!showQuoteSplash) return;
    const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter') closeSplash(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showQuoteSplash, splashClosing]);

  // 「距上次打開」變化摘要：快照存在這台裝置的瀏覽器（localStorage），
  // 載入完成後跟上次的快照比對，有進步就顯示橫幅。只在載入時跑一次。
  // 「距上次打開」摘要已移除（2026-09-07，使用者決定；里程碑呈現方式之後再議）

  // Celebration: detect completion transitions between renders.
  // prevProjectsRef stays null until the first ready render, so we don't
  // fire confetti for projects that loaded already-completed from the DB.
  const prevProjectsRef = useRef(null);
  useEffect(() => {
    if (!dataReady) return;
    const prev = prevProjectsRef.current;
    prevProjectsRef.current = projects;
    if (prev === null) return; // first ready render — skip

    // 蓋「實際完成日」章：跟彩花共用同一套轉變偵測（決策 5 pattern，集中一處不會漏）。
    // 階段剛變完成 → 蓋 doneAt；取消完成 → 撤章。專案剛到 100% → 蓋 completedAt；跌回去 → 撤章。
    const stampPatches = {}; // projectId -> { stageStamps: {stageId: dateOrNull}, hasProjectStamp, completedAt }

    for (const np of projects) {
      const op = prev.find(p => p.id === np.id);
      if (!op) continue; // brand-new project, nothing to compare

      const oldPct = projectPct(op);
      const newPct = projectPct(np);

      const stageStamps = {};
      for (const ns of np.stages) {
        const os = op.stages.find(s => s.id === ns.id);
        if (!os) continue;
        if (os.status !== 'done' && ns.status === 'done' && !ns.doneAt) stageStamps[ns.id] = toISODate(TODAY);
        if (os.status === 'done' && ns.status !== 'done' && ns.doneAt) stageStamps[ns.id] = null;
      }
      let hasProjectStamp = false, completedAt = null;
      if (oldPct < 100 && newPct === 100 && !np.completedAt) { hasProjectStamp = true; completedAt = toISODate(TODAY); }
      else if (oldPct === 100 && newPct < 100 && np.completedAt) { hasProjectStamp = true; completedAt = null; }
      if (Object.keys(stageStamps).length > 0 || hasProjectStamp) {
        stampPatches[np.id] = { stageStamps, hasProjectStamp, completedAt };
      }

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

    if (Object.keys(stampPatches).length > 0) {
      setProjects(prevP => {
        const next = prevP.map(p => {
          const sp = stampPatches[p.id];
          if (!sp) return p;
          const stamped = {
            ...p,
            stages: p.stages.map(s => (s.id in sp.stageStamps) ? { ...s, doneAt: sp.stageStamps[s.id] } : s),
          };
          if (sp.hasProjectStamp) stamped.completedAt = sp.completedAt;
          return stamped;
        });
        next.forEach(p => { if (stampPatches[p.id]) saveProjectInDB(p); });
        return next;
      });
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
  // 批次更新：一次改多個專案，只壓一筆 undo 紀錄。
  // patches: { [projectId]: patchObject }
  const onBatchUpdateProjects = (patches) => {
    setProjects(prev => {
      const next = prev.map(p => patches[p.id] ? { ...p, ...patches[p.id] } : p);
      // 樂觀寫入：只存有變動的專案
      Object.keys(patches).forEach(pid => {
        const changed = next.find(p => p.id === pid);
        if (changed) saveProjectInDB(changed);
      });
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
    const victim = projects.find(p => p.id === id);
    if (victim && victim.coverPath) deleteCoverImage(victim.coverPath);
    setProjects(prev => prev.filter(p => p.id !== id));
    deleteProjectInDB(id);
    if (expanded?.projectId === id) setExpanded(null);
  };
  const onRestoreProject = (id) => onUpdateProject(id, { deleted: false, deletedAt: null });
  const onArchive = (id) => {
    setProjects(prev => {
      // 「已交件」＝製作結束。deliveredAt 記實際交件日（結算表算工期用這個，不含等尾款的時間）
      const next = prev.map(p => p.id === id
        ? { ...p, archived: true, deliveredAt: p.deliveredAt || p.completedAt || toISODate(TODAY), costsOpen: false, infoOpen: false }
        : p);
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
  // 財務相關的頁面一律吃「所有未刪除的專案」——歸檔只代表「製作結束了」，
  // 不代表那筆錢沒發生過。只有真正刪除的專案才不列入財務計算。
  // （2026-08-27：歸檔後現金流量表數字整片消失，就是這裡誤傳 activeProjects 造成的）
  const financeProjects = projects.filter(p => !p.deleted);
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
  const overtimeAllocations = useMemo(
    () => computeOvertimeAllocations(projects, monthlyFixedExpense),
    [projects, monthlyFixedExpense]
  );

  const totalBudget = activeProjects.reduce((a, p) => a + p.budget, 0);
  const urgentCount = activeProjects.filter(p => {
    const effD = p.extendedDue || p.due;
    const d = effD ? daysBetween(TODAY, new Date(effD)) : null;
    return d !== null && d >= 0 && d <= 14;
  }).length;
  const totalProfit = activeProjects.reduce((a, p) => a + calcCosts(p, fixedCostAllocations[p.id], monthlyFixedExpense, overtimeAllocations[p.id]).profit, 0);

  const expandedProj = expanded ? projects.find(p => p.id === expanded.projectId) : null;

  if (!dataReady) return <SplashScreen message="載入專案中…" />;
  if (loadError) return <SplashScreen message={`讀取失敗：${loadError}`} />;

  return (
    <div className={`app ${showQuoteSplash && !splashClosing ? 'has-splash' : ''}`}>
      {/* 玻璃後面的東西：緩慢流動的中性色暈。玻璃要有東西可以折射、模糊、吸色，才不會像色塊 */}
      <div className="ambient" aria-hidden="true">
        <div className="blob b1" /><div className="blob b2" /><div className="blob b3" /><div className="blob b4" />
      </div>
      {/* 固定在左下角，不分頁面、不隨捲動消失 */}
      <SaveIndicator
        settingsError={settingsError}
        onReloadPage={retrySettingsLoad}
      />
      {showQuoteSplash && (
        <div className={`quote-splash ${splashClosing ? 'closing' : ''}`} onClick={closeSplash}>
          <div className="quote-splash-inner">
            <div className="quote-splash-eyebrow">今日格言</div>
            <div className="quote-splash-text">「{getDailyQuote().text}」</div>
            <div className="quote-splash-author">— {getDailyQuote().author}</div>
            <button className="btn btn-primary quote-splash-btn" onClick={closeSplash}>知道了</button>
          </div>
        </div>
      )}
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
          <button className={`btn btn-ghost btn-icon ${presentation ? 'on' : ''}`} onClick={togglePresentation} title={presentation ? '關閉簡報模式（顯示金額、淨利、戰績、外包）' : '簡報模式：給客戶看畫面時，隱藏合計金額、淨利、戰績列、外包明細'}>
            {presentation ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            )}
          </button>
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


      <div className={`app-body ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        {/* 左欄：三條線在上、導覽選單在下。關閉時左欄只有按鈕那麼寬、疊在內容左上角；
            打開時左欄變 200px，右邊的內容從左邊縮進去（右緣不動）。三條線本身永遠在同一個位置。 */}
        <div className="nav-col">
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(o => !o)}
            title={sidebarOpen ? '關閉導覽' : '開啟導覽'}
            aria-label="切換導覽"
            aria-expanded={sidebarOpen ? 'true' : 'false'}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        <Sidebar
          currentPage={currentPage}
          onChange={(p) => { setCurrentPage(p); setSidebarOpen(false); }}
          counts={{
            projects: activeProjects.length,
            unpaidOutsources: (
              financeProjects.reduce((n, p) => n + (p.outsources || []).filter(o => !isOutsourcePaid(o)).length, 0)
              + buildReceivableRows(financeProjects).filter(r => r.bucket === 'overdue').length
            ) || null,
          }}
        />
        </div>

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
                  {/* 簡報模式：直接不顯示金額，也不放任何字樣（客戶看不出來是刻意藏的）；右上角眼睛鈕反白就是開著 */}
                  {!presentation && (
                    <>
                      <span>合計金額 <strong>{fmtNT(totalBudget)}</strong></span>
                      <span className="sep">·</span>
                      <span>預估淨利 <strong>{fmtNT(totalProfit)}</strong></span>
                      <span className="sep">·</span>
                    </>
                  )}
                  {!presentation && hideTrophy && archivedProjects.length > 0 && (
                    <>
                      <button className="link-btn-inline" onClick={() => setTrophyHidden(false)} type="button">顯示戰績</button>
                      <span className="sep">·</span>
                    </>
                  )}
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
                      : tab === 'archived' ? '尚無已交件專案。達 100% 後按「已交件」的案子會收到這裡；款項還沒收齊的，仍會留在「收付款」頁追蹤。'
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
                      overtimeShare={overtimeAllocations[p.id]}
                      monthlyFixedExpense={monthlyFixedExpense}
                      onOpenCashSettings={() => setShowCashSettings(true)}
                      outsourceRoles={[...DEFAULT_OUTSOURCE_ROLES, ...((globalSettings?.customOutsourceRoles) || [])]}
                      customOutsourceRoles={globalSettings?.customOutsourceRoles || []}
                      onUpdateCustomOutsourceRoles={onUpdateCustomOutsourceRoles}
                      onOpenFullFinance={openFinanceDetail}
                      presentation={presentation}
                      isFocused={focusedProjectId === p.id}
                      anyFocused={!!focusedProjectId}
                      onRestore={onRestoreProject}
                      onPurgeProject={onPurgeProject}
                      onArchive={tab === 'active' ? onArchive : onUnarchive}
                      archiveMode={tab === 'active' ? 'deliver' : 'restore'}
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
              {tab === 'active' && archivedProjects.length > 0 && !presentation && !hideTrophy && (
                <TrophyStrip projects={archivedProjects} onHide={() => setTrophyHidden(true)} />
              )}
            </>
          )}

          {currentPage === 'finance' && (
            <FinancePage
              projects={financeProjects}
              allProjects={projects}
              settings={globalSettings || {}}
              onOpenSettings={() => setShowCashSettings(true)}
              onUpdateExtraExpenses={onUpdateExtraExpenses}
              onUpdateCustomCategories={onUpdateCustomCategories}
              onUpdateProject={onUpdateProject}
              outsourceRoles={[...DEFAULT_OUTSOURCE_ROLES, ...((globalSettings?.customOutsourceRoles) || [])]}
              customOutsourceRoles={globalSettings?.customOutsourceRoles || []}
              onUpdateCustomOutsourceRoles={onUpdateCustomOutsourceRoles}
              initialDetailId={financeDetailId}
              onConsumeInitialDetail={() => setFinanceDetailId(null)}
            />
          )}

          {currentPage === 'payments' && (
            <PaymentsPage
              projects={financeProjects}
              settings={globalSettings || {}}
              onUpdateProject={onUpdateProject}
              onBatchUpdateProjects={onBatchUpdateProjects}
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
          <span className="legend-dot done">已完成</span>
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
