const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 4173);
const publicDir = __dirname;
const dataDir = path.join(__dirname, "data");
const stateFile = path.join(dataDir, "inventory-state.json");
const defaultState = { items: [], activity: [], lastColumns: [], memoResetVersion: 1 };

const SUPABASE_URL = trimTrailingSlash(process.env.SUPABASE_URL || "");
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const COOKIE_ACCESS = "jaesodan_access";
const COOKIE_REFRESH = "jaesodan_refresh";
const isProduction = process.env.NODE_ENV === "production";

const itemFields = [
  { key: "code", type: "code" },
  { key: "codeChange", type: "text" },
  { key: "parentCode", type: "boolean" },
  { key: "mainCode", type: "code" },
  { key: "inventoryOrder", type: "number" },
  { key: "simpleStatus", type: "simpleStatus" },
  { key: "name", type: "text" },
  { key: "stock", type: "number" },
  { key: "previousStock", type: "optionalSignedNumber" },
  { key: "stockDelta", type: "signedNumber" },
  { key: "processingStock", type: "number" },
  { key: "previousProcessingStock", type: "optionalSignedNumber" },
  { key: "processingStockDelta", type: "signedNumber" },
  { key: "availableStock", type: "signedNumber" },
  { key: "previousAvailableStock", type: "optionalSignedNumber" },
  { key: "availableStockDelta", type: "signedNumber" },
  { key: "previousStockChangedAt", type: "text" },
  { key: "stockChangedAt", type: "text" },
  { key: "inboundDate", type: "text" },
  { key: "inboundQty", type: "number" },
  { key: "orderQty", type: "number" },
  { key: "inSimpleStock", type: "boolean" },
  { key: "hiddenFromInventory", type: "boolean" },
  { key: "autoZeroHidden", type: "boolean" },
  { key: "source", type: "text" },
  { key: "salesLinks", type: "salesLinks" },
  { key: "priceSettings", type: "priceSettings" },
  { key: "periodSales", type: "periodSales" },
  { key: "stockLogs", type: "stockLogs" },
  { key: "note", type: "text" },
  { key: "history", type: "history" },
];

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const allowedStaticFiles = new Set(["/index.html", "/styles.css", "/app.js", "/입고일정_등록양식.xlsx"]);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/api/health") return sendJson(res, {
      ok: true,
      secureMode: isSupabaseConfigured(),
      env: {
        supabaseUrl: Boolean(SUPABASE_URL),
        supabaseAnonKey: Boolean(SUPABASE_ANON_KEY),
        supabaseServiceRoleKey: Boolean(SUPABASE_SERVICE_ROLE_KEY),
        nodeEnv: process.env.NODE_ENV || "",
      },
    });
    if (url.pathname === "/api/auth/login") return handleLogin(req, res);
    if (url.pathname === "/api/auth/signup") return handleSignup(req, res);
    if (url.pathname === "/api/auth/logout") return handleLogout(req, res);
    if (url.pathname === "/api/auth/me") return handleMe(req, res);
    if (url.pathname === "/api/state") return handleStateApi(req, res);
    if (url.pathname === "/api/admin/users") return handleAdminUsers(req, res);

    if (req.method !== "GET" && req.method !== "HEAD") return sendJson(res, { error: "Method not allowed" }, 405);
    await serveStatic(url.pathname, res, req.method === "HEAD");
  } catch (error) {
    console.error(error);
    sendJson(res, { error: error.statusCode === 403 ? error.message : "Internal server error" }, error.statusCode || 500);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Jaesodan inventory app running at http://localhost:${PORT}`);
  console.log(isSupabaseConfigured() ? "Security mode: Supabase Auth + Supabase DB" : `Security mode: local dev file (${stateFile})`);
});

