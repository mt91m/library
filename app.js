// ============================================
// اتصال Supabase
// ============================================
const SUPABASE_URL = "https://xsqpxbcajrhadhpnzfbr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzcXB4YmNhanJoYWRocG56ZmJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NjQzODUsImV4cCI6MjEwNjM0MDM4NX0.CZVqzcBSZTOTc89B21fVR8PjYPjpz412w4ehw5KueYQ";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const EMAIL_DOMAIN = "school.local";
const MONTHS_FA = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];

// ============================================
// وضعیت
// ============================================
let currentUser = null;
let currentProfile = null;
let booksCache = [];
let periodsCache = [];
let adminLoansCache = [];
let allLoansCache = [];
let currentReport = "active";
let currentView = "books";

// ============================================
// ابزارها
// ============================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showToast(text, type = "success", duration = 3000) {
  const c = $("#toast-container");
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = text;
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transition = "opacity .3s";
    setTimeout(() => t.remove(), 300);
  }, duration);
}

function showMsg(el, text, type = "error") {
  if (!el) return;
  el.textContent = text;
  el.className = `msg ${type}`;
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function faNum(n) {
  return Number(n).toLocaleString("fa-IR");
}

// ============================================
// تاریخ شمسی
// ============================================
function gregorianToJalali(gy, gm, gd) {
  const g_d_m = [0,31,59,90,120,151,181,212,243,273,304,334];
  let jy = (gy <= 1600) ? 0 : 979;
  gy -= (gy <= 1600) ? 621 : 1600;
  const gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return [jy, jm, jd];
}

function jalaliToGregorian(jy, jm, jd) {
  let gy = (jy <= 979) ? 621 : 1600;
  jy -= (jy <= 979) ? 0 : 979;
  let days = (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const sal_a = [0,31,((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28,31,30,31,30,31,31,30,31,30,31];
  let gm;
  for (gm = 0; gm < 13; gm++) {
    if (gd <= sal_a[gm]) break;
    gd -= sal_a[gm];
  }
  return [gy, gm, gd];
}

// fix: استفاده از local date به‌جای UTC
function parseISOLocal(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toJalaliLong(dateStr) {
  if (!dateStr) return "—";
  const d = parseISOLocal(dateStr);
  if (!d) return "—";
  const [jy, jm, jd] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return `${jd} ${MONTHS_FA[jm - 1]} ${jy}`;
}

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoFromJalali(jy, jm, jd) {
  const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);
  const pad = (n) => String(n).padStart(2, "0");
  return `${gy}-${pad(gm)}-${pad(gd)}`;
}

function addDaysISO(iso, days) {
  const d = parseISOLocal(iso);
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function usernameToEmail(username) {
  return `${username.toLowerCase().trim()}@${EMAIL_DOMAIN}`;
}

// ============================================
// تب‌های ورود/ثبت‌نام
// ============================================
$$(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const target = tab.dataset.tab;
    $("#login-form").classList.toggle("hidden", target !== "login");
    $("#register-form").classList.toggle("hidden", target !== "register");
  });
});

// ============================================
// ثبت‌نام (با ورود خودکار)
// ============================================
$("#register-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#reg-msg");
  const full_name = $("#reg-fullname").value.trim();
  const class_name = $("#reg-class").value.trim();
  const username = $("#reg-username").value.trim().toLowerCase();
  const password = $("#reg-password").value;

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    showMsg(msg, "نام کاربری فقط حروف انگلیسی، عدد و _ (۳ تا ۲۰ کاراکتر)");
    return;
  }
  if (password.length < 6) {
    showMsg(msg, "رمز عبور حداقل ۶ کاراکتر باشد");
    return;
  }
  if (!full_name || !class_name) {
    showMsg(msg, "نام و کلاس را وارد کنید");
    return;
  }

  showMsg(msg, "در حال ثبت‌نام...", "success");

  const { error } = await db.auth.signUp({
    email: usernameToEmail(username),
    password,
    options: { data: { username, full_name, class_name } },
  });

  if (error) {
    showMsg(msg, error.message.includes("already") ? "این نام کاربری قبلاً استفاده شده" : "خطا: " + error.message);
    return;
  }

  showMsg(msg, "ثبت‌نام موفق! در حال ورود...", "success");

  // ورود خودکار
  const { error: loginErr } = await db.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });

  if (loginErr) {
    showMsg(msg, "ثبت‌نام شد ولی ورود خودکار نشد. دستی وارد شوید.");
    setTimeout(() => {
      $(".tab[data-tab='login']").click();
      $("#login-username").value = username;
    }, 900);
    return;
  }

  await loadSession();
});

