// ─── Seed مستقیم ساپابیس از طریق REST (بدون نیاز به رمز دیتابیس) ───
// همان داده‌های دمو src/lib/seed.ts را با کلید sb_secret در ساپابیس می‌نویسد
// اجرا:  node scripts/seed-supabase-rest.mjs
// ⚠️ امنیت: کلید sb_secret هرگز نباید در کد/گیت باشد — از env یا فایل .env.seeder (gitignore شده) خوانده می‌شود

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// خواندن .env.seeder از ریشه پروژه (در گیت نیست)
function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env.seeder");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"]+)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  }
}
loadEnvFile();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET) {
  console.error("❌ متغیرهای SUPABASE_URL و SUPABASE_SECRET_KEY تنظیم نشده‌اند.");
  console.error("   فایل .env.seeder بسازید یا به‌صورت env بدهید:");
  console.error('   SUPABASE_URL="https://xxx.supabase.co" SUPABASE_SECRET_KEY="sb_secret_..." node scripts/seed-supabase-rest.mjs');
  process.exit(1);
}

const HEADERS = {
  apikey: SUPABASE_SECRET,
  Authorization: `Bearer ${SUPABASE_SECRET}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal,resolution=merge-duplicates",
};

// فراداده ستون‌ها از OpenAPI ساپابیس — برای پر کردن کلیدهای جاافتاده با مقدار مجاز
let colMeta = null;
async function loadColumnMeta() {
  if (colMeta) return colMeta;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, { headers: { apikey: SUPABASE_SECRET, Authorization: `Bearer ${SUPABASE_SECRET}` } });
  const spec = await res.json();
  colMeta = {};
  for (const [table, def] of Object.entries(spec.definitions || {})) {
    const required = new Set(def.required || []);
    colMeta[table] = {};
    for (const [col, prop] of Object.entries(def.properties || {})) {
      colMeta[table][col] = { nullable: !required.has(col), format: prop.format || prop.type, default: prop.default };
    }
  }
  return colMeta;
}

function fillValue(meta, keys, row, table) {
  const out = {};
  for (const k of keys) {
    if (row[k] !== undefined) { out[k] = row[k]; continue; }
    const m = meta?.[table]?.[k];
    if (m?.nullable) { out[k] = null; continue; }
    if (m && m.default !== undefined && m.default !== null && typeof m.default !== "object" && !/now\(\)|CURRENT/i.test(String(m.default))) {
      out[k] = m.default; continue; // پیش‌فرض واقعی دیتابیس
    }
    if (m && /text|character|varchar|string/i.test(m.format)) { out[k] = ""; continue; }
    throw new Error(`ستون «${k}» جدول ${table} مقدار ندارد و nullable هم نیست`);
  }
  return out;
}

async function rest(table, rows) {
  if (!rows || rows.length === 0) return;
  // PostgREST: همه آبجکت‌ها باید کلیدهای یکسان داشته باشند → کلیدهای جاافتاده با پیش‌فرض مجاز پر می‌شوند
  const meta = await loadColumnMeta();
  const allKeys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const normalized = rows.map((r) => fillValue(meta, allKeys, r, table));
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(normalized),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`REST insert failed [${table}] ${res.status}: ${text.slice(0, 500)}`);
  }
  console.log(`  ✓ ${table}: ${rows.length} ردیف`);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const day = 86400000;
const d = (offsetDays) => new Date(Date.now() + offsetDays * day).toISOString();
const iso = (dt) => dt; // رشته ISO

const tenantId = "sd_tenant";
const T = { id: tenantId };

// ─── ۱) پرمیشن‌ها ───
const permCatalog = [
  ["dashboard.view", "مشاهده داشبورد و شاخص‌ها", "داشبورد"],
  ["reports.pnl", "گزارش سود و زیان", "داشبورد"],
  ["persons.manage", "مدیریت اشخاص", "اشخاص"],
  ["persons.view", "مشاهده اشخاص", "اشخاص"],
  ["teams.manage", "مدیریت اکیپ‌ها و چک ضمانت", "اشخاص"],
  ["teams.view", "مشاهده اکیپ‌ها", "اشخاص"],
  ["projects.manage", "ایجاد و مدیریت پروژه", "پروژه‌ها"],
  ["projects.view", "مشاهده پروژه‌ها", "پروژه‌ها"],
  ["contracts.manage", "ایجاد و مدیریت قرارداد", "پروژه‌ها"],
  ["contracts.view", "مشاهده قراردادها", "پروژه‌ها"],
  ["tasks.viewAll", "مشاهده همه وظایف", "عملیات"],
  ["tasks.own", "مشاهده وظایف خود", "عملیات"],
  ["tasks.manage", "ایجاد و تخصیص وظیفه", "عملیات"],
  ["worklogs.create", "ثبت کارکرد با شواهد", "عملیات"],
  ["material.balance", "ثبت تراز مصالح", "عملیات"],
  ["material.view", "مشاهده مصالح و تراز", "عملیات"],
  ["approvals.decide", "تأیید/رد نهایی تاییدیه‌ها", "مرکز عملیات"],
  ["approvals.request", "ثبت درخواست تسویه", "مرکز عملیات"],
  ["finance.manage", "مدیریت مالی", "مالی"],
  ["finance.view", "مشاهده مالی", "مالی"],
  ["payments.link", "صدور لینک پرداخت", "مالی"],
  ["commissions.view", "مشاهده پورسانت‌ها", "مالی"],
  ["accounting.sync", "همگام‌سازی حسابداری", "مالی"],
  ["escalations.view", "کارتابل ارجاعات", "پیگیری"],
  ["escalations.handle", "ثبت نتیجه تماس", "پیگیری"],
  ["settings.manage", "مدیریت تنظیمات", "تنظیمات"],
  ["settings.roles", "مدیریت نقش‌ها و دسترسی", "تنظیمات"],
];
const P = Object.fromEntries(permCatalog.map(([key]) => [key, `sd_perm_${key.replace(/\./g, "_")}`]));

// ─── ۲) نقش‌ها ───
const roleSeeds = [
  ["MANAGER", "مدیر", "کنترل کامل سیستم؛ تأیید نهایی مالی؛ گزارش سود و زیان", permCatalog.map((p) => p[0])],
  ["SECRETARY", "منشی", "کارتابل ارجاعات، ثبت نتیجه تماس، پیگیری اقساط", ["dashboard.view", "persons.view", "teams.view", "projects.view", "contracts.view", "tasks.viewAll", "escalations.view", "escalations.handle", "finance.view"]],
  ["SUPERVISOR", "سرپرست کارگاه", "نمای موبایل وظایف، ثبت کارکرد و تراز مصالح با شواهد", ["tasks.own", "worklogs.create", "material.balance", "material.view", "projects.view", "persons.view"]],
  ["ACCOUNTANT", "حسابدار", "ماژول مالی، همگام‌سازی حسابفاری، خروجی اسناد", ["dashboard.view", "finance.manage", "finance.view", "payments.link", "commissions.view", "accounting.sync", "reports.pnl", "projects.view", "contracts.view", "persons.view"]],
  ["MARKETER", "بازاریاب", "پروژه‌های خودش و وضعیت پورسانت", ["projects.view", "contracts.view", "commissions.view", "persons.view"]],
  ["TEAM", "اکیپ اجرایی", "مشاهده قرارداد و تسویه خود، ثبت مستندات", ["contracts.view", "projects.view", "finance.view"]],
];
const R = Object.fromEntries(roleSeeds.map(([key]) => [key, `sd_role_${key}`]));

// ─── ۳) اشخاص (همه ردیف‌ها کلیدهای یکسان — ستون‌های NOT NULL با '' پر می‌شوند) ───
const personBase = { tenantId: tenantId, nationalId: "", address: "", marketerCode: "", notes: "", defaultPercent: null, isActive: true };
const persons = {
  employer1: { ...personBase, id: "sd_p_employer1", type: "EMPLOYER", fullName: "آقای رضا محمدی", phone: "09121234567", address: "تهران، سعادت‌آباد" },
  employer2: { ...personBase, id: "sd_p_employer2", type: "EMPLOYER", fullName: "خانواده املاک کیان", phone: "02188776655", address: "تهران، ونک" },
  supervisor1: { ...personBase, id: "sd_p_supervisor1", type: "SUPERVISOR", fullName: "علی رضایی", phone: "09132345678", nationalId: "0012345678" },
  supervisor2: { ...personBase, id: "sd_p_supervisor2", type: "SUPERVISOR", fullName: "حسن کریمی", phone: "09193456789" },
  marketer1: { ...personBase, id: "sd_p_marketer1", type: "MARKETER", fullName: "مریم صادقی", phone: "09124567890", marketerCode: "MK-101", defaultPercent: 3 },
  teamLeader1: { ...personBase, id: "sd_p_leader1", type: "TEAM_LEADER", fullName: "مهدی قاسمی", phone: "09125678901" },
  teamLeader2: { ...personBase, id: "sd_p_leader2", type: "TEAM_LEADER", fullName: "اکبر نوروزی", phone: "09126789012" },
  member1: { ...personBase, id: "sd_p_member1", type: "OTHER", fullName: "سعید احمدی (لوله‌کش)", phone: "09301112233" },
  member2: { ...personBase, id: "sd_p_member2", type: "OTHER", fullName: "جواد فتحی (برق‌کار)", phone: "09302223344" },
};

async function main() {
  console.log(`🌱 Seed ساپابیس: ${SUPABASE_URL}`);

  // پاکسازی داده قبلی دمو (به‌ترتیب وابستگی) تا اجرای مجدد ممکن باشد
  const clearOrder = ["WorkLogEvidence", "WorkLog", "MaterialBalance", "MaterialReceipt", "Task", "Approval", "PaymentLink", "Payment", "ContractInstallment", "MaterialItem", "Commission", "CommissionTier", "Contract", "Phase", "Project", "TeamMember", "Team", "GuaranteeCheck", "ServiceLine", "User", "Escalation", "Notification", "CallLog", "SmsTemplate", "Setting", "_RolePermissions", "Role", "Permission", "Person", "Tenant"];
  for (const t of clearOrder) {
    const col = t === "_RolePermissions" ? "A" : "id";
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${t}?${col}=neq.__never__`, { method: "DELETE", headers: HEADERS });
    if (!res.ok) throw new Error(`clear ${t} failed: ${res.status} ${await res.text()}`);
  }
  console.log("  ✓ پاکسازی داده قبلی");

  await rest("Tenant", [{ id: tenantId, name: "شرکت تأسیسات نمونه (دمو)", slug: "demo" }]);
  await rest("Permission", permCatalog.map(([key, name, module]) => ({ id: P[key], key, name, module })));

  await rest("Role", roleSeeds.map(([key, name, description]) => ({
    id: R[key], tenantId: tenantId, key, name, description, isSystem: true,
  })));

  const rolePerms = [];
  for (const [key, , , perms] of roleSeeds) {
    for (const p of perms) rolePerms.push({ A: P[p], B: R[key] });
  }
  await rest("_RolePermissions", rolePerms);

  await rest("Person", Object.values(persons));

  await rest("Team", [
    { id: "sd_team1", tenantId: tenantId, name: "اکیپ لوله‌کشی قاسمی", leaderId: persons.teamLeader1.id, notes: "تخصص: لوله‌کشی آب و گاز" },
    { id: "sd_team2", tenantId: tenantId, name: "اکیپ برق نوروزی", leaderId: persons.teamLeader2.id, notes: "تخصص: برق و آتش‌نشانی" },
  ]);
  await rest("TeamMember", [
    { id: "sd_tm1a", teamId: "sd_team1", personId: persons.teamLeader1.id, role: "LEADER" },
    { id: "sd_tm1b", teamId: "sd_team1", personId: persons.member1.id, role: "MEMBER" },
    { id: "sd_tm2a", teamId: "sd_team2", personId: persons.teamLeader2.id, role: "LEADER" },
    { id: "sd_tm2b", teamId: "sd_team2", personId: persons.member2.id, role: "MEMBER" },
  ]);

  await rest("Payment", [
    { id: "sd_pay1", tenantId: tenantId, amount: 540000000, method: "TRANSFER", status: "SUCCESS", paidAt: d(-49), gatewayRef: "TRF-88121", note: "پیش‌پرداخت برج آرمان" },
    { id: "sd_pay2", tenantId: tenantId, amount: 285000000, method: "GATEWAY", status: "SUCCESS", paidAt: d(-25), gatewayRef: "SHAPARAK-A1B2C", note: "پیش‌پرداخت مجتمع کیان" },
  ]);

  await rest("GuaranteeCheck", [
    { id: "sd_chk1", tenantId: tenantId, personId: persons.teamLeader1.id, checkNumber: "CHK-770121", amount: 200000000, bankName: "ملت", dueDate: d(45), status: "VALID", notes: "چک ضمانت حسن انجام کار" },
    { id: "sd_chk2", tenantId: tenantId, personId: persons.teamLeader2.id, checkNumber: "CHK-880455", amount: 150000000, bankName: "صادرات", dueDate: d(12), status: "VALID", notes: "نیازمند تمدید" },
  ]);

  await rest("ServiceLine", [
    { id: "sd_line_wtr", tenantId: tenantId, name: "آب و لوله‌کشی", code: "WTR" },
    { id: "sd_line_elc", tenantId: tenantId, name: "برق", code: "ELC" },
    { id: "sd_line_gas", tenantId: tenantId, name: "گاز", code: "GAS" },
    { id: "sd_line_fir", tenantId: tenantId, name: "آتش‌نشانی", code: "FIR" },
    { id: "sd_line_pex", tenantId: tenantId, name: "پلی‌اتیلن", code: "PEX" },
  ]);

  await rest("Project", [
    { id: "sd_prj1", tenantId: tenantId, name: "برج مسکونی آرمان", code: "PRJ-1403-01", employerId: persons.employer1.id, supervisorId: persons.supervisor1.id, serviceLineId: "sd_line_wtr", address: "تهران، بلوار کشاورز", status: "ACTIVE", startDate: d(-60), endDate: d(90), budget: 4500000000 },
    { id: "sd_prj2", tenantId: tenantId, name: "مجتمع تجاری کیان", code: "PRJ-1403-02", employerId: persons.employer2.id, supervisorId: persons.supervisor2.id, serviceLineId: "sd_line_elc", address: "تهران، ونک", status: "ACTIVE", startDate: d(-30), endDate: d(120), budget: 2800000000 },
    { id: "sd_prj3", tenantId: tenantId, name: "ویلای لواسان", code: "PRJ-1403-03", employerId: persons.employer1.id, supervisorId: persons.supervisor1.id, serviceLineId: "sd_line_gas", address: "لواسان", status: "ACTIVE", startDate: d(-15), endDate: d(60), budget: 900000000 },
  ]);

  await rest("Phase", [
    { id: "sd_ph1a", projectId: "sd_prj1", title: "لوله‌کشی اصلی آب", order: 1, status: "DONE", startDate: d(-60), endDate: d(-10) },
    { id: "sd_ph1b", projectId: "sd_prj1", title: "لوله‌کشی فرعی طبقات", order: 2, status: "IN_PROGRESS", startDate: d(-10) },
    { id: "sd_ph1c", projectId: "sd_prj1", title: "تست و تحویل", order: 3, status: "PENDING" },
    { id: "sd_ph2a", projectId: "sd_prj2", title: "سیم‌کشی اصلی", order: 1, status: "IN_PROGRESS", startDate: d(-30) },
    { id: "sd_ph2b", projectId: "sd_prj2", title: "تابلو برق", order: 2, status: "PENDING" },
    { id: "sd_ph3a", projectId: "sd_prj3", title: "انشعاب گاز", order: 1, status: "IN_PROGRESS", startDate: d(-15) },
  ]);

  await rest("Contract", [
    { id: "sd_ctr1", tenantId: tenantId, projectId: "sd_prj1", type: "WITH_MATERIALS", signingMode: "MULTI", title: "قرارداد لوله‌کشی کامل برج آرمان", amount: 1800000000, marketerId: persons.marketer1.id, startDate: d(-55), endDate: d(80), status: "ACTIVE", notes: "قرارداد بامصالح؛ سد سخت تراز مصالح فعال است" },
    { id: "sd_ctr2", tenantId: tenantId, projectId: "sd_prj2", type: "WAGE", signingMode: "SINGLE", title: "قرارداد دستمزدی سیم‌کشی مجتمع کیان", amount: 950000000, marketerId: persons.marketer1.id, startDate: d(-28), endDate: d(110), status: "ACTIVE" },
    { id: "sd_ctr3", tenantId: tenantId, projectId: "sd_prj3", type: "WAGE", signingMode: "SINGLE", title: "قرارداد انشعاب گاز ویلا", amount: 320000000, startDate: d(-12), endDate: d(45), status: "ACTIVE" },
  ]);

  await rest("MaterialItem", [
    { id: "sd_mi1a", tenantId: tenantId, contractId: "sd_ctr1", name: "لوله پنج‌لایه سایز ۲۵", unit: "شاخه", unitPrice: 850000, plannedQty: 120 },
    { id: "sd_mi1b", tenantId: tenantId, contractId: "sd_ctr1", name: "سه‌راه پنج‌لایه", unit: "عدد", unitPrice: 320000, plannedQty: 200 },
    { id: "sd_mi1c", tenantId: tenantId, contractId: "sd_ctr1", name: "کلکتور برنجی", unit: "عدد", unitPrice: 1500000, plannedQty: 24 },
  ]);

  await rest("ContractInstallment", [
    { id: "sd_ins1a", tenantId: tenantId, contractId: "sd_ctr1", title: "پیش‌پرداخت (۳۰٪)", amount: 540000000, dueDate: d(-50), status: "PAID", paidAt: d(-49) },
    { id: "sd_ins1b", tenantId: tenantId, contractId: "sd_ctr1", title: "قسط دوم پس از لوله‌کشی اصلی", amount: 630000000, dueDate: d(-2) },
    { id: "sd_ins1c", tenantId: tenantId, contractId: "sd_ctr1", title: "قسط سوم پس از فرعی طبقات", amount: 630000000, dueDate: d(30) },
    { id: "sd_ins2a", tenantId: tenantId, contractId: "sd_ctr2", title: "پیش‌پرداخت", amount: 285000000, dueDate: d(-25), status: "PAID", paidAt: d(-25) },
    { id: "sd_ins2b", tenantId: tenantId, contractId: "sd_ctr2", title: "قسط دوم", amount: 332500000, dueDate: d(-6) },
    { id: "sd_ins2c", tenantId: tenantId, contractId: "sd_ctr2", title: "تسویه نهایی", amount: 332500000, dueDate: d(60) },
    { id: "sd_ins3a", tenantId: tenantId, contractId: "sd_ctr3", title: "پرداخت کامل", amount: 320000000, dueDate: d(20) },
  ]);

  await rest("MaterialReceipt", [
    { id: "sd_mr1", tenantId: tenantId, contractId: "sd_ctr1", materialItemId: "sd_mi1a", qty: 90, receivedAt: d(-40) },
    { id: "sd_mr2", tenantId: tenantId, contractId: "sd_ctr1", materialItemId: "sd_mi1b", qty: 120, receivedAt: d(-38) },
    { id: "sd_mr3", tenantId: tenantId, contractId: "sd_ctr1", materialItemId: "sd_mi1c", qty: 12, receivedAt: d(-35) },
  ]);

  await rest("WorkLog", [
    { id: "sd_wl1", tenantId: tenantId, projectId: "sd_prj1", contractId: "sd_ctr1", phaseId: "sd_ph1a", teamId: "sd_team1", personId: persons.supervisor1.id, date: d(-12), description: "تکمیل لوله‌کشی اصلی آب و تست فشار", status: "APPROVED", tariffType: "METERED", rate: 2500000, quantity: 96, computedAmount: 240000000, approvedById: "system", approvedAt: d(-11) },
    { id: "sd_wl2", tenantId: tenantId, projectId: "sd_prj1", contractId: "sd_ctr1", phaseId: "sd_ph1b", teamId: "sd_team1", personId: persons.supervisor1.id, date: d(-3), description: "پیشرفت ۶۰ درصدی لوله‌کشی فرعی طبقات", status: "PENDING", tariffType: "METERED", rate: 2500000, quantity: 60, computedAmount: 0 },
    { id: "sd_wl3", tenantId: tenantId, projectId: "sd_prj2", contractId: "sd_ctr2", phaseId: "sd_ph2a", teamId: "sd_team2", personId: persons.supervisor2.id, date: d(-5), description: "سیم‌کشی طبقات ۱ تا ۳ + تنخواه خرید مستربری", status: "APPROVED", tariffType: "BASE_PLUS_EXTRA", baseAmount: 80000000, extraUnits: 2, extraRate: 5000000, computedAmount: 90000000, approvedById: "system", approvedAt: d(-4) },
  ]);

  await rest("WorkLogEvidence", [
    { id: "sd_wle1", workLogId: "sd_wl1", kind: "PHOTO", title: "عکس مسیر لوله‌کشی طبقه همکف", value: "" },
    { id: "sd_wle2", workLogId: "sd_wl1", kind: "LOCATION", title: "لوکیشن کارگاه", value: "35.7448,51.3753" },
    { id: "sd_wle3", workLogId: "sd_wl1", kind: "INVOICE", title: "فاکتور تست فشار", value: "" },
  ]);

  await rest("MaterialBalance", [
    { id: "sd_mb1", tenantId: tenantId, contractId: "sd_ctr1", phaseId: "sd_ph1a", materialItemId: "sd_mi1a", consumedQty: 88, surplusQty: 2, shortageQty: 0, notes: "۲ شاخه مازاد به انبار برگشت" },
    { id: "sd_mb2", tenantId: tenantId, contractId: "sd_ctr1", phaseId: "sd_ph1a", materialItemId: "sd_mi1b", consumedQty: 61, surplusQty: 0, shortageQty: 2, notes: "۲ عدد سه‌راه شکسته؛ کسر از دستمزد" },
    { id: "sd_mb3", tenantId: tenantId, contractId: "sd_ctr1", phaseId: "sd_ph1a", materialItemId: "sd_mi1c", consumedQty: 8, surplusQty: 0, shortageQty: 0 },
  ]);

  await rest("Task", [
    { id: "sd_task1", tenantId: tenantId, projectId: "sd_prj1", contractId: "sd_ctr1", assigneePersonId: persons.supervisor1.id, title: "ثبت تراز مصالح مرحله لوله‌کشی اصلی", description: "گزارش مصرف، مازاد و کسری سه قلم مصالح", dueDate: d(-2), status: "IN_PROGRESS", priority: "HIGH" },
    { id: "sd_task2", tenantId: tenantId, projectId: "sd_prj1", contractId: "sd_ctr1", assigneePersonId: persons.supervisor1.id, title: "بازدید از پیشرفت لوله‌کشی طبقات ۴ تا ۷", description: "گزارش عکس‌دار", dueDate: d(1), status: "TODO", priority: "NORMAL" },
    { id: "sd_task3", tenantId: tenantId, projectId: "sd_prj2", contractId: "sd_ctr2", assigneePersonId: persons.supervisor2.id, title: "رفع مغایرت تابلو برق طبقه ۲", description: "هماهنگی با پیمانکار تابلو", dueDate: d(-3), status: "BLOCKED", priority: "CRITICAL" },
    { id: "sd_task4", tenantId: tenantId, projectId: "sd_prj3", contractId: "sd_ctr3", assigneePersonId: persons.supervisor1.id, title: "هماهنگی بازدید شرکت گاز", description: "تعیین وقت با اداره گاز لواسان", dueDate: d(2), status: "TODO", priority: "NORMAL" },
  ]);

  await rest("CommissionTier", [
    { id: "sd_ct1", tenantId: tenantId, label: "پلکان ۱ — تا ۵۰۰ میلیون", minAmount: 0, maxAmount: 500000000, percent: 2, order: 1 },
    { id: "sd_ct2", tenantId: tenantId, label: "پلکان ۲ — ۵۰۰ میلیون تا ۱ میلیارد", minAmount: 500000000, maxAmount: 1000000000, percent: 3, order: 2 },
    { id: "sd_ct3", tenantId: tenantId, label: "پلکان ۳ — بالای ۱ میلیارد", minAmount: 1000000000, maxAmount: null, percent: 5, order: 3 },
  ]);

  await rest("Commission", [
    { id: "sd_com1", tenantId: tenantId, contractId: "sd_ctr1", marketerId: persons.marketer1.id, contractAmount: 1800000000, percent: 5, totalAmount: 90000000, signPart: 45000000, signPaid: true, collectionTarget: 45000000, status: "PARTIAL" },
    { id: "sd_com2", tenantId: tenantId, contractId: "sd_ctr2", marketerId: persons.marketer1.id, contractAmount: 950000000, percent: 3, totalAmount: 28500000, signPart: 14250000, signPaid: true, collectionTarget: 14250000, status: "PARTIAL" },
  ]);

  const settings = [
    ["INSTALLMENT_SMS2_HOURS", "48", "ESCALATION", "فاصله یادآور دوم قسط (ساعت)"],
    ["INSTALLMENT_ESCALATE_HOURS", "96", "ESCALATION", "مهلت ارجاع قسط به منشی (ساعت)"],
    ["TASK_DUE_SOON_HOURS", "24", "ESCALATION", "هشدار موعد وظیفه (ساعت قبل)"],
    ["TASK_CRITICAL_HOURS", "24", "ESCALATION", "آستانه تاخیر بحرانی وظیفه (ساعت)"],
    ["BALANCE_ALARM_HOURS", "72", "ESCALATION", "آلارم عدم ثبت تراز پس از اتمام کار (ساعت)"],
    ["CHECK_WARN_30_DAYS", "30", "ESCALATION", "هشدار اول چک ضمانت (روز)"],
    ["CHECK_WARN_15_DAYS", "15", "ESCALATION", "هشدار دوم چک ضمانت (روز)"],
    ["COMMISSION_SIGN_SHARE", "50", "COMMISSION", "سهم پورسانت هنگام عقد قرارداد (٪)"],
    ["COMMISSION_FIXED_BONUS", "0", "COMMISSION", "پاداش ثابت پورسانت (ریال)"],
    ["COMPANY_NAME", "شرکت تأسیسات نمونه", "GENERAL", "نام شرکت"],
    ["GATEWAY_NAME", "درگاه شاپرک (شبیه‌سازی)", "FINANCE", "درگاه پرداخت"],
    ["ACCOUNTING_SOFTWARE", "حسابفاری (Hesabfa)", "FINANCE", "نرم‌افزار حسابداری"],
  ];
  await rest("Setting", settings.map(([key, value, group, label]) => ({
    id: `sd_set_${key}`, tenantId: tenantId, key, value, group, label,
  })));

  await rest("SmsTemplate", [
    { id: "sd_sms_r1", tenantId: tenantId, key: "INSTALLMENT_REMINDER_1", label: "یادآوری اول قسط کارفرما", body: "{name} گرامی، قسط {amount} ریالی پروژه {project} سررسید شده است. جهت پرداخت آنلاین: {link}\nشرکت تأسیسات نمونه" },
    { id: "sd_sms_r2", tenantId: tenantId, key: "INSTALLMENT_REMINDER_2", label: "یادآوری دوم قسط", body: "{name} گرامی، یادآوری مجدد: قسط {amount} ریالی پروژه {project} همچنان پرداخت نشده است. {link}" },
    { id: "sd_sms_td", tenantId: tenantId, key: "TASK_DUE", label: "یادآوری موعد وظیفه سرپرست", body: "{name}، وظیفه «{title}» در پروژه {project} تا تاریخ {date} سررسید می‌شود. لطفاً اقدام فرمایید." },
    { id: "sd_sms_ba", tenantId: tenantId, key: "BALANCE_ALERT", label: "هشدار عدم ثبت تراز مصالح", body: "{name}، تراز مصالح قرارداد «{contract}» در پروژه {project} ثبت نشده و تسویه اکیپ مسدود است." },
    { id: "sd_sms_ce", tenantId: tenantId, key: "CHECK_EXPIRY", label: "هشدار سررسید چک ضمانت اکیپ", body: "چک ضمانت {name} در تاریخ {date} سررسید می‌شود. لطفاً نسبت به تمدید اقدام شود." },
  ]);

  await rest("User", [
    { id: "sd_user_manager", tenantId: tenantId, username: "manager", fullName: "مدیر سیستم", passwordHash: hashPassword("1234"), roleId: R.MANAGER, personId: null },
    { id: "sd_user_secretary", tenantId: tenantId, username: "secretary", fullName: "منشی شرکت", passwordHash: hashPassword("1234"), roleId: R.SECRETARY, personId: null },
    { id: "sd_user_supervisor", tenantId: tenantId, username: "supervisor", fullName: "علی رضایی (سرپرست)", passwordHash: hashPassword("1234"), roleId: R.SUPERVISOR, personId: persons.supervisor1.id },
    { id: "sd_user_accountant", tenantId: tenantId, username: "accountant", fullName: "حسابدار شرکت", passwordHash: hashPassword("1234"), roleId: R.ACCOUNTANT, personId: null },
    { id: "sd_user_marketer", tenantId: tenantId, username: "marketer", fullName: "مریم صادقی (بازاریاب)", passwordHash: hashPassword("1234"), roleId: R.MARKETER, personId: persons.marketer1.id },
    { id: "sd_user_team", tenantId: tenantId, username: "team", fullName: "مهدی قاسمی (اکیپ)", passwordHash: hashPassword("1234"), roleId: R.TEAM, personId: persons.teamLeader1.id },
  ]);

  // ─── راستی‌آزمایی ───
  const verify = await fetch(`${SUPABASE_URL}/rest/v1/User?select=username,fullName`, { headers: { apikey: SUPABASE_SECRET, Authorization: `Bearer ${SUPABASE_SECRET}` } });
  const users = await verify.json();
  console.log("\n✅ Seed کامل شد! کاربران:", users.map((u) => u.username).join(" / "));
  console.log("   رمز همه: 1234");
}

main().catch((e) => {
  console.error("❌ خطا:", e.message);
  process.exit(1);
});