async function handleLogin(req, res) {
  if (req.method !== "POST") return sendJson(res, { error: "Method not allowed" }, 405);
  if (!isSupabaseConfigured()) return sendJson(res, { error: "Supabase env is not configured" }, 503);

  const body = await readJsonBody(req);
  const loginId = normalizeLoginId(body.loginId);
  const password = String(body.password || "");
  if (!loginId || !password) return sendJson(res, { error: "아이디와 비밀번호를 입력해주세요." }, 400);

  const profile = await findProfileByLoginId(loginId);
  if (!profile || profile.is_active === false) return sendJson(res, { error: "로그인 정보가 맞지 않습니다." }, 401);

  const session = await supabaseAuth("/token?grant_type=password", "POST", SUPABASE_ANON_KEY, {
    email: profile.email,
    password,
  });
  if (!session?.access_token) return sendJson(res, { error: "로그인 정보가 맞지 않습니다." }, 401);

  setSessionCookies(res, session);
  sendJson(res, { user: publicProfile(profile) });
}

async function handleSignup(req, res) {
  if (req.method !== "POST") return sendJson(res, { error: "Method not allowed" }, 405);
  if (!isSupabaseConfigured()) return sendJson(res, { error: "Supabase env is not configured" }, 503);

  const body = await readJsonBody(req);
  const loginId = normalizeLoginId(body.loginId);
  const displayName = String(body.displayName || "").trim();
  const password = String(body.password || "");
  if (!/^[a-z0-9가-힣][a-z0-9가-힣._-]{2,29}$/i.test(loginId)) {
    return sendJson(res, { error: "아이디는 3~30자의 한글, 영문, 숫자와 . _ - 만 사용할 수 있습니다." }, 400);
  }
  if (!displayName || displayName.length > 40) return sendJson(res, { error: "이름을 입력해주세요." }, 400);
  if (password.length < 8) return sendJson(res, { error: "비밀번호는 8자 이상이어야 합니다." }, 400);

  const existing = await findProfileByLoginId(loginId);
  if (existing) return sendJson(res, { error: "이미 사용 중인 아이디입니다." }, 409);

  const email = internalEmailForLoginId(loginId);
  const authUser = await supabaseAdminAuth("/admin/users", "POST", {
    email,
    password,
    email_confirm: true,
    user_metadata: { login_id: loginId, display_name: displayName },
  });
  if (!authUser?.id) return sendJson(res, { error: "계정을 만들지 못했습니다. 관리자에게 문의해주세요." }, 400);

  try {
    const rows = await supabaseRest("profiles", "POST", {
      user_id: authUser.id,
      login_id: loginId,
      display_name: displayName,
      email,
      role: "member",
      is_active: true,
      can_upload_inventory: false,
      can_edit_memo: false,
      can_edit_schedule: false,
      can_manage_links: false,
      can_manage_users: false,
    }, { Prefer: "return=representation" });
    if (!rows?.[0]) throw new Error("프로필 저장에 실패했습니다.");
  } catch (error) {
    await supabaseAdminAuth(`/admin/users/${encodeURIComponent(authUser.id)}`, "DELETE").catch(() => null);
    if (String(error.message || "").includes("duplicate") || String(error.message || "").includes("unique")) {
      return sendJson(res, { error: "이미 사용 중인 아이디입니다." }, 409);
    }
    throw error;
  }

  sendJson(res, { ok: true, message: "아이디가 만들어졌습니다." }, 201);
}

async function handleLogout(req, res) {
  if (req.method !== "POST") return sendJson(res, { error: "Method not allowed" }, 405);
  clearSessionCookies(res);
  sendJson(res, { ok: true });
}

async function handleMe(req, res) {
  const auth = await getAuthContext(req);
  sendJson(res, { user: auth ? publicProfile(auth.profile) : null });
}

async function handleStateApi(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  if (req.method === "GET") return sendJson(res, await readState(auth));
  if (req.method === "PUT") {
    const body = await readJsonBody(req);
    const state = sanitizeState(body);
    const previousState = await readState(auth);
    assertCanWriteState(previousState, state, auth.profile);
    await writeState(state, auth);
    return sendJson(res, state);
  }

  sendJson(res, { error: "Method not allowed" }, 405);
}

