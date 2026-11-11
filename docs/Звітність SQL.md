**Тест 1** 


SELECT 

`  `c.relname AS table\_name,

`  `count(t.tgname) AS total\_unique\_triggers,

`  `count(CASE WHEN t.tgname = 'trg\_audit\_row\_change' THEN 1 END) AS row\_triggers,

`  `count(CASE WHEN t.tgname = 'trg\_audit\_truncate' THEN 1 END) AS truncate\_triggers

FROM pg\_trigger t

JOIN pg\_class c ON t.tgrelid = c.oid

JOIN pg\_namespace n ON c.relnamespace = n.oid

WHERE n.nspname = 'public'

`  `AND t.tgname IN ('trg\_audit\_row\_change', 'trg\_audit\_truncate')

`  `AND NOT t.tgisinternal

GROUP BY c.relname

ORDER BY c.relname;

![](Aspose.Words.2cb0560f-050e-49b3-bd99-102306ec4fdc.001.png)

Перевірки та фіксації 50 унікальних тригерів для 25 бізнес-таблиць виконано у повному обсязі без відхилень.

**Тест 2**


SELECT grantee, privilege\_type 

FROM information\_schema.role\_table\_grants 

WHERE table\_name = 'audit\_logs' AND table\_schema = 'public';


![](Aspose.Words.2cb0560f-050e-49b3-bd99-102306ec4fdc.002.png)

Залишку робіт Dev2 щодо безпеки та захисту даних аудиту виконано у повному обсязі. Несанкціоноване модифікування або підробка записів у журналі аудиту унеможливлені.

**Тест 3**


SELECT id, table\_name, record\_key, operation, old\_data, new\_data, changed\_columns, db\_user, changed\_at

FROM public.audit\_logs 

ORDER BY id DESC LIMIT 5;

![](Aspose.Words.2cb0560f-050e-49b3-bd99-102306ec4fdc.003.png)

Механізм аудиту повністю відповідає технічним вимогам щодо обробки та реєстрації модифікацій даних у таблицях БД.

**Тест 4**

SELECT indexname, indexdef 

FROM pg\_indexes 

WHERE tablename = 'audit\_logs' AND schemaname = 'public';

![](Aspose.Words.2cb0560f-050e-49b3-bd99-102306ec4fdc.004.png)

Дубльовані індекси успішно видалено. Схему таблиці audit\_logs повністю оптимізовано, зайве оновлення індексних дерев при збереженні логів усунено.

**Тест 5**

TRUNCATE TABLE public.discounts CASCADE;

SELECT table\_name, operation, db\_user, changed\_at 

FROM public.audit\_logs 

WHERE operation = 'TRUNCATE' 

ORDER BY id DESC LIMIT 1;

![](Aspose.Words.2cb0560f-050e-49b3-bd99-102306ec4fdc.005.png)

У журналі public.audit\_logs успішно створено запис із значеннями: table\_name = 'public.adjustments', operation = 'TRUNCATE' та db\_user = 'audit\_owner'. Операцію каскадного очищення зафіксовано повністю.

**Тест 6**

WITH before\_state AS (

`  `SELECT count(\*) AS count\_before FROM public.audit\_logs

),

do\_update AS (

`  `UPDATE public.users SET email = email WHERE id = 1

`  `RETURNING \*

)

SELECT 

`  `before\_state.count\_before,

`  `(SELECT count(\*) FROM public.audit\_logs) AS count\_after

FROM before\_state;

![](Aspose.Words.2cb0560f-050e-49b3-bd99-102306ec4fdc.006.png)

До виконання запиту кількість записів в audit\_logs становила 30 (count\_before = 30), а після виконання холостого UPDATE кількість записів залишилася 30 (count\_after = 30). Відсутність нових рядків підтверджує, що тригер коректно ігнорує операції без зміни стану даних.

**Тест 7**

INSERT INTO public.users (email, password\_hash) 

VALUES ('test\_audit\_sec@example.com', 'super\_secret\_hash\_123');

SELECT table\_name, operation, new\_data 

