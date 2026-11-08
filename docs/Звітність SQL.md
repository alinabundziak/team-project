**Тест 1** 


SELECT 

`  `c.relname AS table\_name,

`  `count(t.tgname) AS total\_unique\_triggers,

`  `count(CASE WHEN t.tgname LIKE 'audit\_row\_%' THEN 1 END) AS row\_triggers,

`  `count(CASE WHEN t.tgname LIKE 'audit\_truncate\_%' THEN 1 END) AS truncate\_triggers

FROM pg\_trigger t

JOIN pg\_class c ON t.tgrelid = c.oid

JOIN pg\_namespace n ON c.relnamespace = n.oid

WHERE n.nspname = 'public'

`  `AND t.tgname LIKE 'audit\_%'

`  `AND NOT t.tgisinternal

GROUP BY c.relname

ORDER BY c.relname;

![](Aspose.Words.f5d3e164-0f3f-4fee-9173-a14203b63f44.001.png)

Перевірки та фіксації 50 унікальних тригерів для 25 бізнес-таблиць виконано у повному обсязі без відхилень.

**Тест 2**


SELECT grantee, privilege\_type 

FROM information\_schema.role\_table\_grants 

WHERE table\_name = 'audit\_logs' AND table\_schema = 'public';


![](Aspose.Words.f5d3e164-0f3f-4fee-9173-a14203b63f44.002.png)

Залишку робіт Dev2 щодо безпеки та захисту даних аудиту виконано у повному обсязі. Несанкціоноване модифікування або підробка записів у журналі аудиту унеможливлені.

**Тест 3**


UPDATE discounts SET percentage = percentage WHERE id = 1;

SELECT id, table\_name, record\_key, operation, old\_data, new\_data, changed\_columns, db\_user, changed\_at

FROM public.audit\_logs 

ORDER BY id DESC LIMIT 5;

![](Aspose.Words.f5d3e164-0f3f-4fee-9173-a14203b63f44.003.png)

Механізм аудиту повністю відповідає технічним вимогам щодо обробки та реєстрації модифікацій даних у таблицях БД.

**Тест 4**

SELECT indexname, indexdef 

FROM pg\_indexes 

WHERE tablename = 'audit\_logs' AND schemaname = 'public';

![](Aspose.Words.f5d3e164-0f3f-4fee-9173-a14203b63f44.004.png)

Дубльовані індекси успішно видалено. Схему таблиці audit\_logs повністю оптимізовано, зайве оновлення індексних дерев при збереженні логів усунено.