async function handleAdminUsers(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;
  if (!canManageUsers(auth.profile)) return sendJson(res, { error: "관리자 권한이 필요합니다." }, 403);

  if (req.method === "GET") {
    const users = await supabaseRest("profiles?select=user_id,login_id,display_name,email,role,is_active,can_upload_inventory,can_edit_memo,can_edit_schedule,can_manage_links,can_manage_users&order=display_name.asc", "GET");
    return sendJson(res, { users: users.map(publicProfile) });
  }

  if (req.method === "PUT") {
    const body = await readJsonBody(req);
    const userId = String(body.userId || "");
    if (!/^[0-9a-f-]{36}$/i.test(userId)) return sendJson(res, { error: "사용자 ID가 올바르지 않습니다." }, 400);
    const patch = sanitizeProfilePatch(body);
    const updated = await supabaseRest(`profiles?user_id=eq.${encodeURIComponent(userId)}&select=user_id,login_id,display_name,email,role,is_active,can_upload_inventory,can_edit_memo,can_edit_schedule,can_manage_links,can_manage_users`, "PATCH", patch, {
      Prefer: "return=representation",
    });
    return sendJson(res, { user: publicProfile(updated[0]) });
  }

  sendJson(res, { error: "Method not allowed" }, 405);
}

async function serveStatic(pathname, res, headOnly) {
  const requested = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  if (!allowedStaticFiles.has(requested)) return sendJson(res, { error: "Not found" }, 404);

  const filePath = path.resolve(publicDir, `.${requested}`);
  const relativePath = path.relative(publicDir, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) return sendJson(res, { error: "Forbidden" }, 403);

  let file;
  try {
    file = await fs.readFile(filePath);
  } catch {
    return sendJson(res, { error: "Not found" }, 404);
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": mimeTypes[ext] || "application/octet-stream",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
  });
  res.end(headOnly ? undefined : file);
}

async function readState(auth) {
  if (isSupabaseConfigured()) {
    const rows = await supabaseRest("app_state?key=eq.inventory&select=value", "GET");
    return sanitizeState(rows[0]?.value || defaultState);
  }

  try {
    const raw = await fs.readFile(stateFile, "utf8");
    return sanitizeState(JSON.parse(raw));
  } catch (error) {
    if (error.code !== "ENOENT") console.warn("Could not read state file:", error.message);
    return defaultState;
  }
}

async function writeState(state, auth) {
  const clean = sanitizeState(state);
  if (isSupabaseConfigured()) {
    await supabaseRest("app_state?on_conflict=key", "POST", {
      key: "inventory",
      value: clean,
      updated_by: auth.user.id,
      updated_at: new Date().toISOString(),
    }, { Prefer: "resolution=merge-duplicates,return=minimal" });
    return;
  }

  await fs.mkdir(dataDir, { recursive: true });
  const tmpFile = `${stateFile}.${process.pid}.tmp`;
  await fs.writeFile(tmpFile, `${JSON.stringify(clean, null, 2)}\n`, "utf8");
  await fs.rename(tmpFile, stateFile);
}

async function requireAuth(req, res) {
  const auth = await getAuthContext(req);
  if (!auth) sendJson(res, { error: "로그인이 필요합니다." }, 401);
  return auth;
}

async function getAuthContext(req) {
  if (!isSupabaseConfigured()) {
    return {
      user: { id: "local-dev-admin" },
      profile: {
        user_id: "local-dev-admin",
        login_id: "local",
        display_name: "로컬 관리자",
        role: "admin",
        is_active: true,
        can_upload_inventory: true,
        can_edit_memo: true,
        can_edit_schedule: true,
        can_manage_links: true,
        can_manage_users: true,
      },
    };
  }

  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies[COOKIE_ACCESS];
  if (!token) return null;

  try {
    const user = await supabaseAuth("/user", "GET", token);
    if (!user?.id) return null;
    const profile = await findProfileByUserId(user.id);
    if (!profile || profile.is_active === false) return null;
    return { user, profile };
  } catch {
    return null;
  }
}

