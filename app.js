const STORAGE_KEY = "jaesodanInventory.v2";
const AUTHOR_KEY = "jaesodanInventory.author";
const LOGIN_KEY = "jaesodanInventory.loginUser";
const API_STATE_URL = "/api/state";
const PAGE_SIZE = 50;

const COLUMNS = [
  { key: "sequence", label: "번호" },
  { key: "status", label: "상태" },
  { key: "code", label: "상품코드" },
  { key: "codeChange", label: "변경코드" },
  { key: "parentCode", label: "메인코드" },
  { key: "mainCode", label: "소속 메인코드" },
  { key: "simpleStatus", label: "심플상태" },
  { key: "name", label: "상품명" },
  { key: "stock", label: "현재고" },
  { key: "processingStock", label: "처리중" },
  { key: "stockChangeDetail", label: "현재고 변동" },
  { key: "processingStockChangeDetail", label: "처리중 변동" },
  { key: "availableStockChangeDetail", label: "가용재고 변동" },
  { key: "availableStock", label: "가용재고" },
  { key: "depletionEstimate", label: "소진예상" },
  { key: "depletionRate", label: "최근속도" },
  { key: "depletionDate", label: "예상일" },
  { key: "inboundDate", label: "입고일정" },
  { key: "inboundQty", label: "입고수량" },
  { key: "orderQty", label: "주문서수량" },
  { key: "source", label: "재고목록" },
  { key: "salesLinks", label: "판매링크" },
  { key: "priceSettings", label: "가격설정 기준" },
  { key: "periodSales", label: "기간 판매 조회" },
  { key: "note", label: "메모" },
  { key: "history", label: "기록" },
  { key: "updatedAt", label: "수정일" },
];

const VIEW_COLUMNS = {
  core: ["sequence", "status", "code", "codeChange", "parentCode", "simpleStatus", "name", "stock", "processingStock", "availableStock", "inboundDate", "inboundQty", "updatedAt", "history"],
  stock: ["sequence", "status", "code", "codeChange", "simpleStatus", "name", "stock", "processingStock", "availableStock", "inboundDate", "inboundQty", "updatedAt", "history"],
  catalog: ["sequence", "status", "code", "simpleStatus", "name", "stock", "processingStock", "availableStock", "salesLinks", "updatedAt", "history"],
  depletion: ["sequence", "status", "code", "simpleStatus", "name", "stock", "processingStock", "availableStock", "depletionEstimate", "depletionRate", "depletionDate", "updatedAt"],
  priceDate: ["sequence", "status", "code", "simpleStatus", "name", "stock", "processingStock", "availableStock", "priceSettings", "updatedAt", "history"],
  period: ["sequence", "status", "code", "simpleStatus", "name", "stock", "processingStock", "availableStock", "periodSales", "updatedAt", "history"],
  price: ["sequence", "status", "code", "simpleStatus", "name", "stock", "processingStock", "availableStock", "priceSettings", "updatedAt", "history"],
  changes: ["sequence", "status", "code", "codeChange", "simpleStatus", "name", "stockChangeDetail", "processingStockChangeDetail", "availableStockChangeDetail", "updatedAt", "history"],
  all: ["sequence", "status", "code", "codeChange", "parentCode", "simpleStatus", "name", "stock", "processingStock", "availableStock", "inboundDate", "inboundQty", "updatedAt", "note", "history"],
};

const HEADER_ALIASES = {
  code: [
    "상품코드",
    "상품 코드",
    "상품번호",
    "상품 번호",
    "품목코드",
    "옵션코드",
    "판매자상품코드",
    "판매자 관리코드",
    "관리코드",
    "sku",
    "code",
    "productcode",
    "itemcode",
  ],
  name: ["상품명", "상품 명", "상품명(심플명)", "심플명", "품목명", "옵션명", "productname", "itemname", "name"],
  stock: ["현재고", "현재 재고", "재고", "재고수량", "재고 수량", "stock", "stockqty", "inventory"],
  processingStock: ["처리중", "처리 중", "미발송", "미발송수량", "출고대기", "processing", "inprogress"],
  availableStock: ["가용재고", "가용 재고", "판매가능수량", "판매 가능 수량", "available", "availablestock"],
  orderQty: ["주문수량", "주문 수량", "구매수량", "구매 수량", "수량", "orderqty", "quantity", "qty"],
  simpleStatus: ["심플상태", "심플 상태", "상태", "판매상태", "판매 상태", "승인상태", "승인 상태", "처리상태", "처리 상태"],
  inboundDate: ["입고일정", "입고 일정", "입고예정일", "입고 예정일", "입고일", "schedule", "inbounddate"],
  inboundQty: ["입고수량", "입고 수량", "입고예정수량", "입고 예정 수량", "수량", "inboundqty"],
};

const ALIAS_SETS = Object.fromEntries(
  Object.entries(HEADER_ALIASES).map(([key, values]) => [key, new Set(values.map(normalizeHeader))]),
);

let state = loadState();
let activeTab = "all";
let activeView = "all";
let priceMode = "priceDate";
let changeFilter = "all";
let currentPage = 1;
let serverSyncEnabled = false;
let saveDebounceId = null;
let saveInFlight = false;
let queuedServerSave = false;
let lastLocalChangeAt = 0;
let currentUser = null;

const els = {
  authorInput: document.getElementById("authorInput"),
  saveStatus: document.getElementById("saveStatus"),
  totalCount: document.getElementById("totalCount"),
  negativeCount: document.getElementById("negativeCount"),
  watchCount: document.getElementById("watchCount"),
  inventoryHead: document.getElementById("inventoryHead"),
  inventoryBody: document.getElementById("inventoryBody"),
  emptyState: document.getElementById("emptyState"),
  paginationBar: document.getElementById("paginationBar"),
  pageInfo: document.getElementById("pageInfo"),
  firstPageBtn: document.getElementById("firstPageBtn"),
  lastPageBtn: document.getElementById("lastPageBtn"),
  pageNumberList: document.getElementById("pageNumberList"),
  inventoryPanel: document.getElementById("inventoryPanel"),
  importPanel: document.getElementById("importPanel"),
  tableWrap: document.querySelector(".table-wrap"),
  searchInput: document.getElementById("searchInput"),
  sortSelect: document.getElementById("sortSelect"),
  panelToolbar: document.querySelector(".panel-toolbar"),
  priceModeBar: document.getElementById("priceModeBar"),
  periodQueryBar: document.getElementById("periodQueryBar"),
  periodStartInput: document.getElementById("periodStartInput"),
  periodEndInput: document.getElementById("periodEndInput"),
  changeFilterBar: document.getElementById("changeFilterBar"),
  exportBtn: document.getElementById("exportBtn"),
  adminBtn: document.getElementById("adminBtn"),
  loginBtn: document.getElementById("loginBtn"),
  clearDataBtn: document.getElementById("clearDataBtn"),
  inventoryImportBtn: document.getElementById("inventoryImportBtn"),
  orderImportBtn: document.getElementById("orderImportBtn"),
  scheduleTemplateBtn: document.getElementById("scheduleTemplateBtn"),
  scheduleImportBtn: document.getElementById("scheduleImportBtn"),
  inventoryFileInput: document.getElementById("inventoryFileInput"),
  orderFileInput: document.getElementById("orderFileInput"),
  scheduleFileInput: document.getElementById("scheduleFileInput"),
  inventoryImportMeta: document.getElementById("inventoryImportMeta"),
  orderImportMeta: document.getElementById("orderImportMeta"),
  scheduleImportMeta: document.getElementById("scheduleImportMeta"),
  columnChips: document.getElementById("columnChips"),
  activityList: document.getElementById("activityList"),
  clearLogBtn: document.getElementById("clearLogBtn"),
  historyModal: document.getElementById("historyModal"),
  historyTitle: document.getElementById("historyTitle"),
  historyList: document.getElementById("historyList"),
  historyCloseBtn: document.getElementById("historyCloseBtn"),
  loginModal: document.getElementById("loginModal"),
  loginForm: document.getElementById("loginForm"),
  loginName: document.getElementById("loginName"),
  loginPassword: document.getElementById("loginPassword"),
  loginMessage: document.getElementById("loginMessage"),
  loginCloseBtn: document.getElementById("loginCloseBtn"),
  adminModal: document.getElementById("adminModal"),
  adminCloseBtn: document.getElementById("adminCloseBtn"),
  adminUserList: document.getElementById("adminUserList"),
  adminMessage: document.getElementById("adminMessage"),
};

document.querySelectorAll("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => setTab(button.dataset.tab));
});

document.querySelectorAll("[data-jump-tab]").forEach((button) => {
  button.addEventListener("click", () => setTab(button.dataset.jumpTab));
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

document.querySelectorAll("[data-price-mode]").forEach((button) => {
  button.addEventListener("click", () => setPriceMode(button.dataset.priceMode));
});

document.querySelectorAll("[data-change-filter]").forEach((button) => {
  button.addEventListener("click", () => setChangeFilter(button.dataset.changeFilter));
});

if (els.panelToolbar) {
  els.panelToolbar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-change-filter]");
    if (!button) return;
    setChangeFilter(button.dataset.changeFilter);
  });
}

els.searchInput.addEventListener("input", () => {
  currentPage = 1;
  render();
});
if (els.sortSelect) {
  els.sortSelect.addEventListener("change", () => {
    currentPage = 1;
    render();
  });
}
[els.periodStartInput, els.periodEndInput].forEach((input) => {
  if (!input) return;
  input.addEventListener("change", () => {
    currentPage = 1;
    render();
  });
});
els.firstPageBtn.addEventListener("click", () => {
  currentPage = 1;
  render();
});
els.lastPageBtn.addEventListener("click", () => {
  currentPage = Number(els.lastPageBtn.dataset.page || currentPage);
  render();
});
els.pageNumberList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-page]");
  if (!button) return;
  currentPage = Number(button.dataset.page || 1);
  render();
});
els.exportBtn.addEventListener("click", exportCsv);
els.adminBtn.addEventListener("click", openAdminModal);
els.loginBtn.addEventListener("click", handleLoginButton);
if (els.clearDataBtn) els.clearDataBtn.addEventListener("click", clearAllData);
els.inventoryImportBtn.addEventListener("click", () => {
  if (requireLogin("uploadInventory")) els.inventoryFileInput.click();
});
els.orderImportBtn.addEventListener("click", () => {
  if (requireLogin("uploadInventory")) els.orderFileInput.click();
});
els.scheduleTemplateBtn.addEventListener("click", downloadScheduleTemplate);
els.scheduleImportBtn.addEventListener("click", () => {
  if (requireLogin("editSchedule")) els.scheduleFileInput.click();
});
els.inventoryFileInput.addEventListener("change", () => handleFileSelection("inventory"));
els.orderFileInput.addEventListener("change", () => handleFileSelection("orders"));
els.scheduleFileInput.addEventListener("change", () => handleFileSelection("schedule"));
els.clearLogBtn.addEventListener("click", clearActivity);
els.inventoryBody.addEventListener("change", handleTableEdit);
els.inventoryBody.addEventListener("click", handleTableClick);
els.historyCloseBtn.addEventListener("click", closeHistoryModal);
els.historyModal.addEventListener("click", (event) => {
  if (event.target === els.historyModal) closeHistoryModal();
});
els.loginCloseBtn.addEventListener("click", closeLoginModal);
els.loginModal.addEventListener("click", (event) => {
  if (event.target === els.loginModal) closeLoginModal();
});
els.loginForm.addEventListener("submit", handleLoginSubmit);
els.adminCloseBtn.addEventListener("click", closeAdminModal);
els.adminModal.addEventListener("click", (event) => {
  if (event.target === els.adminModal) closeAdminModal();
});
els.adminUserList.addEventListener("change", handleAdminPermissionChange);

render();
bootApp();

async function bootApp() {
  await restoreLogin();
  await bootSharedState();
  render();
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeState(JSON.parse(raw)) : createDefaultState();
  } catch {
    return createDefaultState();
  }
}

function createDefaultState() {
  return { items: [], activity: [], lastColumns: [], memoResetVersion: 1 };
}

