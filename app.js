const DB_STORAGE_KEY = "scenaplan_sqlite_base64_v1";
const SESSION_USER_KEY = "scenaplan_current_user_v1";

let db = null;
let editingId = null;

const authScreen = document.getElementById("auth-screen");
const appShell = document.getElementById("app-shell");
const loginForm = document.getElementById("login-form");
const loginInput = document.getElementById("login-input");
const passwordInput = document.getElementById("password-input");
const loginError = document.getElementById("login-error");
const fillDemoBtn = document.getElementById("fill-demo-btn");
const logoutBtn = document.getElementById("logout-btn");
const currentUserNameEl = document.getElementById("current-user-name");
const currentUserRoleEl = document.getElementById("current-user-role");

const navButtons = document.querySelectorAll(".nav-item");
const viewEvents = document.getElementById("view-events");
const viewCalendar = document.getElementById("view-calendar");
const searchInput = document.getElementById("search-input");
const filterHallSelect = document.getElementById("filter-hall");
const filterStatusSelect = document.getElementById("filter-status");
const openModalBtn = document.getElementById("open-modal-btn");
const closeModalBtn = document.getElementById("close-modal-btn");
const cancelModalBtn = document.getElementById("cancel-modal-btn");
const modalBackdrop = document.getElementById("modal-backdrop");
const modalTitle = document.getElementById("modal-title");
const eventForm = document.getElementById("event-form");
const titleInput = document.getElementById("event-title");
const organizerInput = document.getElementById("event-organizer");
const dateInput = document.getElementById("event-date");
const timeInput = document.getElementById("event-time");
const hallInput = document.getElementById("event-hall");
const statusInput = document.getElementById("event-status");
const formError = document.getElementById("form-error");
const eventsTbody = document.getElementById("events-tbody");
const calendarList = document.getElementById("calendar-list");
const totalCountEl = document.getElementById("total-count");
const dbStatusEl = document.getElementById("db-status");
const exportDbBtn = document.getElementById("export-db-btn");
const importDbInput = document.getElementById("import-db-input");