async function findProfileByLoginId(loginId) {
  const rows = await supabaseRest(`profiles?login_id=eq.${encodeURIComponent(loginId)}&select=user_id,login_id,display_name,email,role,is_active,can_upload_inventory,can_edit_memo,can_edit_schedule,can_manage_links,can_manage_users`, "GET");
  return rows[0] || null;
}

async function findProfileByUserId(userId) {
  const rows = await supabaseRest(`profiles?user_id=eq.${encodeURIComponent(userId)}&select=user_id,login_id,display_name,email,role,is_active,can_upload_inventory,can_edit_memo,can_edit_schedule,can_manage_links,can_manage_users`, "GET");
  return rows[0] || null;
}

async function supabaseRest(pathname, method, body, extraHeaders = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    method,
    headers: supabaseRestHeaders({
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
      ...extraHeaders,
    }),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`Supabase REST error ${response.status}: ${await response.text()}`);
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function supabaseRestHeaders(headers) {
  if (SUPABASE_SERVICE_ROLE_KEY.startsWith("sb_secret_")) return headers;
  return { ...headers, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` };
}

async function supabaseAuth(pathname, method, bearer, body) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1${pathname}`, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) return null;
  return response.json();
}

async function supabaseAdminAuth(pathname, method, body) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1${pathname}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const message = await response.text();
    const error = new Error(`Supabase Auth error ${response.status}: ${message}`);
    error.statusCode = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

function sanitizeState(input) {
  const now = new Date().toISOString();
  const items = Array.isArray(input?.items)
    ? input.items
        .map((item) => {
          const code = normalizeCode(item?.code);
          if (!code) return null;
          const cleanItem = {
            id: String(item?.id || crypto.randomUUID()),
            createdAt: validDateOr(item?.createdAt, now),
            updatedAt: validDateOr(item?.updatedAt, now),
          };
          itemFields.forEach((field) => {
            cleanItem[field.key] = sanitizeItemField(item?.[field.key], field);
          });
          cleanItem.code = code;
          cleanItem.inSimpleStock = Boolean(item?.inSimpleStock ?? item?.inApprovedStock);
          return cleanItem;
        })
        .filter(Boolean)
    : [];

  const memoResetVersion = Number(input?.memoResetVersion || 0);
  if (memoResetVersion < 1) items.forEach((item) => (item.note = ""));

  return {
    items,
    activity: Array.isArray(input?.activity)
      ? input.activity
          .slice(0, 100)
          .map((entry) => ({
            id: String(entry?.id || crypto.randomUUID()),
            at: validDateOr(entry?.at, now),
            title: renameLegacyMainCodeText(entry?.title).slice(0, 80),
            detail: renameLegacyMainCodeText(entry?.detail).slice(0, 500),
          }))
          .filter((entry) => entry.title || entry.detail)
      : [],
    lastColumns: Array.isArray(input?.lastColumns) ? input.lastColumns.map(String).slice(0, 30) : [],
    memoResetVersion: 1,
  };
}

function sanitizeItemField(value, field) {
  if (field.type === "number") return clampNumber(value, 0, 9999999, 0);
  if (field.type === "signedNumber") return clampNumber(value, -9999999, 9999999, 0);
  if (field.type === "optionalSignedNumber") {
    const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? Math.min(9999999, Math.max(-9999999, Math.trunc(parsed))) : null;
  }
  if (field.type === "boolean") return Boolean(value);
  if (field.type === "code") return normalizeCode(value);
  if (field.type === "simpleStatus") return normalizeSimpleStatus(value);
  if (field.type === "history") return sanitizeHistory(value);
  if (field.type === "salesLinks") return sanitizeSalesLinks(value);
  if (field.type === "priceSettings") return sanitizePriceSettings(value);
  if (field.type === "periodSales") return sanitizePeriodSales(value);
  if (field.type === "stockLogs") return sanitizeStockLogs(value);
  return String(value || "").trim();
}

