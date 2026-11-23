const STORAGE_KEY = "scenaplan_events_v1";

let events = [];
let editingId = null;

const navButtons = document.querySelectorAll(".nav-item");
const viewEvents = document.getElementById("view-events");
const viewCalendar = document.getElementById("view-calendar");
const searchInput = document.getElementById("search-input");
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

function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        events = [
            {
                id: 1,
                title: "Симфонический вечер «Осень»",
                organizer: "Филармония РБ",
                date: "2026-11-19",
                time: "18:00",
                hall: "Большой зал",
                status: "Подтверждено"
            },
            {
                id: 2,
                title: "Форум молодых исполнителей",
                organizer: "Арт-Центр Уфа",
                date: "2026-11-20",
                time: "14:00",
                hall: "Малый зал",
                status: "На согласовании"
            },
            {
                id: 3,
                title: "Джазовый квинтет «Север»",
                organizer: "Джаз-клуб",
                date: "2026-11-21",
                time: "19:00",
                hall: "Камерный зал",
                status: "Запланировано"
            }
        ];
        saveData();
        return;
    }
    try {
        const parsed = JSON.parse(raw);
        events = Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        events = [];
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

function nextId() {
    if (events.length === 0) return 1;
    return Math.max(...events.map((e) => Number(e.id) || 0)) + 1;
}

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
    const query = searchInput.value.trim().toLowerCase();
    const filtered = events.filter((ev) => {
        if (!query) return true;
        return (
            ev.title.toLowerCase().includes(query) ||
            ev.hall.toLowerCase().includes(query)
        );
    });

    totalCountEl.textContent = String(events.length);
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
        const hallEvents = events.filter((e) => e.hall === hallName);

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

eventForm.addEventListener("submit", (e) => {
    e.preventDefault();
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

    if (editingId !== null) {
        events = events.map((ev) =>
            ev.id === editingId
        ? { ...ev, title, organizer, date, time, hall, status }
                : ev
        );
    } else {
        events.push({
            id: nextId(),
            title,
            organizer,
            date,
            time,
            hall,
            status
        });
    }

    saveData();
    closeModal();
    renderTable();
    renderCalendar();
});

eventsTbody.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const action = btn.dataset.action;

    if (action === "edit") {
        const target = events.find((ev) => ev.id === id);
        if (target) openModal(target);
    } else if (action === "delete") {
        events = events.filter((ev) => ev.id !== id);
        saveData();
        renderTable();
        renderCalendar();
    }
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

loadData();
renderTable();
renderCalendar();