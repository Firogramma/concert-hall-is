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

INSERT INTO events (title, organizer, event_date, event_time, hall_id, status) VALUES
    ('Симфонический вечер «Осень»', 'Филармония РБ', '2026-11-19', '18:00', 1, 'Подтверждено'),
    ('Форум молодых исполнителей', 'Арт-Центр Уфа', '2026-11-20', '14:00', 2, 'На согласовании'),
    ('Джазовый квинтет «Север»', 'Джаз-клуб', '2026-11-21', '19:00', 3, 'Запланировано');
