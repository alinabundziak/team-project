# Dev 1: авторизація, користувачі, діти, батьки

## Коротко, що зроблено

**D1-01. Валідація та контролери**
- Додано middleware `validate` (`src/middleware/validate.js`): перевірка ID, обов'язкових полів і форматів до контролера й сервісу. Валідатори лежать у `*.validators.js` модулів auth, users, children, parents.
- Порядок у маршруті: `authenticate`, `authorizeRoles`, `validate`. Неавторизований користувач не бачить правил валідації (спочатку 401/403, потім 400).
- Єдині HTTP-статуси: 201 на створення, 200 на читання й оновлення, 204 на видалення без тіла (`src/utils/respond.js`).
- Єдиний формат помилок: `{ "error": { "status": 400, "message": "..." } }`. Формат успішних відповідей не змінювався: одна сутність як є, список як `{ "data": [...], "meta": {...} }`.
- `errorHandler` додатково перетворює помилки Prisma на HTTP: P2002 на 409, P2025 на 404, P2003 на 409, поламаний JSON на 400. Невідомі маршрути повертають JSON 404.
- Дублікати: 409 (email користувача, профіль батька, зв'язок дитина-батько).

**D1-02. Діти та батьки**
- CRUD дітей і батьків із пагінацією, пошуком і валідацією. Вік дитини від 2 до 5 повних років на сьогодні (`src/config/childrenRules.js`).
- Підтримка кількох батьків для однієї дитини й кількох дітей для одного Parent: нова таблиця `child_parents (child_id, parent_id)` зі складним первинним ключем, тому дубль зв'язку неможливий.
- Parent не змінює дані дитини. Він може лише переглядати її та додавати або змінювати власний опис: `PATCH /api/children/:id/parent-note` (поле `parentNote`, до 500 символів, `null` очищає).
- Поле `parentNote` може переглядити та змінювати ADMIN, MANAGER та PARENT для власної дитини.
- Видалення батька з дітьми дає 409. Видалення дитини прибирає її зв'язки (`Cascade`), батьки лишаються.

**D1-03. Авторизація та права доступу**
- Login із bcrypt, однакова відповідь 401 для хибного email і хибного пароля, перевірка пароля виконується і для неіснуючого email (час відповіді не видає зареєстровані адреси).
- JWT (HS256, термін дії з `.env`), роль і існування користувача перевіряються з БД на кожен запит, тому зміна ролі діє одразу.
- Parent бачить лише власних дітей. Чужа й неіснуюча дитина повертають однаковий 404, тому ID перебрати неможливо. Профілі батьків та список дітей недоступні Parent.

## Маршрути Dev 1

| Метод і шлях | Ролі | Успіх |
|---|---|---|
| `POST /api/auth/login` | публічний | 200 `{ token, user }` |
| `GET /api/users/me` | усі автентифіковані | 200 |
| `POST /api/users` | ADMIN | 201 |
| `GET /api/children` | ADMIN, MANAGER | 200 `{ data, meta }` |
| `POST /api/children` | ADMIN, MANAGER | 201 |
| `GET /api/children/:id` | ADMIN, MANAGER, PARENT (лише своя дитина) | 200 |
| `PATCH /api/children/:id` | ADMIN, MANAGER | 200 |
| `DELETE /api/children/:id` | ADMIN | 204 |
| `PATCH /api/children/:id/parent-note` | PARENT (лише своя дитина) | 200 |
| `POST /api/children/:id/parents` | ADMIN, MANAGER | 201 |
| `DELETE /api/children/:id/parents/:parentId` | ADMIN, MANAGER | 204 |
| `GET /api/parents`, `GET /api/parents/:id` | ADMIN, MANAGER | 200 |
| `POST /api/parents` | ADMIN, MANAGER | 201 |
| `PATCH /api/parents/:id` | ADMIN, MANAGER | 200 |
| `DELETE /api/parents/:id` | ADMIN | 204 |
| `GET /api/parents/me/children` | PARENT | 200 `{ data, meta }` |

Формат дитини: `id`, `firstName`, `lastName`, `dateOfBirth`, `age`, `groupId`, `parentIds` (масив), `parentNote`.

Статуси помилок: 400 некоректні дані, 401 немає або недійсний токен, 403 недостатньо прав, 404 не знайдено (у тому числі чужа дитина для Parent), 409 дубль або конфлікт, 500 внутрішня помилка.

## Зміни в schema.prisma 

До бази даних потрібно додати нову таблицю child_parents для підтримки зв'язку багато до багатьох між children і parents. У schema.prisma вона описана як

```prisma
model child_parents {
  child_id   Int
  parent_id  Int
  created_at DateTime? @default(now()) @db.Timestamp(6)
  children   children  @relation(fields: [child_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  parents    parents   @relation(fields: [parent_id], references: [id], onDelete: Restrict, onUpdate: NoAction)

  @@id([child_id, parent_id])
  @@index([parent_id])
}
```

Для забезпечення цих зв'язків також потрібно додати рядки `child_parents child_parents[]` в обох моделях children і parents.

## Що видалити зі схеми (після підтвердження всіма Dev)

Зв'язок дитина-батько тепер має зберігаєтися в `child_parents`. Стара колонка `children.parent_id` і зворотне поле `parents.children` **поки не видалені**, бо інші Dev могли їх використовувати. Коли всі підтвердять, що вони не користуються цими полями, треба видалити:

У `children`:
```prisma
parent_id Int?
parents   parents? @relation(fields: [parent_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
```

У `parents`:
```prisma
children  children[]
```

Рядки `child_parents child_parents[]` в обох моделях мають бути додані.

Важливо: доки `parent_id` існує, на ньому стоїть `onDelete: Cascade`, тому записувати в нього значення не можна, бо видалення батька видалило б дитину. Новий код цю колонку не використовує.

Порядок видалення:
1. Перевірити, що колонка порожня (Prisma Studio, таблиця `children`) і що жоден код її не використовує:
   `Select-String -Pattern "parent_id|include:\s*\{\s*(parents|children)"` по `src`, `scripts`, `prisma`, `tests`.
2. Видалити рядки вище в `prisma/schema.prisma`, потім `npm run db:validate`.
3. `npm run db:push` виконує відповідальний за БД (у виводі лише видалення колонки; без прапорця `--accept-data-loss`).
4. У всіх: `git pull`, `npm run db:generate`, перезапуск сервера.

## Для Dev 2, Dev 3, Dev 4

- Для даних **конкретної дитини** (розклад, фінанси) Parent перевіряйте так: `assertChildAccess(req.user, childId)` з `src/modules/children/children.access.js`. Він уже працює через `child_parents`. ADMIN і MANAGER проходять завжди, PARENT лише для власних дітей, інші ролі ніколи. Чужа й неіснуюча дитина дають 404.
- Для Parent перегляд власних фінансових даних. Якщо потрібно використати мої `GET /children/:childId/balance` чи `financial-history`, там треба дозволити роль PARENT на маршруті й викликати `assertChildAccess` у сервісі. Поки ці маршрути залишаються лише для ADMIN.
- Зв'язок дитина-батько тепер у таблиці `child_parents`. Після погодженя цієї таблиці та інших змін у бд усім потрібно виконати `npm run db:generate` і перезапустити сервер.

## Змінені параметри

- Додавання другого батька до дитини тепер повертає **201**. Статус 409 дає лише дубль того самого зв'язку.
- У `Child` є `parentIds` (масив) і `parentNote`.
- Parent змінює лише `PATCH /api/children/:id/parent-note`. `PATCH /api/children/:id` для нього 403.
- Успішні відповіді не змінились, помилки мають єдиний формат `{ error: { status, message } }`.
- Чужа дитина для Parent: 404. Parent на `GET /api/children` (список): 403.


## Відомі обмеження

- Вікове правило 2-5 років перевіряється при створенні дитини й при зміні дати народження. Діти, які вже виросли, поки залишаються в системі.
- Parent не редагує власний профіль батька (лише `parentNote` дитини). Якщо це потрібно змінити, як описано вище.
- Немає обмеження кількості спроб входу та відкликання токенів.
- Ліміт кількості батьків на дитину не встановлено, бо в завданні його немає.
- Фінансові маршрути Dev 1 доступні тільки ADMIN.