// ============================================
// ورود
// ============================================
$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#login-msg");
  const username = $("#login-username").value.trim().toLowerCase();
  const password = $("#login-password").value;

  showMsg(msg, "در حال ورود...", "success");

  const { error } = await db.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });

  if (error) {
    showMsg(msg, "نام کاربری یا رمز عبور اشتباه است");
    return;
  }

  await loadSession();
});

// ============================================
// خروج
// ============================================
$("#logout-btn").addEventListener("click", async () => {
  await db.auth.signOut();
  currentUser = null;
  currentProfile = null;
  window._overdueWarned = false;
  switchPage("auth");
  $("#login-form").reset();
  $("#login-msg").textContent = "";
});

// ============================================
// نشست
// ============================================
async function loadSession() {
  let user = null;
  try {
    const { data } = await db.auth.getUser();
    user = data?.user;
  } catch (err) {
    console.error("getUser error:", err);
  }

  if (!user) { switchPage("auth"); return; }
  currentUser = user;

  const { data: profile, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    showToast("پروفایل پیدا نشد. لطفاً دوباره ثبت‌نام کنید.", "error");
    await db.auth.signOut();
    switchPage("auth");
    return;
  }
  currentProfile = profile;

  $("#user-name").textContent = profile.full_name;
  $("#user-role").textContent = profile.role === "admin"
    ? `ادمین • کلاس ${profile.class_name}`
    : `کلاس ${profile.class_name}`;
  $("#user-avatar").textContent = (profile.full_name || "؟").charAt(0);

  $$(".admin-only").forEach((el) => {
    el.classList.toggle("hidden", profile.role !== "admin");
  });

  switchPage("app");
  await loadBooks();
  await loadPeriods();
  await loadMyLoans();

  if (profile.role === "admin") {
    await loadAdminBooks();
    await loadAdminPeriods();
    await loadAdminLoans();
    await loadAllLoans();
    fillManualSelects();
    updateOverdueBadge();
  }
}

function switchPage(page) {
  $$(".page").forEach((p) => p.classList.remove("active"));
  $(`#${page}-page`).classList.add("active");
}

// ============================================
// ناوبری (با حفظ تب فعلی)
// ============================================
$$(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".nav-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    $$(".view").forEach((v) => v.classList.remove("active"));
    $(`#view-${btn.dataset.view}`).classList.add("active");
    currentView = btn.dataset.view;
    if (btn.dataset.view === "admin-reports") renderReports();
  });
});

function restoreView() {
  const btn = document.querySelector(`.nav-btn[data-view="${currentView}"]`);
  if (btn && !btn.classList.contains("hidden")) {
    btn.click();
  }
}

// ============================================
// کتاب‌ها
// ============================================
async function loadBooks() {
  const { data, error } = await db.from("books").select("*").order("title");
  if (error) { console.error(error); return; }
  booksCache = data || [];
  renderGenreOptions();
  renderBooks();
}

function renderGenreOptions() {
  const genres = [...new Set(booksCache.map((b) => b.genre))].sort();
  const sel = $("#filter-genre");
  const cur = sel.value;
  sel.innerHTML = `<option value="">همه دسته‌ها</option>` +
    genres.map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
  sel.value = cur;
}

