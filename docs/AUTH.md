# Авторизація: як користуватися

## Логін і токен
`POST /api/auth/login` з тілом `{ "email": "...", "password": "..." }` повертає `{ token, user }`.
Токен (JWT) передається в кожному захищеному запиті в заголовку:

    Authorization: Bearer <token>

## Захист маршруту (шаблон для копіювання)

    const authenticate = require('../../middleware/authenticate');
    const authorizeRoles = require('../../middleware/authorizeRoles');
    const { ROLES } = require('../../config/roles');

    // тільки Admin
    router.get('/', authenticate, authorizeRoles(ROLES.ADMIN), controller.list);

    // кілька ролей
    router.get('/:id', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.MANAGER), controller.get);

    // увесь роутер закрити токеном
    router.use(authenticate);

Порядок завжди такий: `authenticate`, потім `authorizeRoles(...)`.
Якщо роль не вказана в `authorizeRoles`, доступу немає (за замовчуванням заборонено).

## Як отримати поточного користувача
Після `authenticate` у будь-якому контролері або сервісі доступний `req.user`:

    req.user.id     // number, id з таблиці users
    req.user.email  // string
    req.user.role   // 'ADMIN' | 'MANAGER' | 'TEACHER' | 'PARENT'

Передавай у сервіс окремими аргументами, а не весь `req`:

    const list = await service.list({ userId: req.user.id, role: req.user.role });

## УВАГА: req.user.id це id з таблиці users
Це НЕ id з `parents` чи `employees`. Профіль знаходиться через зв'язок:

    prisma.parents.findUnique({ where: { user_id: req.user.id } })
    prisma.employees.findUnique({ where: { user_id: req.user.id } })

## Коди помилок
Формат: `{ "error": { "status": 401, "message": "..." } }`

| Код | Коли |
|---|---|
| 400 | Некоректні дані запиту |
| 401 | Немає токена, токен недійсний/прострочений, невірний логін чи пароль |
| 403 | Токен є, але роль не дозволена |
| 404 | Не знайдено |
| 409 | Конфлікт (наприклад, дублікат) |

Помилки в сервісах кидай так: `throw new AppError(409, 'повідомлення')`
(`src/utils/AppError.js`). Обгортай async-контролери в `asyncHandler`
(`src/utils/asyncHandler.js`), інакше помилка не дійде до errorHandler.

## Тестові акаунти (тільки dev, команда `npm run seed-test-users`)
Пароль у всіх: `Test12345!`

| Email | Роль |
|---|---|
| admin.test@example.com | ADMIN |
| manager.test@example.com | MANAGER |
| teacher.test@example.com | TEACHER |
| parent1.test@example.com | PARENT |
| parent2.test@example.com | PARENT |
| parent3.test@example.com | PARENT |

## Живі приклади
Після запуску сервера (не production):
- `GET /api/_examples/whoami`: будь-який залогінений
- `GET /api/_examples/admin-only`: тільки ADMIN
- `GET /api/_examples/staff-only`: ADMIN та MANAGER
Код: `src/modules/auth/auth.examples.routes.js`

## Postman
Колекція в `docs/postman/`. Спочатку виконай логін кожної ролі, токени збережуться в змінні.


## Доступ Parent до даних дитини

Parent бачить лише власних дітей (child.parent_id = id профілю батька).
Чужа дитина і неіснуюча повертають однакову відповідь: **404** «Дитину не знайдено».

Для будь-якого маршруту, що працює з даними конкретної дитини
(група дитини, підписки, платежі, пільги), використовуй готову перевірку:

    const { assertChildAccess } = require('../children/children.access');

    // дозволь роль PARENT на маршруті і перевір власність у сервісі:
    router.get('/children/:id/payments',
      authenticate,
      authorizeRoles(ROLES.ADMIN, ROLES.PARENT),
      asyncHandler(controller.listForChild));

    // у сервісі, ДО читання даних:
    const child = await assertChildAccess(req.user, childId);

`assertChildAccess` повертає запис дитини (поля БД) або кидає AppError 404.
Групу, підписки та платежі дитини Parent зможе побачити лише тоді, коли Dev 2 і Dev 4 викличуть assertChildAccess у своїх маршрутах.
ADMIN і MANAGER проходять завжди, PARENT лише для своїх дітей, решта ролей ніколи.
Менеджеру фінанси закриваються окремо через `authorizeRoles(ROLES.ADMIN)`.

Нові маршрути:
- `GET /api/parents/me/children`: тільки PARENT, його діти (пагінація page/limit)
- `GET /api/children/:id`: ADMIN, MANAGER, PARENT (тільки своя дитина)