FROM public.audit\_logs 

WHERE table\_name = 'public.users' 

ORDER BY id DESC LIMIT 1;

DELETE FROM public.users WHERE email = 'test\_audit\_sec@example.com';

![](Aspose.Words.2cb0560f-050e-49b3-bd99-102306ec4fdc.007.png)

При створенні нового запису у таблиці public.users до журналу public.audit\_logs було записано JSON-структуру new\_data: {"id":15, "email":"test\_audit\_sec@example.com", "phone":null, "role\_id":null, ...}. Поле password\_hash було автоматично санітизоване та виключене з аудиту, що повністю запобігає витоку секретних даних.

**Тест 8**

INSERT INTO public.users (email, password\_hash) 

VALUES ('test\_pk\_check@example.com', 'dummy\_hash\_for\_test');

SELECT table\_name, record\_key, operation 

FROM public.audit\_logs 

WHERE table\_name = 'public.users' 

ORDER BY id DESC LIMIT 1;

DELETE FROM public.users WHERE email = 'test\_pk\_check@example.com';

![](Aspose.Words.2cb0560f-050e-49b3-bd99-102306ec4fdc.008.png)

При додаванні запису до таблиці public.users тригер зафіксував операцію INSERT та згенерував об'єкт record\_key у вигляді {"id":16} (або {"id":17}). Це підтверджує коректне динамічне визначення та серіалізацію первинних ключів.

**Тест 9**

INSERT INTO public.users (email, password\_hash) 

VALUES ('test\_delete\_cascade@example.com', 'dummy\_hash');

DELETE FROM public.users WHERE email = 'test\_delete\_cascade@example.com';

SELECT table\_name, record\_key, operation, changed\_at 

FROM public.audit\_logs 

WHERE operation = 'DELETE' 

ORDER BY id DESC LIMIT 1;

![](Aspose.Words.2cb0560f-050e-49b3-bd99-102306ec4fdc.009.png)

У журналі public.audit\_logs зафіксовано запис з операцією DELETE для таблиці public.users. У полі record\_key збережено первинний ключ видаленого запису ({"id":18} / {"id":19}), а у полі changed\_at зафіксовано точний час очищення.

**Тест 10**

WITH before\_state AS (

`  `SELECT count(\*) AS count\_before\_fail FROM public.audit\_logs

),

attempt\_insert AS (

`  `INSERT INTO public.users (email, password\_hash) 

`  `VALUES ('duplicate@test.com', 'hash')

`  `ON CONFLICT DO NOTHING

)

SELECT 

`  `before\_state.count\_before\_fail,

`  `(SELECT count(\*) FROM public.audit\_logs) AS count\_after\_fail

FROM before\_state;

![](Aspose.Words.2cb0560f-050e-49b3-bd99-102306ec4fdc.010.png)

Кількість записів у таблиці public.audit\_logs до виконання запиту становила **42** (count\_before\_fail = 42), і після виконання операції з конфліктом залишилася рівною **42** (count\_after\_fail = 42). Відсутність нових рядків підтверджує, що механізм аудиту повністю захищений від збереження «фантомних» логів нездійснених операцій.

**Тест 11**


INSERT INTO public.users (email, password\_hash) VALUES ('test\_base@example.com', 'hash123');

UPDATE public.users SET email = 'test\_base\_updated@example.com' WHERE email = 'test\_base@example.com';

DELETE FROM public.users WHERE email = 'test\_base\_updated@example.com';

SELECT table\_name, record\_key, operation, old\_data, new\_data, changed\_at 

FROM public.audit\_logs 

WHERE table\_name = 'public.users' 

ORDER BY id DESC LIMIT 3;

![](Aspose.Words.2cb0560f-050e-49b3-bd99-102306ec4fdc.011.png)

Для INSERT (id: 22): old\_data дорівнює NULL, у new\_data зафіксовано початковий стан об'єкта {"id":22, "email":"test\_base\_updated@example.com", ...}.   Для UPDATE (id: 22): зафіксовано попередній стан у old\_data та новий стан у new\_data.   Для DELETE (id: 22): у old\_data збережено фінальний стан видаленого запису, а new\_data дорівнює NULL