function renderBooks() {
  const container = $("#books-list");
  const q = $("#search-books").value.trim().toLowerCase();
  const genre = $("#filter-genre").value;
  const stock = $("#filter-stock").value;
  const sort = $("#sort-books").value;

  let list = booksCache.filter((b) => {
    if (q && !(b.title + " " + b.genre).toLowerCase().includes(q)) return false;
    if (genre && b.genre !== genre) return false;
    if (stock === "available" && b.available_copies <= 0) return false;
    return true;
  });

  if (sort === "available") list.sort((a, b) => b.available_copies - a.available_copies);
  else list.sort((a, b) => a.title.localeCompare(b.title, "fa"));

  $("#books-count").textContent = faNum(list.length);

  if (!list.length) {
    container.innerHTML = `<div class="empty"><span class="icon">📭</span>کتابی پیدا نشد</div>`;
    return;
  }

  container.innerHTML = list.map((b) => `
    <div class="card">
      <h4>${escapeHtml(b.title)}</h4>
      <span class="genre">${escapeHtml(b.genre)}</span>
      <div class="stock ${b.available_copies <= 0 ? "out" : ""}">
        <span class="num">${faNum(b.available_copies)}</span> از ${faNum(b.total_copies)} نسخه موجود
      </div>
      <button data-id="${b.id}" ${b.available_copies <= 0 ? "disabled" : ""}>
        ${b.available_copies <= 0 ? "ناموجود" : "درخواست امانت"}
      </button>
    </div>
  `).join("");

  container.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", () => openPeriodModal(Number(btn.dataset.id)));
  });
}

["search-books", "filter-genre", "filter-stock", "sort-books"].forEach((id) => {
  const el = document.getElementById(id);
  el.addEventListener("input", renderBooks);
  el.addEventListener("change", renderBooks);
});

// ============================================
// بازه‌ها
// ============================================
async function loadPeriods() {
  const { data, error } = await db
    .from("periods")
    .select("*")
    .gte("end_date", todayISO())
    .order("start_date");
  if (error) { console.error(error); return; }
  periodsCache = data || [];
}

// ============================================
// مودال
// ============================================
let selectedBookId = null;

async function openPeriodModal(bookId) {
  selectedBookId = bookId;
  const book = booksCache.find((b) => b.id === bookId);
  $("#modal-title").textContent = `انتخاب بازه برای «${book.title}»`;

  await loadPeriods();

  const container = $("#modal-periods");
  if (!periodsCache.length) {
    container.innerHTML = `<div class="empty"><span class="icon">🗓</span>هیچ بازه‌ای تعریف نشده</div>`;
  } else {
    container.innerHTML = periodsCache.map((p) => `
      <div class="row">
        <div class="info">
          <strong>${escapeHtml(p.label)}</strong>
          <small>${toJalaliLong(p.start_date)} تا ${toJalaliLong(p.end_date)}</small>
        </div>
        <div class="actions">
          <button data-pid="${p.id}" class="btn-primary">انتخاب</button>
        </div>
      </div>
    `).join("");

    container.querySelectorAll("button[data-pid]").forEach((btn) => {
      btn.addEventListener("click", () => createLoan(Number(btn.dataset.pid)));
    });
  }

  $("#modal").classList.remove("hidden");
}

$("#modal-close").addEventListener("click", () => $("#modal").classList.add("hidden"));
$("#modal").addEventListener("click", (e) => {
  if (e.target.id === "modal") $("#modal").classList.add("hidden");
});

// ============================================
// ثبت درخواست
// ============================================
async function createLoan(periodId) {
  const { data: existing } = await db
    .from("loans")
    .select("id")
    .eq("user_id", currentUser.id)
    .eq("book_id", selectedBookId)
    .in("status", ["pending", "approved"]);

  if (existing && existing.length > 0) {
    showToast("قبلاً برای این کتاب درخواست فعال دارید", "warn");
    return;
  }

  const { error } = await db.from("loans").insert({
    user_id: currentUser.id,
    book_id: selectedBookId,
    period_id: periodId,
    status: "pending",
  });

  if (error) { showToast("خطا: " + error.message, "error"); return; }

  $("#modal").classList.add("hidden");
  showToast("درخواست ثبت شد", "success");
  await loadMyLoans();
  if (currentProfile.role === "admin") {
    await loadAdminLoans();
    await loadAllLoans();
    updateOverdueBadge();
  }
}