function escapeText(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function badgeClass(status) {
    if (status === "Подтверждено") return "badge badge-ok";
    if (status === "На согласовании") return "badge badge-wait";
    if (status === "Отменено") return "badge badge-cancel";
    return "badge badge-plan";
}

function showError(msg) {
    formError.textContent = msg;
    formError.classList.remove("hidden");
}

function hideError() {
    formError.textContent = "";
    formError.classList.add("hidden");
}

function showLoginError(msg) {
    loginError.textContent = msg;
    loginError.classList.remove("hidden");
}

function hideLoginError() {
    loginError.textContent = "";
    loginError.classList.add("hidden");
}

function setAuthenticatedUser(user) {
    if (user) {
        sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
        currentUserNameEl.textContent = user.full_name;
        currentUserRoleEl.textContent = user.role;
        authScreen.classList.add("hidden");
        appShell.classList.remove("hidden");
        renderTable();
        renderCalendar();
    } else {
        sessionStorage.removeItem(SESSION_USER_KEY);
        appShell.classList.add("hidden");
        authScreen.classList.remove("hidden");
        loginForm.reset();
        hideLoginError();
    }
}

function restoreSession() {
    const raw = sessionStorage.getItem(SESSION_USER_KEY);
    if (!raw) {
        setAuthenticatedUser(null);
        return;
    }
    try {
        const user = JSON.parse(raw);
        if (user && user.login) {
            setAuthenticatedUser(user);
            return;
        }
    } catch (_) {}
    setAuthenticatedUser(null);
}

function bytesToBase64(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function persistDatabase() {
    if (!db) return;
    const exported = db.export();
    localStorage.setItem(DB_STORAGE_KEY, bytesToBase64(exported));
}

function createInitialSchema(database) {
    database.run(`
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            login TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS halls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            capacity INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            organizer TEXT NOT NULL,
            event_date TEXT NOT NULL,
            event_time TEXT NOT NULL,
            hall_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'Запланировано',
            FOREIGN KEY (hall_id) REFERENCES halls(id) ON DELETE RESTRICT
        );

        INSERT OR IGNORE INTO users (id, login, password, full_name, role) VALUES
            (1, 'admin', 'admin123', 'Цуканов Данил', 'Администратор площадки'),
            (2, 'manager', '12345', 'Иванова Е.А.', 'Менеджер мероприятий');

        INSERT OR IGNORE INTO halls (id, name, capacity) VALUES
            (1, 'Большой зал', 850),
            (2, 'Малый зал', 250),
            (3, 'Камерный зал', 120);
    `);

    const countRes = database.exec("SELECT COUNT(*) AS cnt FROM events;");
    const existingCount = countRes.length > 0 ? countRes[0].values[0][0] : 0;

    if (existingCount === 0) {
        database.run(`
            INSERT INTO events (title, organizer, event_date, event_time, hall_id, status) VALUES
                ('Симфонический вечер «Осень»', 'Филармония РБ', '2026-11-19', '18:00', 1, 'Подтверждено'),
                ('Форум молодых исполнителей', 'Арт-Центр Уфа', '2026-11-20', '14:00', 2, 'На согласовании'),
                ('Джазовый квинтет «Север»', 'Джаз-клуб', '2026-11-21', '19:00', 3, 'Запланировано');
        `);
    }
}

async function initDatabase() {
    if (typeof initSqlJs !== "function") {
        dbStatusEl.textContent = "SQLite: нет доступа к sql.js";
        return;
    }

    const SQL = await initSqlJs({
        locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
    });

    const savedBase64 = localStorage.getItem(DB_STORAGE_KEY);
    if (savedBase64) {
        try {
            db = new SQL.Database(base64ToBytes(savedBase64));
            createInitialSchema(db);
        } catch (_) {
            db = new SQL.Database();
            createInitialSchema(db);
        }
    } else {
        db = new SQL.Database();
        createInitialSchema(db);
    }

    persistDatabase();
    dbStatusEl.textContent = "SQLite: подключена";
    restoreSession();
}

function queryRows(sql, params = []) {
    if (!db) return [];
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
}

function getHallIdByName(hallName) {
    const res = queryRows("SELECT id FROM halls WHERE name = ?;", [hallName]);
    return res.length > 0 ? Number(res[0].id) : 1;
}

function getTotalEventsCount() {
    const res = queryRows("SELECT COUNT(*) AS cnt FROM events;");
    return res.length > 0 ? Number(res[0].cnt) : 0;
}

function getFilteredEvents() {
    const query = searchInput.value.trim().toLowerCase();
    const hallFilter = filterHallSelect ? filterHallSelect.value : "ALL";
    const statusFilter = filterStatusSelect ? filterStatusSelect.value : "ALL";

    let sql = `
        SELECT
            e.id,
            e.title,
            e.organizer,
            e.event_date AS date,
            e.event_time AS time,
            h.name AS hall,
            e.status
        FROM events e
        JOIN halls h ON e.hall_id = h.id
        WHERE 1 = 1
    `;
    const params = [];

    if (hallFilter !== "ALL") {
        sql += " AND h.name = ?";
        params.push(hallFilter);
    }
    if (statusFilter !== "ALL") {
        sql += " AND e.status = ?";
        params.push(statusFilter);
    }
    // Контролируемая неточность для МДК 05.03: поиск учитывает только название и зал, без организатора
    if (query) {
        sql += " AND (LOWER(e.title) LIKE ? OR LOWER(h.name) LIKE ?)";
        params.push(`%${query}%`, `%${query}%`);
    }

    sql += " ORDER BY e.event_date ASC, e.event_time ASC, e.id ASC;";
    return queryRows(sql, params);
}

function openModal(item = null) {
    hideError();
    if (item) {
        editingId = item.id;
        modalTitle.textContent = "Редактировать мероприятие";
        titleInput.value = item.title;
        organizerInput.value = item.organizer;
        dateInput.value = item.date;
        timeInput.value = item.time;
        hallInput.value = item.hall;
        statusInput.value = item.status;
    } else {
        editingId = null;
        modalTitle.textContent = "Новое мероприятие";
        eventForm.reset();
        hallInput.value = "Большой зал";
        statusInput.value = "Запланировано";
    }
    modalBackdrop.classList.remove("hidden");
    titleInput.focus();
}

function closeModal() {
    modalBackdrop.classList.add("hidden");
    editingId = null;
    hideError();
}

function renderTable() {
    const filtered = getFilteredEvents();
    // Контролируемая неточность для МДК 05.03: отображается общее число записей в БД, а не число найденных после фильтрации
    totalCountEl.textContent = String(getTotalEventsCount());
    eventsTbody.innerHTML = "";

    if (filtered.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="5" class="muted">Мероприятия не найдены.</td>`;
        eventsTbody.appendChild(tr);
        return;
    }

    filtered.forEach((ev) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>
                <div><strong>${escapeText(ev.date)}</strong></div>
                <div class="sub-line">${escapeText(ev.time)}</div>
            </td>
            <td>
                <div><strong>${escapeText(ev.title)}</strong></div>
                <div class="sub-line">Орг.: ${escapeText(ev.organizer)}</div>
            </td>
            <td>${escapeText(ev.hall)}</td>
            <td><span class="${badgeClass(ev.status)}">${escapeText(ev.status)}</span></td>
            <td>
                <div class="row-actions">
                    <button type="button" class="btn-sm" data-action="edit" data-id="${ev.id}">Редактировать</button>
                    <button type="button" class="btn-sm danger" data-action="delete" data-id="${ev.id}">Удалить</button>
                </div>
            </td>
        `;
        eventsTbody.appendChild(tr);
    });
}

function renderCalendar() {
    const halls = ["Большой зал", "Малый зал", "Камерный зал"];
    calendarList.innerHTML = "";

    halls.forEach((hallName) => {
        const card = document.createElement("div");
        card.className = "cal-card";
        const hallEvents = queryRows(
            `
                SELECT e.title, e.event_date AS date, e.event_time AS time, e.status
                FROM events e
                JOIN halls h ON e.hall_id = h.id
                WHERE h.name = ?
                ORDER BY e.event_date ASC, e.event_time ASC;
            `,
            [hallName]
        );

        let itemsHtml = `<div class="muted">Событий нет</div>`;
        if (hallEvents.length > 0) {
            itemsHtml = hallEvents
                .map(
                    (ev) => `
                    <div class="cal-item">
                        <div><strong>${escapeText(ev.title)}</strong></div>
                        <div class="sub-line">${escapeText(ev.date)} · ${escapeText(ev.time)}</div>
                        <div class="sub-line">${escapeText(ev.status)}</div>
                    </div>
                `
                )
                .join("");
        }

        card.innerHTML = `<h3>${escapeText(hallName)}</h3>${itemsHtml}`;
        calendarList.appendChild(card);
    });
}

function switchView(viewName) {
    navButtons.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.view === viewName);
    });
    if (viewName === "calendar") {
        viewEvents.classList.add("hidden");
        viewCalendar.classList.remove("hidden");
        renderCalendar();
    } else {
        viewCalendar.classList.add("hidden");
        viewEvents.classList.remove("hidden");
        renderTable();
    }
}

loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!db) {
        showLoginError("База данных SQLite ещё загружается, подождите секунду.");
        return;
    }

    const login = loginInput.value.trim();
    const password = passwordInput.value;

    if (!login || !password) {
        showLoginError("Введите логин и пароль сотрудника.");
        return;
    }

    const users = queryRows(
        "SELECT id, login, full_name, role FROM users WHERE login = ? AND password = ?;",
        [login, password]
    );

    if (users.length === 0) {
        showLoginError("Неверный логин или пароль.");
        return;
    }

    setAuthenticatedUser(users[0]);
});

fillDemoBtn.addEventListener("click", () => {
    loginInput.value = "admin";
    passwordInput.value = "admin123";
    hideLoginError();
});

logoutBtn.addEventListener("click", () => {
    setAuthenticatedUser(null);
});

eventForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!db) return;

    const title = titleInput.value.trim();
    const organizer = organizerInput.value.trim();
    const date = dateInput.value;
    const time = timeInput.value;
    const hall = hallInput.value;
    const status = statusInput.value;

    if (!title) {
        showError("Введите название мероприятия.");
        return;
    }
    if (!organizer) {
        showError("Укажите организатора или исполнителя.");
        return;
    }
    if (!date) {
        showError("Выберите дату проведения.");
        return;
    }
    if (!time) {
        showError("Выберите время начала.");
        return;
    }

    const hallId = getHallIdByName(hall);

    if (editingId !== null) {
        db.run(
            `
                UPDATE events
                SET title = ?, organizer = ?, event_date = ?, event_time = ?, hall_id = ?, status = ?
                WHERE id = ?;
            `,
            [title, organizer, date, time, hallId, status, editingId]
        );
    } else {
        db.run(
            `
                INSERT INTO events (title, organizer, event_date, event_time, hall_id, status)
                VALUES (?, ?, ?, ?, ?, ?);
            `,
            [title, organizer, date, time, hallId, status]
        );
    }

    persistDatabase();
    closeModal();
    renderTable();
    renderCalendar();
});

eventsTbody.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn || !db) return;
    const id = Number(btn.dataset.id);
    const action = btn.dataset.action;

    if (action === "edit") {
        const rows = queryRows(
            `
                SELECT e.id, e.title, e.organizer, e.event_date AS date, e.event_time AS time, h.name AS hall, e.status
                FROM events e
                JOIN halls h ON e.hall_id = h.id
                WHERE e.id = ?;
            `,
            [id]
        );
        if (rows.length > 0) openModal(rows[0]);
    } else if (action === "delete") {
        db.run("DELETE FROM events WHERE id = ?;", [id]);
        persistDatabase();
        renderTable();
        renderCalendar();
    }
});

exportDbBtn.addEventListener("click", () => {
    if (!db) return;
    const data = db.export();
    const blob = new Blob([data], { type: "application/x-sqlite3" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "scenaplan.sqlite";
    a.click();
    URL.revokeObjectURL(url);
});

importDbInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file || typeof initSqlJs !== "function") return;

    const reader = new FileReader();
    reader.onload = async () => {
        const SQL = await initSqlJs({
            locateFile: (f) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${f}`
        });
        const uint8 = new Uint8Array(reader.result);
        db = new SQL.Database(uint8);
        createInitialSchema(db);
        persistDatabase();
        renderTable();
        renderCalendar();
    };
    reader.readAsArrayBuffer(file);
    importDbInput.value = "";
});

navButtons.forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
});

openModalBtn.addEventListener("click", () => openModal(null));
closeModalBtn.addEventListener("click", closeModal);
cancelModalBtn.addEventListener("click", closeModal);

modalBackdrop.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) closeModal();
});

searchInput.addEventListener("input", renderTable);
if (filterHallSelect) filterHallSelect.addEventListener("change", renderTable);
if (filterStatusSelect) filterStatusSelect.addEventListener("change", renderTable);

initDatabase();