function normalizeState(snapshot) {
  const memoResetVersion = Number(snapshot?.memoResetVersion || 0);
  const items = Array.isArray(snapshot?.items) ? snapshot.items.map(cleanItem).filter(Boolean) : [];
  if (memoResetVersion < 1) {
    items.forEach((item) => {
      item.note = "";
    });
  }
  return {
    items,
    activity: Array.isArray(snapshot?.activity) ? snapshot.activity.slice(0, 100).map(normalizeActivityEntry) : [],
    lastColumns: Array.isArray(snapshot?.lastColumns) ? snapshot.lastColumns.map(String).slice(0, 30) : [],
    memoResetVersion: 1,
  };
}

function cleanItem(item) {
  const code = normalizeCode(item?.code || item?.productCode || item?.sku);
  if (!code) return null;
  return {
    id: String(item.id || createId()),
    code,
    codeChange: String(item.codeChange || "").trim(),
    parentCode: Boolean(item.parentCode),
    mainCode: normalizeCode(item.mainCode),
    inventoryOrder: toInteger(item.inventoryOrder, 999999),
    simpleStatus: normalizeSimpleStatus(item.simpleStatus),
    name: String(item.name || "").trim(),
    stock: toInteger(item.stock, 0),
    previousStock: toOptionalInteger(item.previousStock),
    stockDelta: toInteger(item.stockDelta, 0),
    processingStock: toInteger(item.processingStock, 0),
    previousProcessingStock: toOptionalInteger(item.previousProcessingStock),
    processingStockDelta: toInteger(item.processingStockDelta, 0),
    availableStock: toInteger(item.stock, 0) - toInteger(item.processingStock, 0),
    previousAvailableStock: toOptionalInteger(item.previousAvailableStock),
    availableStockDelta: toInteger(item.availableStockDelta, 0),
    previousStockChangedAt: item.previousStockChangedAt || "",
    stockChangedAt: item.stockChangedAt || "",
    inboundDate: String(item.inboundDate || "").trim(),
    inboundQty: toInteger(item.inboundQty, 0),
    orderQty: toInteger(item.orderQty, 0),
    inSimpleStock: Boolean(item.inSimpleStock ?? item.inApprovedStock),
    hiddenFromInventory: Boolean(item.hiddenFromInventory),
    source: String(item.source || "").trim(),
    salesLinks: normalizeSalesLinks(item.salesLinks, true),
    priceSettings: normalizePriceSettings(item.priceSettings, true),
    periodSales: normalizePeriodSales(item.periodSales, true),
    stockLogs: normalizeStockLogs(item.stockLogs),
    note: String(item.note || "").trim(),
    history: normalizeItemHistory(item.history),
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString(),
  };
}

function persist() {
  lastLocalChangeAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  els.saveStatus.textContent = serverSyncEnabled
    ? `공유 저장 예약됨 ${formatTime(new Date().toISOString())}`
    : `로컬 저장됨 ${formatTime(new Date().toISOString())}`;
  queueServerSave();
}

async function bootSharedState() {
  if (!isServerBacked()) {
    els.saveStatus.textContent = "브라우저 로컬 저장 중";
    return;
  }

  try {
    els.saveStatus.textContent = "공유 서버 연결 중";
    const sharedState = await fetchSharedState();
    const localState = normalizeState(state);
    serverSyncEnabled = true;

    if (!sharedState.items?.length && localState.items.length) {
      await saveSnapshotToServer(localState);
      els.saveStatus.textContent = `로컬 데이터를 공유 저장소로 이전함 ${formatTime(new Date().toISOString())}`;
    } else {
      replaceState(sharedState);
      render();
      els.saveStatus.textContent = `공유 저장소 연결됨 ${formatTime(new Date().toISOString())}`;
    }

    setInterval(refreshSharedState, 15000);
  } catch (error) {
    els.saveStatus.textContent = "공유 서버 연결 실패, 로컬 저장 중";
    console.warn(error);
  }
}

function replaceState(snapshot) {
  state = normalizeState(snapshot);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function isServerBacked() {
  return typeof fetch === "function" && typeof location !== "undefined" && /^https?:$/.test(location.protocol);
}

async function fetchSharedState() {
  const response = await fetch(API_STATE_URL, { headers: { Accept: "application/json" }, credentials: "same-origin" });
  if (!response.ok) throw new Error(`공유 데이터 조회 실패 (${response.status})`);
  return response.json();
}

function queueServerSave() {
  if (!isServerBacked()) return;
  clearTimeout(saveDebounceId);
  saveDebounceId = setTimeout(saveStateToServer, 250);
}

async function saveStateToServer() {
  if (!isServerBacked()) return;
  if (saveInFlight) {
    queuedServerSave = true;
    return;
  }

  saveInFlight = true;
  queuedServerSave = false;
  try {
    await saveSnapshotToServer(normalizeState(state));
    serverSyncEnabled = true;
    els.saveStatus.textContent = `공유 저장됨 ${formatTime(new Date().toISOString())}`;
  } catch (error) {
    els.saveStatus.textContent = "공유 저장 실패, 로컬에는 저장됨";
    console.warn(error);
  } finally {
    saveInFlight = false;
    if (queuedServerSave) saveStateToServer();
  }
}

async function saveSnapshotToServer(snapshot) {
  const response = await fetch(API_STATE_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(snapshot),
  });
  if (!response.ok) throw new Error(`공유 저장 실패 (${response.status})`);
  return response.json();
}

async function refreshSharedState() {
  if (!serverSyncEnabled || Date.now() - lastLocalChangeAt < 3000) return;
  try {
    const sharedState = normalizeState(await fetchSharedState());
    if (JSON.stringify(normalizeState(state)) !== JSON.stringify(sharedState)) {
      replaceState(sharedState);
      render();
      els.saveStatus.textContent = `공유 데이터 갱신됨 ${formatTime(new Date().toISOString())}`;
    }
  } catch (error) {
    console.warn(error);
  }
}

function render() {
  const items = state.items.filter(isVisibleInventoryItem).map((item) => ({ ...item, status: getStatus(item) }));
  const total = items.length;
  const negative = items.filter(isNegativeTabItem).length;
  const watch = items.filter(hasAnyStockChange).length;

  els.totalCount.textContent = formatNumber(total);
  els.negativeCount.textContent = formatNumber(negative);
  els.watchCount.textContent = formatNumber(watch);

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === activeTab);
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", activeTab === "all" && button.dataset.view === activeView);
  });

  if (els.priceModeBar) {
    els.priceModeBar.hidden = !(activeTab === "all" && activeView === "price");
    document.querySelectorAll("[data-price-mode]").forEach((button) => {
      button.classList.toggle("active", button.dataset.priceMode === priceMode);
    });
  }

  if (els.periodQueryBar) {
    els.periodQueryBar.hidden = !(activeTab === "all" && activeView === "price" && priceMode === "period");
  }

  if (els.changeFilterBar) {
    els.changeFilterBar.hidden = activeTab !== "allStockChanges";
    document.querySelectorAll("[data-change-filter]").forEach((button) => {
      button.classList.toggle("active", button.dataset.changeFilter === changeFilter);
    });
  }

  els.inventoryPanel.hidden = false;
  els.importPanel.hidden = activeTab !== "import";
  if (els.tableWrap) els.tableWrap.hidden = activeTab === "import";
  if (activeTab === "import") {
    els.emptyState.hidden = true;
    els.paginationBar.hidden = true;
  }

  renderImportPanel();
  renderTable();
  updateLoginLockedControls();
}