// ============================================
// درخواست‌های من
// ============================================
async function loadMyLoans() {
  const { data, error } = await db
    .from("loans")
    .select("*, books(title), periods(label, start_date, end_date)")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) { console.error(error); return; }

  const container = $("#my-loans-list");
  if (!data || !data.length) {
    container.innerHTML = `<div class="empty"><span class="icon">📋</span>هنوز درخواستی ثبت نکرده‌اید</div>`;
    return;
  }

  const statusFa = { pending: "در انتظار", approved: "تأییدشده", rejected: "ردشده", returned: "بازگشته" };

  container.innerHTML = data.map((l) => {
    const title = l.books?.title || (l.book_id ? "-" : "کتاب حذف‌شده");
    const periodLabel = l.periods?.label || (l.period_id ? "-" : "بازه حذف‌شده");
    const periodRange = l.periods
      ? `(${toJalaliLong(l.periods.start_date)} تا ${toJalaliLong(l.periods.end_date)})`
      : "";

    return `
      <div class="row">
        <div class="info">
          <strong>${escapeHtml(title)}</strong>
          <small>بازه: ${escapeHtml(periodLabel)} ${periodRange}</small>
        </div>
        <span class="badge ${l.status}">${statusFa[l.status] || l.status}</span>
      </div>
    `;
  }).join("");
}

// ============================================
// ادمین: کتاب‌ها
// ============================================
$("#add-book-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = $("#book-title").value.trim();
  const genre = $("#book-genre").value.trim();
  const copies = Number($("#book-copies").value);

  if (copies < 1) { showToast("تعداد حداقل ۱", "error"); return; }

  const { error } = await db.from("books").insert({
    title, genre, total_copies: copies, available_copies: copies,
  });

  if (error) { showToast("خطا: " + error.message, "error"); return; }

  $("#add-book-form").reset();
  showToast("کتاب اضافه شد", "success");
  await loadBooks();
  await loadAdminBooks();
  fillManualSelects();
});

async function loadAdminBooks() {
  const { data } = await db.from("books").select("*").order("title");
  booksCache = data || [];
  renderAdminBooks();
}

function renderAdminBooks() {
  const container = $("#admin-books-list");
  if (!booksCache.length) {
    container.innerHTML = `<div class="empty"><span class="icon">📚</span>کتابی ثبت نشده</div>`;
    return;
  }
  container.innerHTML = booksCache.map((b) => `
    <div class="row">
      <div class="info">
        <strong>${escapeHtml(b.title)}</strong>
        <small>${escapeHtml(b.genre)} — ${faNum(b.available_copies)}/${faNum(b.total_copies)} موجود</small>
      </div>
      <div class="actions">
        <button class="btn-delete" data-del="${b.id}">حذف</button>
      </div>
    </div>
  `).join("");

  container.querySelectorAll("button[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => deleteBook(Number(btn.dataset.del)));
  });
}

async function deleteBook(bookId) {
  const { data: active } = await db
    .from("loans")
    .select("id")
    .eq("book_id", bookId)
    .in("status", ["pending", "approved"]);

  if (active && active.length > 0) {
    showToast("این کتاب امانت فعال دارد و قابل حذف نیست", "error");
    return;
  }

  if (!confirm("از حذف این کتاب مطمئن هستید؟ (تاریخچه حفظ می‌شود)")) return;

  const { error } = await db.from("books").delete().eq("id", bookId);
  if (error) { showToast("خطا: " + error.message, "error"); return; }

  showToast("کتاب حذف شد (تاریخچه حفظ شد)", "success");
  await loadBooks();
  await loadAdminBooks();
  await loadAllLoans();
  fillManualSelects();
  if ($("#view-admin-reports").classList.contains("active")) renderReports();
}