function sanitizeSalesLinks(value) {
  return Array.isArray(value)
    ? value
        .slice(0, 20)
        .map((entry) => ({
          id: String(entry?.id || crypto.randomUUID()),
          platform: String(entry?.platform || "").trim().slice(0, 80),
          productName: String(entry?.productName || "").trim().slice(0, 160),
          qty: String(entry?.qty || "").trim().slice(0, 20),
          url: String(entry?.url || "").trim().slice(0, 500),
        }))
        .filter((entry) => entry.platform || entry.productName || entry.qty || entry.url)
    : [];
}

function sanitizePriceSettings(value) {
  return Array.isArray(value)
    ? value
        .slice(0, 30)
        .map((entry) => ({
          id: String(entry?.id || crypto.randomUUID()),
          oldPrice: cleanNumberText(entry?.oldPrice).slice(0, 20),
          newPrice: cleanNumberText(entry?.newPrice).slice(0, 20),
          date: String(entry?.date || "").trim().slice(0, 40),
          soldQty: cleanNumberText(entry?.soldQty).slice(0, 20),
          memo: String(entry?.memo || "").trim().slice(0, 300),
        }))
        .filter((entry) => entry.oldPrice || entry.newPrice || entry.date || entry.soldQty || entry.memo)
    : [];
}

function sanitizePeriodSales(value) {
  return Array.isArray(value)
    ? value
        .slice(0, 30)
        .map((entry) => ({
          id: String(entry?.id || crypto.randomUUID()),
          startDate: String(entry?.startDate || "").trim().slice(0, 40),
          endDate: String(entry?.endDate || "").trim().slice(0, 40),
          soldQty: cleanNumberText(entry?.soldQty).slice(0, 20),
          memo: String(entry?.memo || "").trim().slice(0, 300),
        }))
        .filter((entry) => entry.startDate || entry.endDate || entry.soldQty || entry.memo)
    : [];
}

function sanitizeStockLogs(value) {
  return Array.isArray(value)
    ? value
        .slice(-800)
        .map((entry) => ({
          id: String(entry?.id || crypto.randomUUID()),
          at: validDateOr(entry?.at, ""),
          source: String(entry?.source || "").trim().slice(0, 200),
          stockBefore: optionalSignedNumber(entry?.stockBefore),
          stockAfter: optionalSignedNumber(entry?.stockAfter),
          processingBefore: optionalSignedNumber(entry?.processingBefore),
          processingAfter: optionalSignedNumber(entry?.processingAfter),
          availableBefore: optionalSignedNumber(entry?.availableBefore),
          availableAfter: optionalSignedNumber(entry?.availableAfter),
        }))
        .filter((entry) => entry.at)
    : [];
}

function cleanNumberText(value) {
  return String(value || "").replace(/[^\d.-]/g, "").trim();
}

function optionalSignedNumber(value) {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? Math.min(9999999, Math.max(-9999999, Math.trunc(parsed))) : null;
}

function sanitizeHistory(value) {
  const now = new Date().toISOString();
  return Array.isArray(value)
    ? value
        .slice(0, 100)
        .map((entry) => ({
          id: String(entry?.id || crypto.randomUUID()),
          at: validDateOr(entry?.at, now),
          author: String(entry?.author || "작성자 미확인").slice(0, 40),
          field: renameLegacyMainCodeText(entry?.field).slice(0, 40),
          before: renameLegacyMainCodeText(entry?.before).slice(0, 300),
          after: renameLegacyMainCodeText(entry?.after).slice(0, 300),
        }))
        .filter((entry) => entry.field)
    : [];
}

function renameLegacyMainCodeText(value) {
  return String(value || "").trim().replace(/엄마코드/g, "메인코드").replace(/엄마/g, "메인");
}

function sanitizeProfilePatch(input) {
  const allowed = ["display_name", "role", "is_active", "can_upload_inventory", "can_edit_memo", "can_edit_schedule", "can_manage_links", "can_manage_users"];
  const patch = {};
  allowed.forEach((key) => {
    if (!(key in input)) return;
    if (key === "role") patch[key] = input[key] === "admin" ? "admin" : "member";
    else if (key === "display_name") patch[key] = String(input[key] || "").trim().slice(0, 40);
    else patch[key] = Boolean(input[key]);
  });
  return patch;
}

