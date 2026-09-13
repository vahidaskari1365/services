// تست دود سراسری — ورود دمو، مدیریت کاربران، گزارش‌ساز، آرشیو اسناد
const BASE = "http://localhost:3100";

async function j(url, opts = {}) {
  const res = await fetch(BASE + url, opts);
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("json") ? await res.json() : await res.text();
  return { status: res.status, data, res };
}

let pass = 0, fail = 0;
function check(name, ok, extra = "") {
  if (ok) { pass++; console.log("✓", name); }
  else { fail++; console.log("✗ FAIL:", name, extra); }
}

(async () => {
  // 1) ورود بدون رمز مدیر
  const login = await j("/api/auth/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roleKey: "MANAGER" }) });
  check("demo login MANAGER", login.status === 200 && login.data.token, JSON.stringify(login.data).slice(0, 120));
  const H = { "Content-Type": "application/json", "x-session-token": login.data.token };

  // 2) لیست کاربران و نقش‌ها
  const users = await j("/api/users", { headers: H });
  check("GET /api/users", users.status === 200 && Array.isArray(users.data.users) && users.data.users.length >= 6, JSON.stringify(users.data).slice(0, 120));
  check("users has users.manage permission roles", Array.isArray(users.data.roles) && users.data.roles.length === 6);

  // 3) ایجاد کاربر جدید
  const created = await j("/api/users", { method: "POST", headers: H, body: JSON.stringify({ username: "test.user", fullName: "کاربر تستی سامانه", password: "test1234", roleId: users.data.roles.find(r => r.key === "SECRETARY").id }) });
  check("POST /api/users create", created.status === 200 && created.data.ok, JSON.stringify(created.data).slice(0, 150));
  const newUserId = created.data?.user?.id;

  // 4) نام کاربری تکراری باید رد شود
  const dup = await j("/api/users", { method: "POST", headers: H, body: JSON.stringify({ username: "test.user", fullName: "تکراری", password: "test1234", roleId: users.data.roles[0].id }) });
  check("duplicate username rejected", dup.status === 400);

  // 5) بازنشانی رمز + غیرفعال‌سازی
  const patch = await j(`/api/users/${newUserId}`, { method: "PATCH", headers: H, body: JSON.stringify({ password: "newpass99", isActive: false }) });
  check("PATCH user (reset pw + deactivate)", patch.status === 200 && patch.data.ok, JSON.stringify(patch.data).slice(0, 150));

  // 6) غیرفعال‌سازی خود کاربر باید رد شود
  const selfDeact = await j(`/api/users/${login.data.user.id}`, { method: "PATCH", headers: H, body: JSON.stringify({ isActive: false }) });
  check("self-deactivation rejected", selfDeact.status === 400);

  // 7) لاگین با کاربر غیرفعال باید رد شود
  const deactivated = await j("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "test.user", password: "newpass99" }) });
  check("deactivated user cannot login", deactivated.status === 403 || deactivated.status === 401 || deactivated.data.error);

  // 8) گزارش‌ساز — فهرست دیتاست‌ها
  const meta = await j("/api/reports/builder", { headers: H });
  check("GET /api/reports/builder meta", meta.status === 200 && meta.data.datasets.length === 7, JSON.stringify(meta.data.datasets));

  // 9) گزارش اقساط
  const inst = await j("/api/reports/builder", { method: "POST", headers: H, body: JSON.stringify({ dataset: "installments", period: "all" }) });
  check("builder installments rows", inst.status === 200 && Array.isArray(inst.data.rows) && inst.data.rows.length > 0 && inst.data.columns.length === 7, `rows=${inst.data?.rows?.length}`);

  // 10) گزارش پرداخت‌ها با فیلتر پروژه
  const pay = await j("/api/reports/builder", { method: "POST", headers: H, body: JSON.stringify({ dataset: "payments", period: "y1" }) });
  check("builder payments rows", pay.status === 200 && Array.isArray(pay.data.rows), `rows=${pay.data?.rows?.length}`);

  // 11) گزارش کارکردها + وظایف + پورسانت + پروژه‌ها + قراردادها
  for (const ds of ["worklogs", "tasks", "commissions", "projects", "contracts"]) {
    const r = await j("/api/reports/builder", { method: "POST", headers: H, body: JSON.stringify({ dataset: ds, period: "all" }) });
    check(`builder ${ds}`, r.status === 200 && Array.isArray(r.data.rows));
  }

  // 12) آرشیو اسناد — آپلود فایل تستی
  const form = new FormData();
  const fileContent = "سلام — این یک سند آزمایشی است.";
  form.set("file", new Blob([fileContent], { type: "text/plain" }), "test-doc.txt");
  form.set("title", "سند آزمایشی");
  form.set("category", "REPORT");
  const projId = (await j("/api/projects", { headers: H })).data.projects[0]?.id;
  if (projId) form.set("projectId", projId);
  const upload = await j("/api/documents", { method: "POST", headers: { "x-session-token": login.data.token }, body: form });
  check("POST /api/documents upload", upload.status === 200 && upload.data.ok, JSON.stringify(upload.data).slice(0, 150));
  const docId = upload.data?.document?.id;

  // 13) فهرست اسناد
  const docs = await j("/api/documents", { headers: H });
  check("GET /api/documents list", docs.status === 200 && docs.data.documents.length >= 1, `n=${docs.data?.documents?.length}`);

  // 14) دانلود فایل
  const dl = await j(`/api/documents/${docId}`, { headers: { "x-session-token": login.data.token } });
  check("download document", dl.status === 200 && typeof dl.data === "string" && dl.data.includes("آزمایشی"), "content mismatch");

  // 15) ویرایش سند
  const patchDoc = await j(`/api/documents/${docId}`, { method: "PATCH", headers: H, body: JSON.stringify({ title: "سند آزمایشی ویرایش‌شده", category: "INVOICE" }) });
  check("PATCH document", patchDoc.status === 200 && patchDoc.data.ok);

  // 16) حذف سند
  const delDoc = await j(`/api/documents/${docId}`, { method: "DELETE", headers: H });
  check("DELETE document", delDoc.status === 200 && delDoc.data.ok);

  // 17) RBAC — منشی نباید کاربر بسازد
  const secLogin = await j("/api/auth/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roleKey: "SECRETARY" }) });
  const secUsers = await j("/api/users", { headers: { "x-session-token": secLogin.data.token } });
  check("RBAC: secretary denied users.manage", secUsers.status === 403);
  const secDocs = await j("/api/documents", { headers: { "x-session-token": secLogin.data.token } });
  check("RBAC: secretary can view documents", secDocs.status === 200);

  // 18) سرپرست نباید گزارش‌ساز ببیند
  const supLogin = await j("/api/auth/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roleKey: "SUPERVISOR" }) });
  const supBuilder = await j("/api/reports/builder", { headers: { "x-session-token": supLogin.data.token } });
  check("RBAC: supervisor denied reports.build", supBuilder.status === 403);

  // 19) گزارش سود و زیان همچنان کار می‌کند
  const pnl = await j("/api/reports/pnl", { headers: H });
  check("GET /api/reports/pnl still works", pnl.status === 200 && pnl.data.byProject);

  // 20) اعلان‌ها
  const notif = await j("/api/notifications?channel=IN_APP", { headers: H });
  check("GET /api/notifications", notif.status === 200 && Array.isArray(notif.data.notifications));

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error("TEST CRASH:", e); process.exit(1); });