// ============================================
// ادمین: بازه‌ها
// ============================================
$("#add-period-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const label = $("#period-label").value.trim();
  const day = Number($("#start-day").value);
  const month = Number($("#start-month").value);
  const year = Number($("#start-year").value);
  const days = Number($("#period-days").value);

  if (month < 1 || month > 12) { showToast("ماه نامعتبر", "error"); return; }
  if (day < 1 || day > 31) { showToast("روز نامعتبر", "error"); return; }
  if (year < 1400 || year > 1450) { showToast("سال نامعتبر", "error"); return; }
  if (days < 1) { showToast("مدت حداقل ۱ روز", "error"); return; }

  const start_date = isoFromJalali(year, month, day);
  // گزینه A: پایان شامل — اگه ۱ فروردین + ۷ روز یعنی ۱ تا ۷ فروردین
  const end_date = addDaysISO(start_date, days - 1);

  const { error } = await db.from("periods").insert({ label, start_date, end_date });
  if (error) { showToast("خطا: " + error.message, "error"); return; }

  $("#add-period-form").reset();
  $("#period-days").value = 7;
  showToast("بازه اضافه شد", "success");
  await loadPeriods();
  await loadAdminPeriods();
  fillManualSelects();
});

async function loadAdminPeriods() {
  const { data } = await db.from("periods").select("*").order("start_date", { ascending: false });
  periodsCache = data || [];
  renderAdminPeriods();
}

function renderAdminPeriods() {
  const container = $("#admin-periods-list");
  if (!periodsCache.length) {
    container.innerHTML = `<div class="empty"><span class="icon">🗓</span>بازه‌ای ثبت نشده</div>`;
    return;
  }
  container.innerHTML = periodsCache.map((p) => `
    <div class="row">
      <div class="info">
        <strong>${escapeHtml(p.label)}</strong>
        <small>${toJalaliLong(p.start_date)} تا ${toJalaliLong(p.end_date)}</small>
      </div>
      <div class="actions">
        <button class="btn-delete" data-del="${p.id}">حذف</button>
      </div>
    </div>
  `).join("");

  container.querySelectorAll("button[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => deletePeriod(Number(btn.dataset.del)));
  });
}

async function deletePeriod(periodId) {
  // چک امانت فعال
  const { data: active } = await db
    .from("loans")
    .select("id")
    .eq("period_id", periodId)
    .in("status", ["pending", "approved"]);

  if (active && active.length > 0) {
    showToast("این بازه درخواست فعال دارد و قابل حذف نیست", "error");
    return;
  }

  if (!confirm("از حذف این بازه مطمئن هستید؟ (تاریخچه حفظ می‌شود)")) return;

  const { error } = await db.from("periods").delete().eq("id", periodId);
  if (error) { showToast("خطا: " + error.message, "error"); return; }

  showToast("بازه حذف شد (تاریخچه حفظ شد)", "success");
  await loadPeriods();
  await loadAdminPeriods();
  await loadAllLoans();
  fillManualSelects();
  if ($("#view-admin-reports").classList.contains("active")) renderReports();
}

// ============================================
// ادمین: درخواست‌های در جریان
// ============================================
async function loadAdminLoans() {
  const { data, error } = await db.rpc("get_admin_loans", { p_only_active: true });

  if (error) {
    console.error("RPC error:", error);
    showToast("خطا در دریافت درخواست‌ها: " + error.message, "error");
    return;
  }

  adminLoansCache = data || [];
  renderAdminLoans();
}

async function loadAllLoans() {
  const { data, error } = await db.rpc("get_admin_loans", { p_only_active: false });
  if (error) { console.error(error); return; }
  allLoansCache = data || [];
  updateOverdueBadge();
}