function renderTable() {
  if (activeTab === "import") return;
  const query = normalizeSearch(els.searchInput.value);
  const rows = state.items
    .filter(isVisibleInventoryItem)
    .map((item) => ({ ...item, availableStock: item.stock - item.processingStock, status: getStatus(item) }))
    .filter((item) => {
      if (!matchesActiveTab(item)) return false;
      if (!query) return true;
      return normalizeSearch(`${item.code} ${item.codeChange} ${item.name} ${item.note} ${formatSalesLinksSearch(item.salesLinks)} ${formatPriceTrackingSearch(item)}`).includes(query);
    })
    .sort(sortItems);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  currentPage = Math.min(Math.max(1, currentPage), totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = rows.slice(pageStart, currentPage * PAGE_SIZE);

  els.emptyState.hidden = rows.length > 0;
  els.inventoryHead.innerHTML = getVisibleColumns().map((column) => `<th class="${getColumnHeaderClass(column.key)}">${escapeHtml(column.label)}</th>`).join("");
  els.inventoryBody.innerHTML = pageRows.map((item, index) => renderRow(item, pageStart + index + 1)).join("");
  renderPagination(rows.length, totalPages);
}

function renderPagination(totalRows, totalPages) {
  els.paginationBar.hidden = totalRows <= PAGE_SIZE;
  els.pageInfo.textContent = `총 ${formatNumber(totalRows)}개`;
  els.firstPageBtn.disabled = currentPage <= 1;
  els.lastPageBtn.disabled = currentPage >= totalPages;
  els.lastPageBtn.dataset.page = String(totalPages);
  els.pageNumberList.innerHTML = getPageNumbers(currentPage, totalPages)
    .map((page) =>
      page === "gap"
        ? `<span class="page-gap">…</span>`
        : `<button class="page-number ${page === currentPage ? "active" : ""}" data-page="${page}" type="button">${formatNumber(page)}</button>`,
    )
    .join("");
}

function getPageNumbers(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((item) => pages.add(item));
  if (page >= totalPages - 2) [totalPages - 3, totalPages - 2, totalPages - 1].forEach((item) => pages.add(item));
  const sorted = [...pages].filter((item) => item >= 1 && item <= totalPages).sort((a, b) => a - b);
  return sorted.flatMap((item, index) => (index > 0 && item - sorted[index - 1] > 1 ? ["gap", item] : [item]));
}

function renderRow(item, rowNumber = 0) {
  const rowClass = `row-${item.status.key}`;
  return `
    <tr class="${rowClass}">
      ${getVisibleColumns().map((column) => renderCell(item, column, rowNumber)).join("")}
    </tr>
  `;
}

function getVisibleColumns() {
  const viewKey = activeView === "price" ? priceMode : activeView;
  const keys = VIEW_COLUMNS[viewKey] || VIEW_COLUMNS.all;
  return keys.map((key) => COLUMNS.find((column) => column.key === key)).filter(Boolean);
}

function getColumnHeaderClass(key) {
  if (key === "sequence") return "sequence-head";
  if (key === "inboundQty") return "center-head";
  if (["stock", "processingStock", "availableStock", "inboundQty", "orderQty"].includes(key)) return "number-head";
  if (["status", "parentCode", "mainCode", "simpleStatus", "history"].includes(key)) return "center-head";
  if (["inboundDate", "updatedAt", "depletionDate"].includes(key)) return "date-head";
  if (key === "codeChange" || key === "mainCode") return "code-change-head";
  if (key === "code") return "code-head";
  return "";
}

function renderCell(item, column, rowNumber = 0) {
  if (column.key === "sequence") return `<td class="sequence-cell">${formatNumber(rowNumber)}</td>`;
  if (column.key === "status") {
    return `<td><span class="status ${item.status.className}">${escapeHtml(item.status.label)}</span></td>`;
  }
  if (column.key === "code") return `<td class="code-cell">${escapeHtml(item.code)}</td>`;
  if (column.key === "codeChange") return renderCodeChangeCell(item);
  if (column.key === "parentCode") return renderParentCodeCell(item);
  if (column.key === "mainCode") return renderMainCodeCell(item);
  if (column.key === "simpleStatus") return `<td>${renderSimpleStatus(item.simpleStatus)}</td>`;
  if (column.key === "name") return renderNameCell(item);
  if (column.key === "depletionEstimate") return renderDepletionEstimateCell(item);
  if (["stockChangeDetail", "processingStockChangeDetail", "availableStockChangeDetail"].includes(column.key)) return renderStockChangeDetailCell(item, column.key);
  if (column.key === "depletionRate") return renderDepletionRateCell(item);
  if (column.key === "depletionDate") return renderDepletionDateCell(item);
  if (["stock", "processingStock", "availableStock", "orderQty", "inboundQty"].includes(column.key)) {
    const value = column.key === "availableStock" ? item.stock - item.processingStock : item[column.key] || 0;
    if (["stock", "processingStock", "availableStock"].includes(column.key)) {
      return renderStockNumberCell(item, column.key, value);
    }
    const extraClass = column.key === "inboundQty" ? " inbound-qty-cell" : "";
    return `<td class="number-cell${extraClass}">${formatNumber(value)}</td>`;
  }
  if (column.key === "inboundDate") return `<td class="schedule-cell">${escapeHtml(item.inboundDate || "-")}</td>`;
  if (column.key === "source") return `<td class="text-cell">${item.inSimpleStock ? escapeHtml(item.source || "심플 재고목록") : "주문서/기존자료"}</td>`;
  if (column.key === "salesLinks") return renderSalesLinksCell(item);
  if (column.key === "priceSettings") return renderPriceSettingsCell(item);
  if (column.key === "periodSales") return renderPeriodSalesCell(item);
  if (column.key === "note") {
    return `
      <td class="note-cell">
        <textarea data-note-input data-code="${escapeHtml(item.code)}" rows="2" placeholder="비고나 특이사항 입력">${escapeHtml(item.note || "")}</textarea>
      </td>
    `;
  }
  if (column.key === "history") return renderHistoryCell(item);
  if (column.key === "updatedAt") return `<td class="date-cell">${escapeHtml(formatDate(item.updatedAt))}</td>`;
  return `<td class="text-cell">${escapeHtml(item[column.key] || "-")}</td>`;
}

function renderNameCell(item) {
  const hasDot = shouldShowNewAlertDot(item);
  const isSubCode = Boolean(item.mainCode && item.mainCode !== item.code);
  return `
    <td class="name-cell ${hasDot ? "has-new-alert" : ""} ${isSubCode ? "is-sub-code" : ""}">
      <div class="name-line">
        ${hasDot ? `<span class="new-alert-dot" title="새로 생긴 주의 품목" aria-label="새로 생긴 주의 품목"></span>` : ""}
        ${isSubCode ? `<span class="sub-code-mark">ㄴ</span>` : ""}
        <strong>${escapeHtml(item.name || "-")}</strong>
      </div>
    </td>
  `;
}

function handleTableEdit(event) {
  if (!event.target.matches("[data-note-input], [data-code-change-input], [data-main-code-input], [data-sales-link-input], [data-price-input], [data-period-input]")) return;
  const permissionKey = event.target.matches("[data-note-input]") ? "editMemo" : "manageLinks";
  if (!requireLogin(permissionKey)) {
    render();
    return;
  }
  const item = findItemByCode(event.target.dataset.code);
  if (!item) return;
  if (event.target.matches("[data-note-input]")) {
    const nextValue = event.target.value.trim();
    recordItemEdit(item, "메모", item.note, nextValue);
    item.note = nextValue;
  } else if (event.target.matches("[data-sales-link-input]")) {
    updateSalesLinkField(item, event.target.dataset.linkId, event.target.dataset.field, event.target.value);
  } else if (event.target.matches("[data-price-input]")) {
    updatePriceSettingField(item, event.target.dataset.priceId, event.target.dataset.field, event.target.value);
  } else if (event.target.matches("[data-period-input]")) {
    updatePeriodSaleField(item, event.target.dataset.periodId, event.target.dataset.field, event.target.value);
  } else {
    const nextValue = event.target.matches("[data-main-code-input]") ? normalizeCode(event.target.value) : event.target.value.trim();
    if (event.target.matches("[data-main-code-input]")) {
      const safeValue = nextValue === item.code ? "" : nextValue;
      recordItemEdit(item, "소속 메인코드", item.mainCode, safeValue);
      item.mainCode = safeValue;
    } else {
      recordItemEdit(item, "변경코드", item.codeChange, nextValue);
      item.codeChange = nextValue;
    }
  }
  item.updatedAt = new Date().toISOString();
  persist();
  render();
}

function updatePriceSettingField(item, rowId, field, value) {
  const rows = normalizePriceSettings(item.priceSettings, true);
  let row = rows.find((entry) => entry.id === rowId);
  if (!row) {
    row = createEmptyPriceSetting(rowId);
    rows.push(row);
  }
  if (!["oldPrice", "newPrice", "date", "soldQty", "memo"].includes(field)) return;
  const before = formatPriceSettingForHistory(row);
  row[field] = ["oldPrice", "newPrice", "soldQty"].includes(field) ? cleanNumberText(value) : String(value || "").trim();
  item.priceSettings = rows.filter(hasPriceSettingContent);
  recordItemEdit(item, "가격설정", before, formatPriceSettingForHistory(row));
}

function updatePeriodSaleField(item, rowId, field, value) {
  const rows = normalizePeriodSales(item.periodSales, true);
  let row = rows.find((entry) => entry.id === rowId);
  if (!row) {
    row = createEmptyPeriodSale(rowId);
    rows.push(row);
  }
  if (!["startDate", "endDate", "soldQty", "memo"].includes(field)) return;
  const before = formatPeriodSaleForHistory(row);
  row[field] = field === "soldQty" ? cleanNumberText(value) : String(value || "").trim();
  item.periodSales = rows.filter(hasPeriodSaleContent);
  recordItemEdit(item, "기간판매", before, formatPeriodSaleForHistory(row));
}

function updateSalesLinkField(item, linkId, field, value) {
  const links = normalizeSalesLinks(item.salesLinks, true);
  let link = links.find((entry) => entry.id === linkId);
  if (!link) {
    link = createEmptySalesLink(linkId);
    links.push(link);
  }
  if (!["platform", "productName", "qty", "url"].includes(field)) return;
  const before = formatSalesLinkForHistory(link);
  link[field] = field === "qty" ? String(value || "").replace(/[^\d.-]/g, "").trim() : String(value || "").trim();
  item.salesLinks = links.filter(hasSalesLinkContent);
  recordItemEdit(item, "판매링크", before, formatSalesLinkForHistory(link));
}

function renderCodeChangeCell(item) {
  return `
    <td class="code-change-cell">
      <input data-code-change-input data-code="${escapeHtml(item.code)}" value="${escapeHtml(item.codeChange || "")}" placeholder="예: 7004" />
    </td>
  `;
}

function renderMainCodeCell(item) {
  return `
    <td class="main-code-cell">
      <input data-main-code-input data-code="${escapeHtml(item.code)}" value="${escapeHtml(item.mainCode || "")}" placeholder="예: 9452" />
    </td>
  `;
}

function renderSalesLinksCell(item) {
  const links = normalizeSalesLinks(item.salesLinks, true);
  const rows = links.length ? links : [createEmptySalesLink()];
  return `
    <td class="sales-links-cell">
      <div class="sales-link-head" aria-hidden="true">
        <span>플랫폼</span>
        <span>판매상품명</span>
        <span>수량</span>
        <span>상품페이지링크</span>
        <span></span>
      </div>
      <div class="sales-link-list">
        ${rows.map((link) => renderSalesLinkRow(item, link)).join("")}
      </div>
      <button class="sales-link-add" data-sales-link-add data-code="${escapeHtml(item.code)}" type="button">판매링크 추가</button>
    </td>
  `;
}

function renderSalesLinkRow(item, link) {
  const isSaved = Boolean(link.id && normalizeSalesLinks(item.salesLinks, true).some((entry) => entry.id === link.id));
  return `
    <div class="sales-link-row">
      <input data-sales-link-input data-code="${escapeHtml(item.code)}" data-link-id="${escapeHtml(link.id)}" data-field="platform" value="${escapeHtml(link.platform)}" placeholder="오늘의집" />
      <input data-sales-link-input data-code="${escapeHtml(item.code)}" data-link-id="${escapeHtml(link.id)}" data-field="productName" value="${escapeHtml(link.productName)}" placeholder="판매상품명" />
      <input data-sales-link-input data-code="${escapeHtml(item.code)}" data-link-id="${escapeHtml(link.id)}" data-field="qty" value="${escapeHtml(link.qty)}" placeholder="수량" inputmode="numeric" />
      <input data-sales-link-input data-code="${escapeHtml(item.code)}" data-link-id="${escapeHtml(link.id)}" data-field="url" value="${escapeHtml(link.url)}" placeholder="https://..." />
      <button class="sales-link-delete" data-sales-link-delete data-code="${escapeHtml(item.code)}" data-link-id="${escapeHtml(link.id)}" type="button" ${isSaved ? "" : "disabled"}>삭제</button>
    </div>
  `;
}

function renderPriceSettingsCell(item) {
  const rows = normalizePriceSettings(item.priceSettings, true);
  const displayRows = rows.length ? rows : [createEmptyPriceSetting()];
  return `
    <td class="price-tracking-cell">
      <div class="price-tracking-head price-date-head" aria-hidden="true">
        <span>기존가격</span>
        <span>조정가격</span>
        <span>가격설정일</span>
        <span>판매량</span>
        <span>메모</span>
        <span></span>
      </div>
      <div class="price-tracking-list">
        ${displayRows.map((entry) => renderPriceSettingRow(item, entry)).join("")}
      </div>
      <button class="price-tracking-add" data-price-add data-code="${escapeHtml(item.code)}" type="button">가격기록 추가</button>
    </td>
  `;
}

function renderPriceSettingRow(item, entry) {
  const isSaved = Boolean(entry.id && normalizePriceSettings(item.priceSettings, true).some((saved) => saved.id === entry.id));
  return `
    <div class="price-tracking-row price-date-row">
      <input data-price-input data-code="${escapeHtml(item.code)}" data-price-id="${escapeHtml(entry.id)}" data-field="oldPrice" value="${escapeHtml(entry.oldPrice)}" placeholder="예: 199000" inputmode="numeric" />
      <input data-price-input data-code="${escapeHtml(item.code)}" data-price-id="${escapeHtml(entry.id)}" data-field="newPrice" value="${escapeHtml(entry.newPrice)}" placeholder="예: 179000" inputmode="numeric" />
      <input data-price-input data-code="${escapeHtml(item.code)}" data-price-id="${escapeHtml(entry.id)}" data-field="date" value="${escapeHtml(entry.date)}" placeholder="26.07.09" />
      <input data-price-input data-code="${escapeHtml(item.code)}" data-price-id="${escapeHtml(entry.id)}" data-field="soldQty" value="${escapeHtml(entry.soldQty)}" placeholder="판매량" inputmode="numeric" />
      <input data-price-input data-code="${escapeHtml(item.code)}" data-price-id="${escapeHtml(entry.id)}" data-field="memo" value="${escapeHtml(entry.memo)}" placeholder="메모" />
      <button class="price-tracking-delete" data-price-delete data-code="${escapeHtml(item.code)}" data-price-id="${escapeHtml(entry.id)}" type="button" ${isSaved ? "" : "disabled"}>삭제</button>
    </div>
  `;
}

function renderPeriodSalesCell(item) {
  const range = getPeriodQueryRange();
  const stats = getPeriodSalesStats(item, range);
  if (!range.start || !range.end) {
    return `
      <td class="period-sales-cell">
        <strong>기간 선택 필요</strong>
        <span>위에서 시작일과 종료일을 선택하면 자동으로 계산됩니다.</span>
      </td>
    `;
  }

  return `
    <td class="period-sales-cell">
      <div class="period-sales-summary">
        <strong>${formatNumber(stats.soldQty)}개 판매</strong>
        <span>${escapeHtml(formatPeriodRangeLabel(range))}</span>
        <span>증가 ${formatNumber(stats.increasedQty)}개 / 순변동 ${formatSignedNumber(stats.netChange)}개</span>
        <span>기록 ${formatNumber(stats.logCount)}건 기준</span>
      </div>
    </td>
  `;
}

function renderPeriodSaleRow(item, entry) {
  const isSaved = Boolean(entry.id && normalizePeriodSales(item.periodSales, true).some((saved) => saved.id === entry.id));
  return `
    <div class="price-tracking-row period-sale-row">
      <input data-period-input data-code="${escapeHtml(item.code)}" data-period-id="${escapeHtml(entry.id)}" data-field="startDate" value="${escapeHtml(entry.startDate)}" placeholder="26.07.09" />
      <input data-period-input data-code="${escapeHtml(item.code)}" data-period-id="${escapeHtml(entry.id)}" data-field="endDate" value="${escapeHtml(entry.endDate)}" placeholder="26.07.15" />
      <input data-period-input data-code="${escapeHtml(item.code)}" data-period-id="${escapeHtml(entry.id)}" data-field="soldQty" value="${escapeHtml(entry.soldQty)}" placeholder="판매량" inputmode="numeric" />
      <input data-period-input data-code="${escapeHtml(item.code)}" data-period-id="${escapeHtml(entry.id)}" data-field="memo" value="${escapeHtml(entry.memo)}" placeholder="메모" />
      <button class="price-tracking-delete" data-period-delete data-code="${escapeHtml(item.code)}" data-period-id="${escapeHtml(entry.id)}" type="button" ${isSaved ? "" : "disabled"}>삭제</button>
    </div>
  `;
}

function handleTableClick(event) {
  const historyButton = event.target.closest("[data-history-open]");
  if (historyButton) {
    const item = findItemByCode(historyButton.dataset.code);
    if (item) openHistoryModal(item);
    return;
  }

  const addPriceButton = event.target.closest("[data-price-add]");
  if (addPriceButton) {
    if (!requireLogin("manageLinks")) return;
    const item = findItemByCode(addPriceButton.dataset.code);
    if (!item) return;
    item.priceSettings = [...normalizePriceSettings(item.priceSettings, true), createEmptyPriceSetting()];
    item.updatedAt = new Date().toISOString();
    recordItemEdit(item, "가격설정", "", "가격기록 추가");
    persist();
    render();
    return;
  }

  const deletePriceButton = event.target.closest("[data-price-delete]");
  if (deletePriceButton) {
    if (!requireLogin("manageLinks")) return;
    const item = findItemByCode(deletePriceButton.dataset.code);
    if (!item) return;
    const rows = normalizePriceSettings(item.priceSettings, true);
    const removed = rows.find((entry) => entry.id === deletePriceButton.dataset.priceId);
    item.priceSettings = rows.filter((entry) => entry.id !== deletePriceButton.dataset.priceId);
    item.updatedAt = new Date().toISOString();
    recordItemEdit(item, "가격설정", formatPriceSettingForHistory(removed), "삭제");
    persist();
    render();
    return;
  }

  const addPeriodButton = event.target.closest("[data-period-add]");
  if (addPeriodButton) {
    if (!requireLogin("manageLinks")) return;
    const item = findItemByCode(addPeriodButton.dataset.code);
    if (!item) return;
    item.periodSales = [...normalizePeriodSales(item.periodSales, true), createEmptyPeriodSale()];
    item.updatedAt = new Date().toISOString();
    recordItemEdit(item, "기간판매", "", "기간기록 추가");
    persist();
    render();
    return;
  }

  const deletePeriodButton = event.target.closest("[data-period-delete]");
  if (deletePeriodButton) {
    if (!requireLogin("manageLinks")) return;
    const item = findItemByCode(deletePeriodButton.dataset.code);
    if (!item) return;
    const rows = normalizePeriodSales(item.periodSales, true);
    const removed = rows.find((entry) => entry.id === deletePeriodButton.dataset.periodId);
    item.periodSales = rows.filter((entry) => entry.id !== deletePeriodButton.dataset.periodId);
    item.updatedAt = new Date().toISOString();
    recordItemEdit(item, "기간판매", formatPeriodSaleForHistory(removed), "삭제");
    persist();
    render();
    return;
  }

  const addSalesLinkButton = event.target.closest("[data-sales-link-add]");
  if (addSalesLinkButton) {
    if (!requireLogin("manageLinks")) return;
    const item = findItemByCode(addSalesLinkButton.dataset.code);
    if (!item) return;
    item.salesLinks = [...normalizeSalesLinks(item.salesLinks, true), createEmptySalesLink()];
    item.updatedAt = new Date().toISOString();
    recordItemEdit(item, "판매링크", "", "판매링크 추가");
    persist();
    render();
    return;
  }

  const deleteSalesLinkButton = event.target.closest("[data-sales-link-delete]");
  if (deleteSalesLinkButton) {
    if (!requireLogin("manageLinks")) return;
    const item = findItemByCode(deleteSalesLinkButton.dataset.code);
    if (!item) return;
    const links = normalizeSalesLinks(item.salesLinks, true);
    const removed = links.find((entry) => entry.id === deleteSalesLinkButton.dataset.linkId);
    item.salesLinks = links.filter((entry) => entry.id !== deleteSalesLinkButton.dataset.linkId);
    item.updatedAt = new Date().toISOString();
    recordItemEdit(item, "판매링크", formatSalesLinkForHistory(removed), "삭제");
    persist();
    render();
    return;
  }

  const button = event.target.closest("[data-parent-code-toggle]");
  if (!button) return;
  if (!requireLogin("manageLinks")) return;
  const item = findItemByCode(button.dataset.code);
  if (!item) return;
  const nextValue = !item.parentCode;
  recordItemEdit(item, "메인코드", item.parentCode ? "지정" : "미지정", nextValue ? "지정" : "미지정");
  item.parentCode = !item.parentCode;
  if (item.parentCode && item.mainCode === item.code) item.mainCode = "";
  item.updatedAt = new Date().toISOString();
  persist();
  render();
}

function renderHistoryCell(item) {
  return `
    <td class="history-cell">
      <button class="history-button" data-history-open data-code="${escapeHtml(item.code)}" type="button">기록보기</button>
    </td>
  `;
}

function renderStockNumberCell(item, key, value) {
  const valueClass = key === "availableStock" ? item.status.className : "";
  return `<td class="number-cell ${valueClass}">${formatNumber(value)}</td>`;
}

function getStockDelta(item, key) {
  if (key === "stock") return item.stockDelta || 0;
  if (key === "processingStock") return item.processingStockDelta || 0;
  if (key === "availableStock") return item.availableStockDelta || 0;
  return 0;
}

function getStockChangePair(item, key) {
  const map = {
    stock: ["previousStock", "stock"],
    processingStock: ["previousProcessingStock", "processingStock"],
    availableStock: ["previousAvailableStock", "availableStock"],
  };
  const fields = map[key];
  if (!fields || !getStockDelta(item, key)) return null;
  const previous = Number(item[fields[0]]);
  const current = key === "availableStock" ? item.stock - item.processingStock : Number(item[fields[1]]);
  if (!Number.isFinite(previous) || !Number.isFinite(current)) return null;
  if (previous === current) return null;
  return { previous, current };
}

function renderStockChangeDetailCell(item, key) {
  const stockKey = key === "stockChangeDetail" ? "stock" : key === "processingStockChangeDetail" ? "processingStock" : "availableStock";
  const pair = getStockChangePair(item, stockKey);
  if (!pair) return `<td class="change-cell muted">-</td>`;
  const className = pair.current > pair.previous ? "change-up" : "change-down";
  return `<td class="change-cell ${className}"><strong>${formatNumber(pair.previous)} → ${formatNumber(pair.current)}</strong></td>`;
}

function hasAnyStockChange(item) {
  if (item.parentCode) return false;
  return Boolean(getStockChangePair(item, "stock") || getStockChangePair(item, "processingStock") || getStockChangePair(item, "availableStock"));
}

function renderDepletionEstimateCell(item) {
  const estimate = getDepletionEstimate(item);
  return `
    <td class="depletion-cell ${estimate.className}">
      <strong>${escapeHtml(estimate.label)}</strong>
      <span>${escapeHtml(estimate.detail)}</span>
    </td>
  `;
}

function renderDepletionRateCell(item) {
  const estimate = getDepletionEstimate(item);
  return `<td class="depletion-rate-cell ${estimate.className}">${escapeHtml(estimate.rateText)}</td>`;
}

function renderDepletionDateCell(item) {
  const estimate = getDepletionEstimate(item);
  return `<td class="date-cell ${estimate.className}">${escapeHtml(estimate.dateText)}</td>`;
}

function getDepletionEstimate(item) {
  const availableStock = item.stock - item.processingStock;
  if (item.parentCode) return createDepletionResult("메인코드", "구성품 재고 확인", "-", "-", "depletion-muted");
  if (availableStock <= 0) return createDepletionResult("이미 0 이하", "즉시 확인", "-", "현재", "depletion-danger");

  const delta = Number(item.availableStockDelta || 0);
  if (delta > 0) return createDepletionResult("증가중", `최근 +${formatNumber(delta)}개`, `+${formatNumber(delta)}개`, "-", "depletion-up");
  if (delta === 0) return createDepletionResult("변동없음", "최근 감소 없음", "0개", "-", "depletion-muted");

  const previousAt = parseDateValue(item.previousStockChangedAt || item.createdAt);
  const changedAt = parseDateValue(item.stockChangedAt || item.updatedAt);
  const elapsedDays = previousAt && changedAt ? Math.max(1, Math.round((changedAt - previousAt) / 86400000)) : 0;
  if (!elapsedDays) return createDepletionResult("계산대기", "다음 재고 등록 후 계산", `${formatNumber(delta)}개`, "-", "depletion-muted");

  const dailyDecrease = Math.abs(delta) / elapsedDays;
  if (dailyDecrease <= 0) return createDepletionResult("계산대기", "감소 속도 없음", "0개/일", "-", "depletion-muted");

  const daysLeft = Math.max(1, Math.ceil(availableStock / dailyDecrease));
  const expectedDate = new Date(changedAt.getTime() + daysLeft * 86400000);
  const className = daysLeft <= 3 ? "depletion-danger" : daysLeft <= 7 ? "depletion-warning" : daysLeft <= 14 ? "depletion-caution" : "depletion-ok";
  return createDepletionResult(`${formatNumber(daysLeft)}일 후`, `0개 예상`, `${formatNumber(dailyDecrease.toFixed(1))}개/일 감소`, formatShortDate(expectedDate), className);
}

function createDepletionResult(label, detail, rateText, dateText, className) {
  return { label, detail, rateText, dateText, className };
}

function parseDateValue(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatShortDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}.${day}`;
}

function recordItemEdit(item, field, beforeValue, afterValue) {
  const beforeText = String(beforeValue ?? "").trim();
  const afterText = String(afterValue ?? "").trim();
  if (beforeText === afterText) return;
  const author = getLoginUser() || "작성자 미지정";
  item.history = normalizeItemHistory(item.history);
  item.history.unshift({
    id: createId(),
    at: new Date().toISOString(),
    author,
    field,
    before: beforeText,
    after: afterText,
  });
  item.history = item.history.slice(0, 100);
  addActivity("상품 수정", `${author} / ${item.code} / ${field}`);
}

function openHistoryModal(item) {
  els.historyTitle.textContent = `${item.code} ${item.name || ""}`.trim();
  const history = normalizeItemHistory(item.history);
  els.historyList.innerHTML = history.length
    ? history
        .map(
          (entry) => `
            <article class="history-entry">
              <time>${escapeHtml(formatDate(entry.at))}</time>
              <div>
                <strong>${escapeHtml(entry.author)} / ${escapeHtml(entry.field)}</strong>
                <p>${escapeHtml(entry.before || "빈칸")} → ${escapeHtml(entry.after || "빈칸")}</p>
              </div>
            </article>
          `,
        )
        .join("")
    : `<div class="empty-state"><strong>아직 수정 기록이 없습니다.</strong></div>`;
  els.historyModal.hidden = false;
}

function closeHistoryModal() {
  els.historyModal.hidden = true;
}

async function restoreLogin() {
  try {
    const response = await fetch("/api/auth/me", { headers: { Accept: "application/json" }, credentials: "same-origin" });
    const data = response.ok ? await response.json() : { user: null };
    setLoginUser(data.user || null);
  } catch {
    setLoginUser(null);
  }
}

function getLoginUser() {
  return currentUser?.displayName || "";
}

function hasPermission(key) {
  if (!currentUser) return false;
  if (currentUser.role === "admin") return true;
  return Boolean(currentUser.permissions?.[key]);
}

function setLoginUser(user) {
  currentUser = user || null;
  const name = getLoginUser();
  if (name) localStorage.setItem(AUTHOR_KEY, name);
  els.authorInput.value = name || "";
  els.loginBtn.textContent = name ? `${name} 로그아웃` : "로그인";
  els.loginBtn.classList.toggle("primary", !name);
  els.loginBtn.classList.toggle("subtle", Boolean(name));
  if (els.adminBtn) els.adminBtn.hidden = !hasPermission("manageUsers");
}

function requireLogin(permissionKey = "") {
  if (currentUser && (!permissionKey || hasPermission(permissionKey))) return true;
  openLoginModal(currentUser ? "이 작업을 할 권한이 없습니다." : "수정하거나 파일을 등록하려면 먼저 로그인해주세요.");
  return false;
}

function isLoggedIn() {
  return Boolean(currentUser);
}

function updateLoginLockedControls() {
  const locked = !isLoggedIn();
  setControlLock(els.inventoryImportBtn, locked || !hasPermission("uploadInventory"), "재고목록 등록 권한이 필요합니다.");
  setControlLock(els.orderImportBtn, locked || !hasPermission("uploadInventory"), "주문서 등록 권한이 필요합니다.");
  setControlLock(els.scheduleImportBtn, locked || !hasPermission("editSchedule"), "입고일정 수정 권한이 필요합니다.");
  document.querySelectorAll("[data-code-change-input], [data-parent-code-toggle], [data-main-code-input], [data-sales-link-input], [data-sales-link-add], [data-sales-link-delete], [data-price-input], [data-price-add], [data-price-delete], [data-period-input], [data-period-add], [data-period-delete]").forEach((control) => {
    setControlLock(control, locked || !hasPermission("manageLinks"), "변경코드/메인코드/판매링크 수정 권한이 필요합니다.");
  });
  document.querySelectorAll("[data-note-input]").forEach((control) => {
    setControlLock(control, locked || !hasPermission("editMemo"), "메모 수정 권한이 필요합니다.");
  });
}

function setControlLock(control, locked, message) {
  if (!control) return;
  control.disabled = locked;
  control.title = locked ? (isLoggedIn() ? message : "로그인 후 사용할 수 있습니다.") : "";
}

async function handleLoginButton() {
  if (currentUser) {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    setLoginUser(null);
    render();
    return;
  }
  openLoginModal("");
}

function openLoginModal(message) {
  els.loginMessage.textContent = message || "";
  els.loginPassword.value = "";
  els.loginModal.hidden = false;
  setTimeout(() => {
    if (!els.loginName.value) els.loginName.focus();
    else els.loginPassword.focus();
  }, 0);
}

function closeLoginModal() {
  els.loginModal.hidden = true;
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const loginId = els.loginName.value.trim();
  const password = els.loginPassword.value;
  els.loginMessage.textContent = "로그인 확인 중...";
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ loginId, password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      els.loginMessage.textContent = data.error || "아이디 또는 비밀번호가 맞지 않습니다.";
      return;
    }
    setLoginUser(data.user);
    closeLoginModal();
    await bootSharedState();
    render();
  } catch {
    els.loginMessage.textContent = "로그인 서버에 연결하지 못했습니다.";
  }
}

async function openAdminModal() {
  if (!requireLogin("manageUsers")) return;
  els.adminModal.hidden = false;
  els.adminMessage.textContent = "사용자 목록을 불러오는 중...";
  try {
    const response = await fetch("/api/admin/users", { headers: { Accept: "application/json" }, credentials: "same-origin" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "사용자 목록을 불러오지 못했습니다.");
    els.adminUserList.innerHTML = data.users.map(renderAdminUserRow).join("");
    els.adminMessage.textContent = "";
  } catch (error) {
    els.adminUserList.innerHTML = "";
    els.adminMessage.textContent = error.message || "관리자모드를 열지 못했습니다.";
  }
}

function closeAdminModal() {
  els.adminModal.hidden = true;
}

function renderAdminUserRow(user) {
  const permissionLabels = [
    ["uploadInventory", "재고등록"],
    ["editMemo", "메모"],
    ["editSchedule", "입고일정"],
    ["manageLinks", "변경코드"],
    ["manageUsers", "사용자관리"],
  ];
  return `
    <article class="admin-user-row" data-user-id="${escapeHtml(user.id)}">
      <div class="admin-user-main">
        <strong>${escapeHtml(user.displayName || user.loginId || "-")}</strong>
        <span>${escapeHtml(user.loginId || "")} / ${escapeHtml(user.role || "member")}</span>
      </div>
      <label class="admin-check">
        <input type="checkbox" data-admin-field="isActive" ${user.isActive ? "checked" : ""} />
        사용
      </label>
      ${permissionLabels
        .map(
          ([key, label]) => `
            <label class="admin-check">
              <input type="checkbox" data-admin-field="${key}" ${user.permissions?.[key] ? "checked" : ""} />
              ${label}
            </label>
          `,
        )
        .join("")}
    </article>
  `;
}

async function handleAdminPermissionChange(event) {
  const input = event.target.closest("[data-admin-field]");
  if (!input) return;
  const row = input.closest("[data-user-id]");
  if (!row) return;
  const userId = row.dataset.userId;
  const payload = { userId };
  row.querySelectorAll("[data-admin-field]").forEach((field) => {
    const name = field.dataset.adminField;
    const serverKey = {
      isActive: "is_active",
      uploadInventory: "can_upload_inventory",
      editMemo: "can_edit_memo",
      editSchedule: "can_edit_schedule",
      manageLinks: "can_manage_links",
      manageUsers: "can_manage_users",
    }[name];
    if (serverKey) payload[serverKey] = field.checked;
  });

  els.adminMessage.textContent = "권한 저장 중...";
  try {
    const response = await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "권한 저장에 실패했습니다.");
    els.adminMessage.textContent = "권한이 저장되었습니다.";
  } catch (error) {
    els.adminMessage.textContent = error.message || "권한 저장에 실패했습니다.";
    input.checked = !input.checked;
  }
}

function renderParentCodeCell(item) {
  const label = item.parentCode ? "해제" : "지정";
  return `
    <td class="parent-code-cell">
      <button class="parent-code-button ${item.parentCode ? "active" : ""}" data-parent-code-toggle data-code="${escapeHtml(item.code)}" type="button">${label}</button>
    </td>
  `;
}

function renderSimpleStatus(value) {
  const status = normalizeSimpleStatus(value);
  if (!status) return `<span class="simple-status simple-status-empty">-</span>`;
  const className = status === "승인" ? "simple-status-approved" : "simple-status-hold";
  return `<span class="simple-status ${className}">${escapeHtml(status)}</span>`;
}

function getStatus(item) {
  if (item.parentCode) {
    return { key: "parent", label: "메인코드", className: "status-parent" };
  }
  if (item.availableStock < 0) {
    return { key: "negative", label: "마이너스", className: "status-soldout" };
  }
  if (isHoldNeededItem(item)) {
    return { key: "watch", label: "보류필요", className: "status-watch" };
  }
  if (hasLowStockChange(item)) {
    return { key: "stockChange", label: "10개 미만 변동", className: "status-change" };
  }
  if (item.availableStock > 0 && item.availableStock <= 5) {
    return { key: "low5", label: "5개 이하", className: "status-low5" };
  }
  return { key: "ok", label: "정상", className: "status-ok" };
}

function sortItems(a, b) {
  const rank = { negative: 1, watch: 2, stockChange: 3, parent: 5, ok: 6 };
  const simpleStatusSort = getSimpleStatusRank(a) - getSimpleStatusRank(b);
  const groupSort =
    getMainGroupOrder(a) - getMainGroupOrder(b) ||
    getMainGroupCode(a).localeCompare(getMainGroupCode(b), "ko", { numeric: true }) ||
    getMainSubRank(a) - getMainSubRank(b) ||
    getInventoryOrder(a) - getInventoryOrder(b) ||
    a.code.localeCompare(b.code, "ko", { numeric: true });
  const sortMode = els.sortSelect ? els.sortSelect.value : "default";
  if (sortMode === "availableDesc") return simpleStatusSort || b.availableStock - a.availableStock || groupSort;
  if (sortMode === "availableAsc") return simpleStatusSort || a.availableStock - b.availableStock || groupSort;
  if (activeTab === "all") return simpleStatusSort || groupSort;
  if (activeTab === "allStockChanges") {
    return simpleStatusSort || parseDateValue(b.stockChangedAt || b.updatedAt) - parseDateValue(a.stockChangedAt || a.updatedAt) || groupSort;
  }
  return (
    getUrgentRank(a) - getUrgentRank(b) ||
    simpleStatusSort ||
    (rank[a.status.key] || 9) - (rank[b.status.key] || 9) ||
    groupSort
  );
}

function getMainGroupCode(item) {
  return item.mainCode || item.code;
}

function getMainGroupOrder(item) {
  const mainCode = getMainGroupCode(item);
  const mainItem = findItemByCode(mainCode);
  return getInventoryOrder(mainItem || item);
}

function getInventoryOrder(item) {
  const order = Number(item?.inventoryOrder);
  return Number.isFinite(order) ? order : 999999;
}

function getMainSubRank(item) {
  if (item.parentCode) return 0;
  if (item.mainCode) return 1;
  return 2;
}

function getUrgentRank(item) {
  return item.status.key === "negative" ? 1 : 2;
}

function matchesActiveTab(item) {
  if (activeTab === "all") return isApprovedSimpleItem(item);
  if (activeTab === "allStockChanges") return matchesChangeFilter(item);
  if (activeTab === "negative") return isNegativeTabItem(item);
  return item.status.key === activeTab;
}

function matchesChangeFilter(item) {
  if (!hasAnyStockChange(item)) return false;
  if (changeFilter === "down") return hasDecreaseChange(item);
  if (changeFilter === "up") return hasIncreaseChange(item);
  if (changeFilter === "negative") return item.availableStock < 0;
  if (changeFilter === "hold") return hasHoldStockMovement(item);
  return true;
}

function hasDecreaseChange(item) {
  return ["stock", "processingStock", "availableStock"].some((key) => {
    const pair = getStockChangePair(item, key);
    return pair && pair.current < pair.previous;
  });
}

function hasIncreaseChange(item) {
  return ["stock", "processingStock", "availableStock"].some((key) => {
    const pair = getStockChangePair(item, key);
    return pair && pair.current > pair.previous;
  });
}

function isApprovedSimpleItem(item) {
  return normalizeSimpleStatus(item.simpleStatus) === "승인";
}

function isHoldSimpleItem(item) {
  return normalizeSimpleStatus(item.simpleStatus) === "보류";
}

function isNegativeTabItem(item) {
  return item.status.key === "negative" || hasHoldStockMovement(item);
}

function hasHoldStockMovement(item) {
  if (item.parentCode || !isHoldSimpleItem(item)) return false;
  const availableStock = item.stock - item.processingStock;
  return (
    availableStock !== 0 ||
    Boolean(getStockChangePair(item, "stock") || getStockChangePair(item, "processingStock") || getStockChangePair(item, "availableStock"))
  );
}

function shouldShowNewAlertDot(item) {
  if (item.parentCode) return false;
  if (activeTab === "negative") return isNewNegativeItem(item);
  if (activeTab === "watch") return isNewWatchItem(item);
  return false;
}

function isNewNegativeItem(item) {
  const previousAvailableStock = getPreviousAvailableStock(item);
  return Number.isFinite(previousAvailableStock) && previousAvailableStock >= 0 && item.availableStock < 0;
}

function isNewWatchItem(item) {
  if (item.status.key !== "watch") return false;
  return !wasHoldNeededBefore(item);
}

function isHoldNeededItem(item) {
  return (
    normalizeSimpleStatus(item.simpleStatus) === "승인" &&
    item.stock === 0 &&
    item.processingStock === 0 &&
    item.availableStock === 0
  );
}

function wasHoldNeededBefore(item) {
  const previousStock = Number.isFinite(item.previousStock) ? item.previousStock : item.stock;
  const previousProcessingStock = Number.isFinite(item.previousProcessingStock) ? item.previousProcessingStock : item.processingStock;
  const previousAvailableStock = getPreviousAvailableStock(item);
  return (
    normalizeSimpleStatus(item.simpleStatus) === "승인" &&
    previousStock === 0 &&
    previousProcessingStock === 0 &&
    previousAvailableStock === 0
  );
}

function getPreviousAvailableStock(item) {
  if (Number.isFinite(item.previousAvailableStock)) return item.previousAvailableStock;
  if (Number.isFinite(item.previousStock) && Number.isFinite(item.previousProcessingStock)) {
    return item.previousStock - item.previousProcessingStock;
  }
  return NaN;
}

function hasLowStockChange(item) {
  if (item.parentCode || item.availableStockDelta === 0) return false;
  const previous = Number.isFinite(item.previousAvailableStock) ? item.previousAvailableStock : item.availableStock;
  return previous < 10 || item.availableStock < 10;
}

function renderStockChangeCell(item) {
  if (!hasLowStockChange(item)) return `<td class="change-cell muted">-</td>`;
  const previous = item.previousAvailableStock;
  const current = item.availableStock;
  const delta = item.availableStockDelta;
  const direction = delta > 0 ? "증가" : "감소";
  const className = delta > 0 ? "change-up" : "change-down";
  return `
    <td class="change-cell ${className}">
      <strong>${formatNumber(previous)} → ${formatNumber(current)}</strong>
    </td>
  `;
}

function formatStockChangeText(item) {
  if (!hasLowStockChange(item)) return "";
  const direction = item.availableStockDelta > 0 ? "증가" : "감소";
  return `${formatNumber(item.previousAvailableStock)} → ${formatNumber(item.availableStock)} / ${formatNumber(Math.abs(item.availableStockDelta))}개 ${direction}`;
}

function getSimpleStatusRank(item) {
  const status = normalizeSimpleStatus(item.simpleStatus);
  if (status === "승인") return 1;
  if (status === "보류") return 2;
  return 3;
}

function getProductGroupKey(item) {
  const nameKey = normalizeProductNameForGrouping(item.name);
  if (nameKey) return nameKey;
  return getCodeFamily(item.code);
}

function normalizeProductNameForGrouping(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/재소단|리더|심플|승인|보류/g, " ")
    .replace(/\d{2,6}\s*(size|mm|cm|t|x|×)?/gi, " ")
    .replace(/[a-z]?\d{2,6}[a-z]?/gi, " ")
    .replace(/[_\-+/.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 36);
}

function isSubCodeName(value) {
  return String(value || "").trim().startsWith("ㄴ");
}

function getCodeFamily(code) {
  const text = normalizeCode(code);
  const match = text.match(/\d+/);
  if (!match) return text;
  return match[0].slice(0, Math.max(2, match[0].length - 1));
}

function setTab(tab) {
  activeTab = tab === "stockChange" ? "allStockChanges" : tab;
  activeView = activeTab === "allStockChanges" ? "changes" : "all";
  if (activeTab === "allStockChanges" && !["all", "down", "up", "negative", "hold"].includes(changeFilter)) {
    changeFilter = "all";
  }
  currentPage = 1;
  render();
}

function setChangeFilter(filter) {
  activeTab = "allStockChanges";
  activeView = "changes";
  changeFilter = ["all", "down", "up", "negative", "hold"].includes(filter) ? filter : "all";
  currentPage = 1;
  render();
}

function setView(view) {
  activeTab = "all";
  activeView = VIEW_COLUMNS[view] ? view : "all";
  if (activeView === "price" && !["priceDate", "period"].includes(priceMode)) priceMode = "priceDate";
  currentPage = 1;
  render();
}

function setPriceMode(mode) {
  priceMode = mode === "period" ? "period" : "priceDate";
  currentPage = 1;
  render();
}

async function handleFileSelection(mode) {
  if (!requireLogin(mode === "schedule" ? "editSchedule" : "uploadInventory")) return;
  const input = mode === "inventory" ? els.inventoryFileInput : mode === "orders" ? els.orderFileInput : els.scheduleFileInput;
  const files = [...(input.files || [])];
  if (!files.length) return;

  try {
    const summaries = [];
    let lastColumns = [];
    const importedInventoryCodes = mode === "inventory" ? new Set() : null;
    const inventoryImportContext = mode === "inventory" ? { order: 0 } : null;
    for (const [index, file] of files.entries()) {
      setImportMeta(mode, `파일 읽는 중... (${index + 1}/${files.length}) ${file.name}`);
      const rows = await parseFile(file);
      const table = rowsToTable(rows, { skipRowsAfterHeader: mode === "schedule" ? 1 : 0 });
      const result = mode === "inventory" ? applyInventoryImport(table, file.name, importedInventoryCodes, inventoryImportContext) : mode === "orders" ? applyOrderImport(table, file.name) : applyScheduleImport(table, file.name);
      lastColumns = result.columns;
      summaries.push(`${file.name}: ${result.summary}`);
    }
    if (mode === "inventory") {
      const hidden = hideMissingInventoryItems(importedInventoryCodes);
      if (hidden > 0) summaries.push(`이번 재고목록에 없는 기존 상품 숨김 ${hidden}개`);
    }
    state.lastColumns = lastColumns;
    setImportMeta(mode, `${files.length}개 파일 반영 완료`);
    addActivity(mode === "inventory" ? "재고목록 일괄 반영" : mode === "orders" ? "주문서 일괄 반영" : "입고일정 일괄 반영", summaries.join(" / "));
    if (mode === "inventory") {
      activeTab = "allStockChanges";
      activeView = "changes";
      changeFilter = "all";
      currentPage = 1;
    }
    persist();
    render();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setImportMeta(mode, `오류: ${message}`);
    addActivity("파일 오류", message);
    persist();
    render();
  } finally {
    input.value = "";
  }
}

function setImportMeta(mode, text) {
  const target = mode === "inventory" ? els.inventoryImportMeta : mode === "orders" ? els.orderImportMeta : els.scheduleImportMeta;
  target.textContent = text;
}

function rowsToTable(rows, options = {}) {
  const cleanRows = rows.map((row) => row.map(normalizeCell)).filter((row) => row.some((value) => String(value).trim() !== ""));
  if (!cleanRows.length) throw new Error("읽을 데이터가 없습니다.");

  const headerIndex = findHeaderIndex(cleanRows);
  const headers = cleanRows[headerIndex].map((header) => String(header || "").trim());
  const records = cleanRows.slice(headerIndex + 1 + (options.skipRowsAfterHeader || 0)).map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header || `Column ${index + 1}`] = row[index] ?? "";
    });
    return record;
  });

  return { headers, records };
}

function findHeaderIndex(rows) {
  let best = 0;
  let bestScore = -1;
  rows.slice(0, 20).forEach((row, index) => {
    const normalized = row.map(normalizeHeader);
    const score =
      Number(normalized.some((value) => ALIAS_SETS.code.has(value))) * 3 +
      Number(normalized.some((value) => ALIAS_SETS.name.has(value))) +
      Number(normalized.some((value) => ALIAS_SETS.stock.has(value))) * 2 +
      Number(normalized.some((value) => ALIAS_SETS.processingStock.has(value))) * 2 +
      Number(normalized.some((value) => ALIAS_SETS.availableStock.has(value))) * 2 +
      Number(normalized.some((value) => ALIAS_SETS.orderQty.has(value))) * 2 +
      Number(normalized.some((value) => ALIAS_SETS.inboundDate.has(value))) * 2 +
      Number(normalized.some((value) => ALIAS_SETS.inboundQty.has(value))) * 2;
    if (score > bestScore) {
      best = index;
      bestScore = score;
    }
  });
  return best;
}

function applyInventoryImport(table, fileName, importedCodes = null, importContext = null) {
  const map = getColumnMap(table.headers);
  if (!map.code) throw new Error("상품코드 컬럼을 찾지 못했습니다.");
  if (!map.stock && !map.processingStock && !map.availableStock) {
    throw new Error("현재고/처리중/가용재고 중 하나 이상이 필요합니다.");
  }

  const now = new Date().toISOString();
  let added = 0;
  let updated = 0;
  let skipped = 0;
  let currentMainCode = "";

  table.records.forEach((record) => {
    const code = normalizeCode(record[map.code]);
    if (!code) {
      skipped += 1;
      return;
    }

    const importedName = map.name ? String(record[map.name] || "").trim() : "";
    if (importedName.includes("스크래치")) {
      skipped += 1;
      return;
    }
    if (importedCodes) importedCodes.add(code);

    const existing = findItemByCode(code);
    const isSubCode = isSubCodeName(importedName);
    const inferredMainCode = isSubCode ? currentMainCode : "";
    const mainCode = normalizeCode(existing?.mainCode || inferredMainCode);
    const inventoryOrder = importContext ? importContext.order++ : getInventoryOrder(existing);
    const stock = map.stock ? toInteger(record[map.stock], 0) : existing?.stock || 0;
    const processingStock = map.processingStock ? toInteger(record[map.processingStock], 0) : existing?.processingStock || 0;
    const availableStock = stock - processingStock;
    const previousStock = existing ? existing.stock : null;
    const stockDelta = previousStock === null ? 0 : stock - previousStock;
    const previousProcessingStock = existing ? existing.processingStock : null;
    const processingStockDelta = previousProcessingStock === null ? 0 : processingStock - previousProcessingStock;
    const previousAvailableStock = existing ? existing.stock - existing.processingStock : null;
    const availableStockDelta = previousAvailableStock === null ? 0 : availableStock - previousAvailableStock;
    const previousStockChangedAt = existing?.stockChangedAt || existing?.updatedAt || "";
    const stockChangedAt = availableStockDelta === 0 ? existing?.stockChangedAt || "" : now;
    const simpleStatus = map.simpleStatus ? normalizeSimpleStatus(record[map.simpleStatus]) : findSimpleStatusInRecord(record);
    const stockLogs = normalizeStockLogs(existing?.stockLogs);
    if (existing && (stockDelta !== 0 || processingStockDelta !== 0 || availableStockDelta !== 0)) {
      stockLogs.push(createStockLog({
        at: now,
        source: fileName,
        previousStock,
        stock,
        previousProcessingStock,
        processingStock,
        previousAvailableStock,
        availableStock,
      }));
    }
    const payload = {
      code,
      simpleStatus: simpleStatus || existing?.simpleStatus || "",
      name: importedName || existing?.name || "",
      stock,
      previousStock,
      stockDelta,
      processingStock,
      previousProcessingStock,
      processingStockDelta,
      availableStock,
      previousAvailableStock,
      availableStockDelta,
      previousStockChangedAt,
      stockChangedAt,
      inSimpleStock: true,
      hiddenFromInventory: false,
      source: fileName,
      salesLinks: normalizeSalesLinks(existing?.salesLinks),
      priceSettings: normalizePriceSettings(existing?.priceSettings),
      periodSales: normalizePeriodSales(existing?.periodSales),
      stockLogs,
      note: existing?.note || "",
      codeChange: existing?.codeChange || "",
      inboundDate: existing?.inboundDate || "",
      inboundQty: existing?.inboundQty || 0,
      parentCode: Boolean(existing?.parentCode),
      mainCode: mainCode === code ? "" : mainCode,
      inventoryOrder,
      orderQty: existing?.orderQty || 0,
      updatedAt: now,
    };

    if (existing) {
      Object.assign(existing, payload);
      updated += 1;
    } else {
      state.items.push(cleanItem({ id: createId(), ...payload, createdAt: now }));
      added += 1;
    }

    if (!isSubCode) {
      currentMainCode = code;
    } else if (payload.mainCode) {
      const mainItem = findItemByCode(payload.mainCode);
      if (mainItem) mainItem.parentCode = true;
    }
  });

  const summary = `추가 ${added}개, 갱신 ${updated}개, 제외 ${skipped}개`;
  addActivity("심플 전체 재고목록 반영", `${fileName}: ${summary}`);
  return { columns: Object.values(map), summary };
}

function hideMissingInventoryItems(importedCodes) {
  if (!importedCodes || importedCodes.size === 0) return 0;
  let hidden = 0;
  state.items.forEach((item) => {
    if (importedCodes.has(item.code)) return;
    if (!item.inSimpleStock && !item.hiddenFromInventory) return;
    if (!item.hiddenFromInventory) hidden += 1;
    item.inSimpleStock = false;
    item.hiddenFromInventory = true;
  });
  return hidden;
}

function isVisibleInventoryItem(item) {
  return !item.hiddenFromInventory;
}

function applyOrderImport(table, fileName) {
  const map = getColumnMap(table.headers);
  if (!map.code) throw new Error("상품코드 컬럼을 찾지 못했습니다.");
  if (!map.orderQty) throw new Error("주문수량 컬럼을 찾지 못했습니다.");

  const orderMap = new Map();
  table.records.forEach((record) => {
    const code = normalizeCode(record[map.code]);
    if (!code) return;
    const qty = toInteger(record[map.orderQty], 0);
    if (qty <= 0) return;
    const current = orderMap.get(code) || { code, name: "", qty: 0 };
    current.qty += qty;
    if (!current.name && map.name) current.name = String(record[map.name] || "").trim();
    orderMap.set(code, current);
  });

  const now = new Date().toISOString();
  let marked = 0;
  let created = 0;
  let totalQty = 0;

  orderMap.forEach((order) => {
    totalQty += order.qty;
    const existing = findItemByCode(order.code);
    if (existing) {
      existing.orderQty = order.qty;
      if (!existing.name && order.name) existing.name = order.name;
      existing.updatedAt = now;
      marked += 1;
      return;
    }

    state.items.push({
      id: createId(),
      code: order.code,
      simpleStatus: "",
      name: order.name,
      stock: 0,
      processingStock: order.qty,
      availableStock: -order.qty,
      orderQty: order.qty,
      inSimpleStock: false,
      source: "",
      salesLinks: [],
      priceSettings: [],
      periodSales: [],
      stockLogs: [],
      note: "",
      codeChange: "",
      inboundDate: "",
      inboundQty: 0,
      parentCode: false,
      mainCode: "",
      inventoryOrder: 999999,
      createdAt: now,
      updatedAt: now,
    });
    created += 1;
  });

  const summary = `주문서 표시 ${marked}개, 신규 확인필요 ${created}개, 주문수량 ${totalQty}개`;
  addActivity("주문서 확인 반영", `${fileName}: ${summary}`);
  return { columns: Object.values(map), summary };
}

function applyScheduleImport(table, fileName) {
  const map = getColumnMap(table.headers);
  if (!map.code) throw new Error("상품번호 컬럼을 찾지 못했습니다.");
  if (!map.inboundDate && !map.inboundQty) throw new Error("입고일정 또는 입고수량 컬럼이 필요합니다.");

  const now = new Date().toISOString();
  let updated = 0;
  let created = 0;
  let skipped = 0;

  table.records.forEach((record) => {
    const code = normalizeCode(record[map.code]);
    if (!code) {
      skipped += 1;
      return;
    }

    const inboundDate = map.inboundDate ? normalizeInboundDate(record[map.inboundDate]) : "";
    const inboundQty = map.inboundQty ? toInteger(record[map.inboundQty], 0) : 0;
    if (!inboundDate && !inboundQty) {
      skipped += 1;
      return;
    }

    let item = findItemByCode(code);
    if (!item) {
      item = cleanItem({
        id: createId(),
        code,
        name: map.name ? String(record[map.name] || "").trim() : "",
        stock: 0,
        processingStock: 0,
        availableStock: 0,
        inboundDate: "",
        inboundQty: 0,
        inSimpleStock: false,
        createdAt: now,
        updatedAt: now,
      });
      state.items.push(item);
      created += 1;
    } else {
      updated += 1;
    }

    if (map.name && !item.name) item.name = String(record[map.name] || "").trim();
    if (map.inboundDate) {
      recordItemEdit(item, "입고일정", item.inboundDate, inboundDate);
      item.inboundDate = inboundDate;
    }
    if (map.inboundQty) {
      recordItemEdit(item, "입고수량", item.inboundQty, inboundQty);
      item.inboundQty = inboundQty;
    }
    item.updatedAt = now;
  });

  const summary = `갱신 ${updated}개, 신규 ${created}개, 제외 ${skipped}개`;
  addActivity("입고일정 반영", `${fileName}: ${summary}`);
  return { columns: Object.values(map), summary };
}

function getColumnMap(headers) {
  const map = {};
  Object.keys(ALIAS_SETS).forEach((key) => {
    const column = findColumn(headers, ALIAS_SETS[key]);
    if (column) map[key] = column;
  });
  return map;
}

function findColumn(headers, candidates) {
  const exact = headers.find((header) => candidates.has(normalizeHeader(header)));
  if (exact) return exact;
  return headers.find((header) => {
    const value = normalizeHeader(header);
    return value && [...candidates].some((candidate) => value.includes(candidate) || candidate.includes(value));
  });
}

function findItemByCode(code) {
  const normalized = normalizeCode(code);
  return state.items.find((item) => item.code === normalized);
}

function findSimpleStatusInRecord(record) {
  return Object.values(record).map(normalizeSimpleStatus).find(Boolean) || "";
}

async function parseFile(file) {
  const extension = file.name.split(".").pop().toLowerCase();
  if (extension === "csv" || extension === "tsv") {
    const text = await file.text();
    return parseDelimitedText(text, extension === "tsv" ? "\t" : detectDelimiter(text));
  }
  if (extension === "xlsx") return parseXlsx(file);
  throw new Error("CSV, TSV, XLSX 파일만 지원합니다.");
}

function parseDelimitedText(text, delimiter) {
  const normalized = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && char === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }
    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((candidate) => candidate.some((value) => String(value).trim() !== ""));
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  return [",", "\t", ";"].map((delimiter) => ({ delimiter, count: firstLine.split(delimiter).length })).sort((a, b) => b.count - a.count)[0].delimiter;
}

async function parseXlsx(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = await unzip(bytes);
  const workbookXml = decodeEntry(entries, "xl/workbook.xml");
  const relsXml = decodeEntry(entries, "xl/_rels/workbook.xml.rels");
  const parser = new DOMParser();
  const workbook = parser.parseFromString(workbookXml, "application/xml");
  const rels = parser.parseFromString(relsXml, "application/xml");
  const sheet = workbook.getElementsByTagNameNS("*", "sheet")[0];
  if (!sheet) throw new Error("XLSX 시트를 찾지 못했습니다.");
  const relId = sheet.getAttribute("r:id") || sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
  const target = findRelationshipTarget(rels, relId);
  const sharedStrings = entries["xl/sharedStrings.xml"] ? parseSharedStrings(decodeEntry(entries, "xl/sharedStrings.xml")) : [];
  return parseWorksheet(decodeEntry(entries, normalizeZipPath("xl", target)), sharedStrings);
}

async function unzip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = findEndOfCentralDirectory(view);
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  let pointer = view.getUint32(eocdOffset + 16, true);
  const entries = {};

  for (let index = 0; index < totalEntries; index += 1) {
    if (view.getUint32(pointer, true) !== 0x02014b50) throw new Error("XLSX 구조를 읽지 못했습니다.");
    const method = view.getUint16(pointer + 10, true);
    const compressedSize = view.getUint32(pointer + 20, true);
    const fileNameLength = view.getUint16(pointer + 28, true);
    const extraLength = view.getUint16(pointer + 30, true);
    const commentLength = view.getUint16(pointer + 32, true);
    const localOffset = view.getUint32(pointer + 42, true);
    const fileName = decodeBytes(bytes.slice(pointer + 46, pointer + 46 + fileNameLength));
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    if (method === 0) entries[fileName] = compressed;
    else if (method === 8) entries[fileName] = await inflateRaw(compressed);
    pointer += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function findEndOfCentralDirectory(view) {
  const min = Math.max(0, view.byteLength - 66000);
  for (let offset = view.byteLength - 22; offset >= min; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  throw new Error("XLSX 끝부분을 찾지 못했습니다.");
}

async function inflateRaw(bytes) {
  if (!("DecompressionStream" in window)) throw new Error("이 브라우저는 XLSX 압축 해제를 지원하지 않습니다.");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function decodeEntry(entries, path) {
  const entry = entries[path];
  if (!entry) throw new Error(`${path} 항목을 찾지 못했습니다.`);
  return decodeBytes(entry);
}

function decodeBytes(bytes) {
  return new TextDecoder("utf-8").decode(bytes);
}

function findRelationshipTarget(rels, relId) {
  return [...rels.getElementsByTagNameNS("*", "Relationship")].find((item) => item.getAttribute("Id") === relId)?.getAttribute("Target") || "";
}

function normalizeZipPath(base, target) {
  if (target.startsWith("/")) return target.slice(1);
  const stack = [];
  `${base}/${target}`.split("/").forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") stack.pop();
    else stack.push(part);
  });
  return stack.join("/");
}

function parseSharedStrings(xml) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return [...doc.getElementsByTagNameNS("*", "si")].map((item) => [...item.getElementsByTagNameNS("*", "t")].map((node) => node.textContent || "").join(""));
}

function parseWorksheet(xml, sharedStrings) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const rows = [];
  [...doc.getElementsByTagNameNS("*", "row")].forEach((rowElement) => {
    const row = [];
    let fallbackIndex = 0;
    [...rowElement.children].forEach((cellElement) => {
      if (cellElement.localName !== "c") return;
      const ref = cellElement.getAttribute("r") || "";
      const columnIndex = ref ? columnNameToIndex(ref.replace(/[0-9]/g, "")) : fallbackIndex;
      row[columnIndex] = readCellValue(cellElement, sharedStrings);
      fallbackIndex = columnIndex + 1;
    });
    if (row.some((value) => value !== "" && value !== null && value !== undefined)) rows.push(row);
  });
  return rows;
}

function readCellValue(cellElement, sharedStrings) {
  const type = cellElement.getAttribute("t");
  if (type === "inlineStr") return [...cellElement.getElementsByTagNameNS("*", "t")].map((node) => node.textContent || "").join("");
  const raw = cellElement.getElementsByTagNameNS("*", "v")[0]?.textContent ?? "";
  if (type === "s") return sharedStrings[Number(raw)] || "";
  if (type === "b") return raw === "1";
  if (raw === "") return "";
  const number = Number(raw);
  return Number.isFinite(number) ? number : raw;
}

function columnNameToIndex(name) {
  let index = 0;
  for (const char of name.toUpperCase()) index = index * 26 + char.charCodeAt(0) - 64;
  return Math.max(0, index - 1);
}

function renderImportPanel() {
  els.columnChips.innerHTML = state.lastColumns.length
    ? state.lastColumns.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("")
    : `<span class="chip">대기중</span>`;

  els.activityList.innerHTML = state.activity.length
    ? state.activity
        .slice(0, 40)
        .map(
          (entry) => `
            <article class="activity-item">
              <time>${escapeHtml(formatDate(entry.at))}</time>
              <div>
                <strong>${escapeHtml(entry.title)}</strong>
                <p>${escapeHtml(entry.detail)}</p>
              </div>
            </article>
          `,
        )
        .join("")
    : `<div class="empty-state"><strong>처리 기록이 없습니다.</strong></div>`;
}

function addActivity(title, detail) {
  state.activity.unshift({ id: createId(), at: new Date().toISOString(), title, detail });
  state.activity = state.activity.slice(0, 100);
}

function clearActivity() {
  state.activity = [];
  persist();
  render();
}

function clearAllData() {
  if (!confirm("현재 저장된 재고 데이터를 모두 지울까요?")) return;
  state = createDefaultState();
  persist();
  render();
}

function exportCsv() {
  if (activeTab === "allStockChanges") {
    exportStockChangesCsv();
    return;
  }
  const rows = [
    COLUMNS.map((column) => column.label),
    ...state.items
      .map((item) => ({ ...item, status: getStatus(item) }))
      .sort(sortItems)
      .map((item) => {
        const depletion = getDepletionEstimate(item);
        return [
          item.status.label,
          item.code,
          item.codeChange,
          item.parentCode ? "메인코드" : "",
          item.mainCode,
          item.simpleStatus,
          item.name,
          item.stock,
          item.processingStock,
          item.availableStock,
          depletion.label,
          depletion.rateText,
          depletion.dateText,
          item.inboundDate,
          item.inboundQty,
          item.orderQty,
          item.inSimpleStock ? item.source || "심플 재고목록" : "주문서/기존자료",
          formatSalesLinksForCsv(item.salesLinks),
          formatPriceSettingsForCsv(item.priceSettings),
          formatPeriodSalesForCsv(item),
          item.note,
          formatHistoryForCsv(item.history),
          formatDate(item.updatedAt),
        ];
      }),
  ];
  downloadCsv(rows, `jaesodan_inventory_${new Date().toISOString().slice(0, 10)}.csv`);
}

function exportStockChangesCsv() {
  const rows = [
    ["상품코드", "변경코드", "상품명", "심플상태", "현재고 변동", "처리중 변동", "가용재고 변동", "수정일", "메모"],
    ...state.items
      .filter(isVisibleInventoryItem)
      .map((item) => ({ ...item, status: getStatus(item) }))
      .filter(matchesChangeFilter)
      .sort(sortItems)
      .map((item) => [
        item.code,
        item.codeChange || "",
        item.name,
        item.simpleStatus,
        formatStockPairForCsv(item, "stock"),
        formatStockPairForCsv(item, "processingStock"),
        formatStockPairForCsv(item, "availableStock"),
        formatDate(item.updatedAt),
        item.note || "",
      ]),
  ];
  downloadCsv(rows, `jaesodan_stock_changes_${new Date().toISOString().slice(0, 10)}.csv`);
}

function formatStockPairForCsv(item, key) {
  const pair = getStockChangePair(item, key);
  return pair ? `${formatNumber(pair.previous)} -> ${formatNumber(pair.current)}` : "";
}

function downloadCsv(rows, filename) {
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadScheduleTemplate() {
  const link = document.createElement("a");
  link.href = "/입고일정_등록양식.xlsx";
  link.download = "입고일정_등록양식.xlsx";
  link.click();
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-()[\]{}.:/\\]/g, "");
}

function normalizeCode(value) {
  const text = String(value ?? "").trim();
  return /^\d+\.0$/.test(text) ? text.slice(0, -2) : text.toUpperCase();
}

function normalizeSimpleStatus(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.includes("승인")) return "승인";
  if (text.includes("보류")) return "보류";
  return "";
}

function normalizeSearch(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeCell(value) {
  return typeof value === "string" ? value.trim() : value ?? "";
}

function normalizeInboundDate(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30 + Math.trunc(value)));
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}.${month}.${day}`;
  }

  const text = String(value ?? "").trim();
  if (!text) return "";
  const match = text.match(/^(\d{2,4})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
  if (!match) return text;
  const year = match[1].length === 2 ? `20${match[1]}` : match[1];
  const month = String(Number(match[2])).padStart(2, "0");
  const day = String(Number(match[3])).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function toInteger(value, fallback) {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function toOptionalInteger(value) {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function normalizePriceSettings(value, keepEmpty = false) {
  return Array.isArray(value)
    ? value
        .slice(0, 30)
        .map((entry) => ({
          id: String(entry?.id || createId()),
          oldPrice: cleanNumberText(entry?.oldPrice),
          newPrice: cleanNumberText(entry?.newPrice),
          date: String(entry?.date || "").trim(),
          soldQty: cleanNumberText(entry?.soldQty),
          memo: String(entry?.memo || "").trim(),
        }))
        .filter((entry) => keepEmpty || hasPriceSettingContent(entry))
    : [];
}

function createEmptyPriceSetting(id = createId()) {
  return { id: String(id || createId()), oldPrice: "", newPrice: "", date: "", soldQty: "", memo: "" };
}

function hasPriceSettingContent(entry) {
  return Boolean(entry && (entry.oldPrice || entry.newPrice || entry.date || entry.soldQty || entry.memo));
}

function formatPriceSettingForHistory(entry) {
  if (!entry) return "";
  const priceText = entry.oldPrice || entry.newPrice ? `${entry.oldPrice || "-"} -> ${entry.newPrice || "-"}` : "";
  const qtyText = entry.soldQty ? `${entry.soldQty}개 판매` : "";
  return [priceText, entry.date, qtyText, entry.memo].filter(Boolean).join(" / ");
}

function normalizePeriodSales(value, keepEmpty = false) {
  return Array.isArray(value)
    ? value
        .slice(0, 30)
        .map((entry) => ({
          id: String(entry?.id || createId()),
          startDate: String(entry?.startDate || "").trim(),
          endDate: String(entry?.endDate || "").trim(),
          soldQty: cleanNumberText(entry?.soldQty),
          memo: String(entry?.memo || "").trim(),
        }))
        .filter((entry) => keepEmpty || hasPeriodSaleContent(entry))
    : [];
}

function createEmptyPeriodSale(id = createId()) {
  return { id: String(id || createId()), startDate: "", endDate: "", soldQty: "", memo: "" };
}

function hasPeriodSaleContent(entry) {
  return Boolean(entry && (entry.startDate || entry.endDate || entry.soldQty || entry.memo));
}

function formatPeriodSaleForHistory(entry) {
  if (!entry) return "";
  const periodText = entry.startDate || entry.endDate ? `${entry.startDate || "-"} ~ ${entry.endDate || "-"}` : "";
  const qtyText = entry.soldQty ? `${entry.soldQty}개 판매` : "";
  return [periodText, qtyText, entry.memo].filter(Boolean).join(" / ");
}

function formatPriceTrackingSearch(item) {
  return [
    ...normalizePriceSettings(item.priceSettings).map(formatPriceSettingForHistory),
    ...normalizePeriodSales(item.periodSales).map(formatPeriodSaleForHistory),
    ...normalizeStockLogs(item.stockLogs).map((entry) => entry.source),
  ].join(" ");
}

function formatPriceSettingsForCsv(rows) {
  return normalizePriceSettings(rows).map(formatPriceSettingForHistory).join(" | ");
}

function formatPeriodSalesForCsv(itemOrRows) {
  if (Array.isArray(itemOrRows)) return normalizePeriodSales(itemOrRows).map(formatPeriodSaleForHistory).join(" | ");
  const range = getPeriodQueryRange();
  const stats = getPeriodSalesStats(itemOrRows, range);
  if (!range.start || !range.end) return "";
  return `${formatPeriodRangeLabel(range)} / 판매 ${formatNumber(stats.soldQty)}개 / 증가 ${formatNumber(stats.increasedQty)}개 / 순변동 ${formatSignedNumber(stats.netChange)}개 / 기록 ${formatNumber(stats.logCount)}건`;
}

function normalizeStockLogs(value) {
  return Array.isArray(value)
    ? value
        .slice(-800)
        .map((entry) => ({
          id: String(entry?.id || createId()),
          at: entry?.at || "",
          source: String(entry?.source || "").trim(),
          stockBefore: toOptionalInteger(entry?.stockBefore),
          stockAfter: toOptionalInteger(entry?.stockAfter),
          processingBefore: toOptionalInteger(entry?.processingBefore),
          processingAfter: toOptionalInteger(entry?.processingAfter),
          availableBefore: toOptionalInteger(entry?.availableBefore),
          availableAfter: toOptionalInteger(entry?.availableAfter),
        }))
        .filter((entry) => entry.at)
    : [];
}

function createStockLog({ at, source, previousStock, stock, previousProcessingStock, processingStock, previousAvailableStock, availableStock }) {
  return {
    id: createId(),
    at,
    source: String(source || "").trim(),
    stockBefore: previousStock,
    stockAfter: stock,
    processingBefore: previousProcessingStock,
    processingAfter: processingStock,
    availableBefore: previousAvailableStock,
    availableAfter: availableStock,
  };
}

function getPeriodQueryRange() {
  return {
    start: parsePeriodDate(els.periodStartInput?.value, false),
    end: parsePeriodDate(els.periodEndInput?.value, true),
  };
}

function parsePeriodDate(value, endOfDay) {
  const text = String(value || "").trim();
  if (!text) return null;
  const date = new Date(`${text}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatPeriodRangeLabel(range) {
  return `${formatQueryDate(range.start)} ~ ${formatQueryDate(range.end)}`;
}

function formatQueryDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "-";
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function getPeriodSalesStats(item, range) {
  if (!item || !range?.start || !range?.end || range.start > range.end) {
    return { soldQty: 0, increasedQty: 0, netChange: 0, logCount: 0 };
  }
  return normalizeStockLogs(item.stockLogs).reduce((stats, log) => {
    const at = new Date(log.at);
    if (Number.isNaN(at.getTime()) || at < range.start || at > range.end) return stats;
    const before = toOptionalInteger(log.availableBefore);
    const after = toOptionalInteger(log.availableAfter);
    if (before === null || after === null || before === after) return stats;
    const diff = after - before;
    if (diff < 0) stats.soldQty += Math.abs(diff);
    if (diff > 0) stats.increasedQty += diff;
    stats.netChange += diff;
    stats.logCount += 1;
    return stats;
  }, { soldQty: 0, increasedQty: 0, netChange: 0, logCount: 0 });
}

function formatSignedNumber(value) {
  const number = Number(value || 0);
  return number > 0 ? `+${formatNumber(number)}` : formatNumber(number);
}

function cleanNumberText(value) {
  return String(value || "").replace(/[^\d.-]/g, "").trim();
}

function normalizeSalesLinks(value, keepEmpty = false) {
  return Array.isArray(value)
    ? value
        .slice(0, 20)
        .map((entry) => ({
          id: String(entry?.id || createId()),
          platform: String(entry?.platform || "").trim(),
          productName: String(entry?.productName || "").trim(),
          qty: String(entry?.qty || "").trim(),
          url: String(entry?.url || "").trim(),
        }))
        .filter((entry) => keepEmpty || hasSalesLinkContent(entry))
    : [];
}

function createEmptySalesLink(id = createId()) {
  return { id: String(id || createId()), platform: "", productName: "", qty: "", url: "" };
}

function hasSalesLinkContent(link) {
  return Boolean(link && (link.platform || link.productName || link.qty || link.url));
}

function formatSalesLinkForHistory(link) {
  if (!link) return "";
  return [link.platform, link.productName, link.qty ? `${link.qty}개` : "", link.url].filter(Boolean).join(" / ");
}

function formatSalesLinksSearch(links) {
  return normalizeSalesLinks(links).map(formatSalesLinkForHistory).join(" ");
}

function formatSalesLinksForCsv(links) {
  return normalizeSalesLinks(links).map(formatSalesLinkForHistory).join(" | ");
}

function normalizeItemHistory(value) {
  return Array.isArray(value)
    ? value
        .slice(0, 100)
        .map((entry) => ({
          id: String(entry?.id || createId()),
          at: entry?.at || new Date().toISOString(),
          author: String(entry?.author || "작성자 미지정").trim(),
          field: renameLegacyMainCodeText(entry?.field),
          before: renameLegacyMainCodeText(entry?.before),
          after: renameLegacyMainCodeText(entry?.after),
        }))
        .filter((entry) => entry.field)
    : [];
}

function normalizeActivityEntry(entry) {
  return {
    id: String(entry?.id || createId()),
    at: entry?.at || new Date().toISOString(),
    title: renameLegacyMainCodeText(entry?.title).slice(0, 80),
    detail: renameLegacyMainCodeText(entry?.detail).slice(0, 500),
  };
}

function renameLegacyMainCodeText(value) {
  return String(value || "").replace(/엄마코드/g, "메인코드").replace(/엄마/g, "메인");
}

function formatHistoryForCsv(history) {
  return normalizeItemHistory(history)
    .map((entry) => `${formatDate(entry.at)} / ${entry.author} / ${entry.field} / ${entry.before || "빈칸"} → ${entry.after || "빈칸"}`)
    .join(" | ");
}

function formatNumber(value) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${year}.${month}.${day} ${hour}:${minute}`;
}

function formatTime(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createXlsxBlob(rows) {
  const entries = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="입고일정" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
    "xl/worksheets/sheet1.xml": createWorksheetXml(rows),
  };
  return new Blob([createZip(entries)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function createWorksheetXml(rows) {
  const body = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => {
          const ref = `${columnIndexToName(columnIndex)}${rowIndex + 1}`;
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${body}</sheetData>
</worksheet>`;
}

function createZip(entries) {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;

  Object.entries(entries).forEach(([name, content]) => {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localHeader.set(nameBytes, 30);
    chunks.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    central.push(centralHeader);
    offset += localHeader.length + data.length;
  });

  const centralSize = central.reduce((sum, item) => sum + item.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, central.length, true);
  endView.setUint16(10, central.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, end]);
}

function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function columnIndexToName(index) {
  let name = "";
  let current = index + 1;
  while (current > 0) {
    const mod = (current - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    current = Math.floor((current - mod) / 26);
  }
  return name;
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let j = 0; j < 8; j += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