function assertCanWriteState(previousState, nextState, profile) {
  if (profile?.role === "admin") return;
  const previousByCode = new Map((previousState.items || []).map((item) => [item.code, item]));
  const nextByCode = new Map((nextState.items || []).map((item) => [item.code, item]));
  const allCodes = new Set([...previousByCode.keys(), ...nextByCode.keys()]);

  for (const code of allCodes) {
    const before = previousByCode.get(code);
    const after = nextByCode.get(code);
    if (!before || !after) {
      requireProfilePermission(profile, "can_upload_inventory");
      continue;
    }
    if (changedAny(before, after, ["stock", "previousStock", "stockDelta", "processingStock", "previousProcessingStock", "processingStockDelta", "availableStock", "previousAvailableStock", "availableStockDelta", "previousStockChangedAt", "stockChangedAt", "stockLogs", "simpleStatus", "name", "orderQty", "inSimpleStock", "hiddenFromInventory", "autoZeroHidden", "source", "inventoryOrder"])) {
      requireProfilePermission(profile, "can_upload_inventory");
    }
    if (changedAny(before, after, ["note"])) {
      requireProfilePermission(profile, "can_edit_memo");
    }
    if (changedAny(before, after, ["inboundDate", "inboundQty"])) {
      requireProfilePermission(profile, "can_edit_schedule");
    }
    if (changedAny(before, after, ["codeChange", "parentCode", "mainCode", "salesLinks", "priceSettings", "periodSales"])) {
      requireProfilePermission(profile, "can_manage_links");
    }
  }
}

function changedAny(before, after, keys) {
  return keys.some((key) => JSON.stringify(before?.[key] ?? null) !== JSON.stringify(after?.[key] ?? null));
}

function requireProfilePermission(profile, key) {
  if (!profile?.[key]) {
    const error = new Error("권한이 부족합니다.");
    error.statusCode = 403;
    throw error;
  }
}

function publicProfile(profile) {
  if (!profile) return null;
  return {
    id: profile.user_id,
    loginId: profile.login_id,
    displayName: profile.display_name || profile.login_id,
    role: profile.role === "admin" ? "admin" : "member",
    isActive: profile.is_active !== false,
    permissions: {
      uploadInventory: Boolean(profile.can_upload_inventory),
      editMemo: Boolean(profile.can_edit_memo),
      editSchedule: Boolean(profile.can_edit_schedule),
      manageLinks: Boolean(profile.can_manage_links),
      manageUsers: canManageUsers(profile),
    },
  };
}

function canManageUsers(profile) {
  return profile?.role === "admin" && Boolean(profile?.can_manage_users);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, payload, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(payload));
}

function setSessionCookies(res, session) {
  const maxAge = Math.max(60, Number(session.expires_in || 3600));
  const cookies = [
    cookieHeader(COOKIE_ACCESS, session.access_token, maxAge),
    cookieHeader(COOKIE_REFRESH, session.refresh_token || "", 60 * 60 * 24 * 30),
  ];
  res.setHeader("Set-Cookie", cookies);
}

function clearSessionCookies(res) {
  res.setHeader("Set-Cookie", [cookieHeader(COOKIE_ACCESS, "", 0), cookieHeader(COOKIE_REFRESH, "", 0)]);
}

function cookieHeader(name, value, maxAge) {
  const secure = isProduction ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function parseCookies(header) {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

function normalizeCode(value) {
  const text = String(value || "").trim();
  return /^\d+\.0$/.test(text) ? text.slice(0, -2) : text.toUpperCase();
}

function normalizeSimpleStatus(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.includes("승인")) return "승인";
  if (text.includes("보류")) return "보류";
  return "";
}

function normalizeLoginId(value) {
  return String(value || "").trim().toLowerCase();
}

function internalEmailForLoginId(loginId) {
  const digest = crypto.createHash("sha256").update(String(loginId)).digest("hex").slice(0, 32);
  return `account-${digest}@users.jaesodan.local`;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function validDateOr(value, fallback) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY);
}