function renderAdminLoans() {
  const container = $("#admin-loans-list");
  $("#admin-loans-count").textContent = faNum(adminLoansCache.length);

  if (!adminLoansCache.length) {
    container.innerHTML = `<div class="empty"><span class="icon">📨</span>درخواست در جریانی وجود ندارد</div>`;
    return;
  }

  const statusFa = { pending: "در انتظار", approved: "تأییدشده", rejected: "ردشده", returned: "بازگشته" };

  container.innerHTML = adminLoansCache.map((l) => {
    let nameHtml, cls;
    if (l.is_manual) {
      nameHtml = `${escapeHtml(l.manual_name || "-")} <span class="manual-tag">دستی</span>`;
      cls = escapeHtml(l.manual_class || "-");
    } else {
      nameHtml = escapeHtml(l.profile_full_name || "-");
      cls = escapeHtml(l.profile_class_name || "-");
    }

    const overdueTag = l.is_overdue
      ? `<span class="overdue-tag">⏰ تأخیر ${faNum(l.days_overdue)} روز</span>`
      : "";

    const deletedTag = l.book_id === null
      ? `<span class="deleted-tag">کتاب حذف‌شده</span>`
      : "";

    const periodDeletedTag = l.period_id === null
      ? `<span class="deleted-tag">بازه حذف‌شده</span>`
      : "";

    return `
      <div class="row ${l.is_overdue ? "overdue" : ""}">
        <div class="info">
          <strong>${escapeHtml(l.book_title || "-")} ${overdueTag} ${deletedTag}</strong>
          <small>گیرنده: ${nameHtml} | کلاس: ${cls}</small>
          <small>بازه: ${escapeHtml(l.period_label || "-")} ${periodDeletedTag} (${toJalaliLong(l.period_start)} تا ${toJalaliLong(l.period_end)})</small>
        </div>
        <span class="badge ${l.status}">${statusFa[l.status] || l.status}</span>
        <div class="actions">
          ${l.status === "pending" ? `
            <button class="btn-approve" data-approve="${l.id}">تأیید</button>
            <button class="btn-reject" data-reject="${l.id}">رد</button>
          ` : ""}
          ${l.status === "approved" ? `
            <button class="btn-return" data-return="${l.id}">ثبت بازگشت</button>
          ` : ""}
        </div>
      </div>
    `;
  }).join("");

  container.querySelectorAll("[data-approve]").forEach((btn) =>
    btn.addEventListener("click", () => handleApprove(Number(btn.dataset.approve)))
  );
  container.querySelectorAll("[data-reject]").forEach((btn) =>
    btn.addEventListener("click", () => handleReject(Number(btn.dataset.reject)))
  );
  container.querySelectorAll("[data-return]").forEach((btn) =>
    btn.addEventListener("click", () => handleReturn(Number(btn.dataset.return)))
  );
}

// ============================================
// هشدار تأخیر
// ============================================
function updateOverdueBadge() {
  const overdueCount = allLoansCache.filter((l) => l.is_overdue).length;
  const badge = $("#overdue-badge");
  if (!badge) return;

  if (overdueCount > 0) {
    badge.textContent = faNum(overdueCount);
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }

  if (overdueCount > 0 && currentProfile?.role === "admin" && !window._overdueWarned) {
    window._overdueWarned = true;
    setTimeout(() => {
      showToast(`⏰ ${faNum(overdueCount)} کتاب دارای تأخیر در بازگشت`, "warn", 5000);
    }, 1000);
  }
}

// ============================================
// تأیید/رد/بازگشت
// ============================================
async function handleApprove(id) {
  const { error } = await db.rpc("approve_loan", { p_loan_id: id });
  if (error) { showToast("خطا: " + error.message, "error"); return; }
  showToast("تأیید شد", "success");
  await refreshAll();
}

async function handleReject(id) {
  const { error } = await db.from("loans").update({ status: "rejected" }).eq("id", id);
  if (error) { showToast("خطا: " + error.message, "error"); return; }
  showToast("رد شد", "success");
  await refreshAll();
}

async function handleReturn(id) {
  const { error } = await db.rpc("return_loan", { p_loan_id: id });
  if (error) { showToast("خطا: " + error.message, "error"); return; }
  showToast("بازگشت ثبت شد", "success");
  await refreshAll();
}

async function refreshAll() {
  await loadBooks();
  await loadAdminBooks();
  await loadAdminLoans();
  await loadAllLoans();
  await loadMyLoans();
  await loadPeriods();
  fillManualSelects();
  updateOverdueBadge();
  if ($("#view-admin-reports").classList.contains("active")) renderReports();
}

// ============================================
// ادمین: امانت دستی
// ============================================
function fillManualSelects() {
  const bookSel = $("#manual-book");
  const perSel = $("#manual-period");

  if (bookSel) {
    const cur = bookSel.value;
    bookSel.innerHTML = `<option value="">— انتخاب کتاب —</option>` +
      booksCache.filter((b) => b.available_copies > 0)
        .map((b) => `<option value="${b.id}">${escapeHtml(b.title)} (${faNum(b.available_copies)} موجود)</option>`)
        .join("");
    bookSel.value = cur;
  }

  if (perSel) {
    const cur = perSel.value;
    const today = todayISO();
    perSel.innerHTML = `<option value="">— انتخاب بازه —</option>` +
      periodsCache.filter((p) => p.end_date >= today)
        .map((p) => `<option value="${p.id}">${escapeHtml(p.label)} (${toJalaliLong(p.start_date)} تا ${toJalaliLong(p.end_date)})</option>`)
        .join("");
    perSel.value = cur;
  }
}