**Тест 12**

INSERT INTO public.users (email, password\_hash) VALUES ('update\_test@example.com', 'hash123');

UPDATE public.users SET email = 'update\_step1@example.com' WHERE email = 'update\_test@example.com';

UPDATE public.users SET email = 'update\_step2@example.com' WHERE email = 'update\_step1@example.com';

UPDATE public.users SET email = 'update\_step2@example.com' WHERE email = 'update\_step2@example.com';

SELECT table\_name, record\_key, operation, old\_data->>'email' AS old\_email, new\_data->>'email' AS new\_email, changed\_at 

FROM public.audit\_logs 

WHERE table\_name = 'public.users' AND operation = 'UPDATE' 

ORDER BY id DESC LIMIT 3;

DELETE FROM public.users WHERE email = 'update\_step2@example.com';

![](Aspose.Words.2cb0560f-050e-49b3-bd99-102306ec4fdc.012.png)

Виконання холостого UPDATE з тими ж значеннями полів не призвело до створення додаткового рядка в audit\_logs (у вибірці залишилися лише 2 записи для id: 23).

**Тест 13**


INSERT INTO public.users (email, password\_hash) VALUES 

`  `('bulk1@example.com', 'hash1'),

`  `('bulk2@example.com', 'hash2');

UPDATE public.users SET phone = '+380000000000' WHERE email IN ('bulk1@example.com', 'bulk2@example.com');

SELECT table\_name, record\_key, operation, new\_data->>'phone' AS phone, changed\_at 

FROM public.audit\_logs 

WHERE operation = 'UPDATE' 

ORDER BY id DESC LIMIT 2;

DELETE FROM public.users WHERE email IN ('bulk1@example.com', 'bulk2@example.com');

![](Aspose.Words.2cb0560f-050e-49b3-bd99-102306ec4fdc.013.png)

Тригер згенерував два окремих записи в public.audit\_logs для record\_key = {"id":24} та record\_key = {"id":25} відповідно, встановивши значення phone = +380000000000 для обох об'єктів з однаковою часовою міткою 2026-11-09 10:36:54.642897+00.

**Тест 14**

SELECT table\_name, operation, record\_key, changed\_at 

FROM public.audit\_logs 

WHERE operation = 'TRUNCATE' 

ORDER BY id DESC LIMIT 3;

![](Aspose.Words.2cb0560f-050e-49b3-bd99-102306ec4fdc.014.png)

У журналі public.audit\_logs зафіксовано записи з операцією TRUNCATE для таблиць public.adjustments, public.refunds та public.child\_parents зі значеннями record\_key та однаковою міткою часу 2026-11-09 10:07:27.355402+00.

**Тест 15**

INSERT INTO public.users (email, password\_hash) VALUES ('test\_audit\_sec@example.com', 'super\_secret\_hash\_123');

SELECT table\_name, operation, new\_data 

FROM public.audit\_logs 

WHERE table\_name = 'public.users' 

ORDER BY id DESC LIMIT 1;

![](Aspose.Words.2cb0560f-050e-49b3-bd99-102306ec4fdc.015.png)

У журналі public.audit\_logs зафіксовано запис INSERT для id: 26. У об'єкті new\_data збережено базові атрибути користувача ({"id":26, "email":"test\_audit\_sec@example.com", "phone":null, "role\_id":null}), але секретний ключ password\_hash відсутній. Це підтверджує надійну санітизацію даних перед збереженням логів у БД.

**Тест 16**

INSERT INTO public.users (email, password\_hash) VALUES ('test\_delete\_cascade@example.com', 'dummy\_hash');

DELETE FROM public.users WHERE email = 'test\_delete\_cascade@example.com';

SELECT table\_name, record\_key, operation, changed\_at 

FROM public.audit\_logs 

WHERE operation = 'DELETE' 

ORDER BY id DESC LIMIT 1;

![](Aspose.Words.2cb0560f-050e-49b3-bd99-102306ec4fdc.016.png)