$("#manual-loan-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("#manual-name").value.trim();
  const cls = $("#manual-class").value.trim();
  const bookId = Number($("#manual-book").value);
  const periodId = Number($("#manual-period").value);

  if (!bookId || !periodId) { showToast("کتاب و بازه را انتخاب کنید", "error"); return; }

  const { error } = await db.rpc("create_manual_loan", {
    p_book_id: bookId,
    p_period_id: periodId,
    p_name: name,
    p_class: cls,
  });

  if (error) { showToast("خطا: " + error.message, "error"); return; }

  $("#manual-loan-form").reset();
  showToast("امانت دستی ثبت شد", "success");
  await refreshAll();
});

// ============================================
// ادمین: گزارش‌ها
// ============================================
$$(".report-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".report-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentReport = tab.dataset.report;
    renderReports();
  });
});

["report-search", "report-status"].forEach((id) => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("input", renderReports);
    el.addEventListener("change", renderReports);
  }
});

function renderReports() {
  const container = $("#reports-list");
  const q = ($("#report-search")?.value || "").trim().toLowerCase();
  const statusFilter = $("#report-status")?.value || "";

  const statusFa = { pending: "در انتظار", approved: "تأییدشده", rejected: "ردشده", returned: "بازگشته" };

  if (currentReport === "overdue") {
    const overdueList = allLoansCache.filter((l) => l.is_overdue && (!q || matchQuery(l, q)));
    if (!overdueList.length) {
      container.innerHTML = `<div class="empty"><span class="icon">✅</span>هیچ تأخیری وجود ندارد. آفرین!</div>`;
      return;
    }
    const totalDays = overdueList.reduce((s, l) => s + (l.days_overdue || 0), 0);
    container.innerHTML = `
      <div class="overdue-summary">
        ⏰ <span class="num">${faNum(overdueList.length)}</span> کتاب دارای تأخیر — مجموع ${faNum(totalDays)} روز تأخیر
      </div>
      ${overdueList.map((l) => renderOverdueRow(l)).join("")}
    `;
    return;
  }

  if (currentReport === "active") {
    const list = allLoansCache.filter((l) => l.status === "approved" && (!q || matchQuery(l, q)));
    if (!list.length) {
      container.innerHTML = `<div class="empty"><span class="icon">📕</span>کتابی در امانت نیست</div>`;
      return;
    }
    container.innerHTML = list.map((l) => renderLoanRow(l, statusFa, true)).join("");
    return;
  }

  if (currentReport === "history") {
    let list = allLoansCache;
    if (statusFilter) list = list.filter((l) => l.status === statusFilter);
    if (q) list = list.filter((l) => matchQuery(l, q));

    if (!list.length) {
      container.innerHTML = `<div class="empty"><span class="icon">📜</span>موردی یافت نشد</div>`;
      return;
    }
    container.innerHTML = list.map((l) => renderLoanRow(l, statusFa, false)).join("");
    return;
  }

  if (currentReport === "by-book") {
    container.innerHTML = booksCache.map((b) => {
      const bookLoans = allLoansCache.filter((l) => l.book_id === b.id);
      const filteredLoans = bookLoans.filter((l) => {
        if (statusFilter && l.status !== statusFilter) return false;
        if (q && !matchQuery(l, q)) return false;
        return true;
      });
      const activeCount = bookLoans.filter((l) => l.status === "approved").length;
      const totalBorrowed = bookLoans.filter((l) => ["approved", "returned"].includes(l.status)).length;

      const holders = bookLoans
        .filter((l) => l.status === "approved")
        .map((l) => {
          const name = l.is_manual ? l.manual_name : l.profile_full_name;
          const cls = l.is_manual ? l.manual_class : l.profile_class_name;
          const overdue = l.is_overdue ? ` <span class="overdue-tag">⏰ ${faNum(l.days_overdue)} روز</span>` : "";
          return `<div class="holder"><strong>${escapeHtml(name || "-")}${overdue}</strong><span>کلاس ${escapeHtml(cls || "-")} — ${escapeHtml(l.period_label || "")}</span></div>`;
        }).join("");

      return `
        <div class="report-group">
          <h4>${escapeHtml(b.title)} <span class="genre">${escapeHtml(b.genre)}</span></h4>
          <div class="stats">
            <span>کل: <strong>${faNum(b.total_copies)}</strong></span>
            <span>موجود: <strong>${faNum(b.available_copies)}</strong></span>
            <span>در امانت: <strong>${faNum(activeCount)}</strong></span>
            <span>مجموع امانت: <strong>${faNum(totalBorrowed)}</strong></span>
          </div>
          ${holders ? `<div class="holders">${holders}</div>` : `<div class="holder" style="justify-content:center;color:var(--muted)">کسی این کتاب را در امانت ندارد</div>`}
        </div>
      `;
    }).join("");
    return;
  }
}