У журналі public.audit\_logs успішно зафіксовано запис з операцією DELETE для таблиці public.users. У полі record\_key зафіксовано ідентифікатор видаленого запису ({"id":27}), а у полі changed\_at збережено точний час очищення — 2026-11-09 10:43:01.943007+00.

**Тест 17**

WITH before\_state AS (

`  `SELECT count(\*) AS count\_before\_fail FROM public.audit\_logs

),

attempt\_insert AS (

`  `INSERT INTO public.users (email, password\_hash) 

`  `VALUES ('duplicate@test.com', 'hash')

`  `ON CONFLICT DO NOTHING

)

SELECT 

`  `before\_state.count\_before\_fail,

`  `(SELECT count(\*) FROM public.audit\_logs) AS count\_after\_fail

FROM before\_state;

![](Aspose.Words.2cb0560f-050e-49b3-bd99-102306ec4fdc.017.png)

Значення count\_before\_fail (58) дорівнює count\_after\_fail (58). Відсутність зміни кількості рядків у public.audit\_logs підтверджує захист системи аудиту від «фантомних» записів у разі заблокованих або скасованих операцій.

**Тест 18**

SELECT trigger\_name, event\_manipulation, event\_object\_table, action\_statement

FROM information\_schema.triggers

WHERE trigger\_schema = 'public' 

`  `AND trigger\_name LIKE '%audit%';

![](Aspose.Words.2cb0560f-050e-49b3-bd99-102306ec4fdc.018.png)

Системний каталог підтвердив успішне наявність та коректну прив'язку тригерів аудиту (audit\_row\_roles, audit\_row\_users, audit\_row\_employees) без конфліктів і збоїв.

**Тест 19**

DELETE FROM public.employees WHERE user\_id IN (SELECT id FROM public.users WHERE email = 'parent\_cascade@test.com');

DELETE FROM public.users WHERE email = 'parent\_cascade@test.com';

WITH inserted\_user AS (

`    `INSERT INTO public.users (email, password\_hash) 

`    `VALUES ('parent\_cascade@test.com', 'hash') 

`    `RETURNING id

),

inserted\_employee AS (

`    `INSERT INTO public.employees (user\_id, first\_name, last\_name, position) 

`    `SELECT id, 'Test', 'Employee', 'manager' FROM inserted\_user

`    `RETURNING user\_id

)

SELECT 1;

DELETE FROM public.employees 

WHERE user\_id IN (SELECT id FROM public.users WHERE email = 'parent\_cascade@test.com');

DELETE FROM public.users 

WHERE email = 'parent\_cascade@test.com';

SELECT table\_name, operation, record\_key 

FROM public.audit\_logs 

WHERE operation = 'DELETE' 

ORDER BY id DESC LIMIT 2;

![](Aspose.Words.2cb0560f-050e-49b3-bd99-102306ec4fdc.019.png)

**Тест 20**

INSERT INTO public.discounts (id, code, name, percent) 

VALUES (1, 'STD-01', 'Standard', 0.00) 

ON CONFLICT (id) DO NOTHING;

INSERT INTO public.children (first\_name, last\_name, birth\_date, discount\_id) 

VALUES ('TestChild', 'Audit', '2020-01-01', 1)

ON CONFLICT DO NOTHING;

INSERT INTO public.parents (first\_name, last\_name) 

VALUES ('TestParent', 'Audit')

ON CONFLICT DO NOTHING;

INSERT INTO public.child\_parents (child\_id, parent\_id) 

VALUES (

`    `(SELECT id FROM public.children ORDER BY id DESC LIMIT 1), 

`    `(SELECT id FROM public.parents ORDER BY id DESC LIMIT 1)

)

ON CONFLICT DO NOTHING;

SELECT table\_name, record\_key, operation 

FROM public.audit\_logs 

WHERE table\_name = 'public.child\_parents' 

ORDER BY id DESC LIMIT 1;

![](Aspose.Words.2cb0560f-050e-49b3-bd99-102306ec4fdc.020.png)