function matchQuery(l, q) {
  const hay = [
    l.book_title,
    l.profile_full_name,
    l.profile_username,
    l.manual_name,
    l.profile_class_name,
    l.manual_class,
    l.period_label,
  ].filter(Boolean).join(" ").toLowerCase();
  return hay.includes(q);
}

function renderLoanRow(l, statusFa, showOverdue) {
  const name = l.is_manual
    ? `${escapeHtml(l.manual_name || "-")} <span class="manual-tag">دستی</span>`
    : escapeHtml(l.profile_full_name || "-");
  const cls = l.is_manual ? l.manual_class : l.profile_class_name;

  const overdueTag = (showOverdue && l.is_overdue)
    ? `<span class="overdue-tag">⏰ تأخیر ${faNum(l.days_overdue)} روز</span>`
    : "";

  const deletedTag = l.book_id === null ? `<span class="deleted-tag">کتاب حذف‌شده</span>` : "";
  const periodDeletedTag = l.period_id === null ? `<span class="deleted-tag">بازه حذف‌شده</span>` : "";

  return `
    <div class="row ${l.is_overdue ? "overdue" : ""}">
      <div class="info">
        <strong>${escapeHtml(l.book_title || "-")} ${overdueTag} ${deletedTag}</strong>
        <small>گیرنده: ${name} | کلاس: ${escapeHtml(cls || "-")}</small>
        <small>بازه: ${escapeHtml(l.period_label || "-")} ${periodDeletedTag} ${l.period_start ? `(${toJalaliLong(l.period_start)} تا ${toJalaliLong(l.period_end)})` : ""}</small>
      </div>
      <span class="badge ${l.status}">${statusFa[l.status] || l.status}</span>
    </div>
  `;
}

function renderOverdueRow(l) {
  const name = l.is_manual
    ? `${escapeHtml(l.manual_name || "-")} <span class="manual-tag">دستی</span>`
    : escapeHtml(l.profile_full_name || "-");
  const cls = l.is_manual ? l.manual_class : l.profile_class_name;

  return `
    <div class="row overdue">
      <div class="info">
        <strong>
          ${escapeHtml(l.book_title || "-")}
          <span class="overdue-tag">⏰ ${faNum(l.days_overdue)} روز تأخیر</span>
        </strong>
        <small>گیرنده: ${name} | کلاس: ${escapeHtml(cls || "-")}</small>
        <small>پایان بازه: ${toJalaliLong(l.period_end)}</small>
      </div>
      <div class="actions">
        <button class="btn-return" data-return="${l.id}">ثبت بازگشت</button>
      </div>
    </div>
  `;
}

// دکمه بازگشت تو گزارش‌ها
document.addEventListener("click", (e) => {
  const btn = e.target.closest("#reports-list [data-return]");
  if (btn) {
    handleReturn(Number(btn.dataset.return));
  }
});

// ============================================
// شروع
// ============================================
(async function init() {
  await loadSession();
})();
