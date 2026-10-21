require('dotenv').config();
const prisma = require('../src/config/prisma');
const repo = require('../src/modules/users/users.repository');
const { createUser } = require('../src/modules/users/users.service');
const { ROLE_LIST } = require('../src/config/roles');

const TEST_PASSWORD = 'Test12345!';

const ACCOUNTS = [
  { email: 'admin.test@example.com', role: 'ADMIN' },
  { email: 'manager.test@example.com', role: 'MANAGER' },
  { email: 'teacher.test@example.com', role: 'TEACHER' },
  { email: 'parent1.test@example.com', role: 'PARENT' },
  { email: 'parent2.test@example.com', role: 'PARENT' },
];

(async () => {
  try {
    if (process.env.NODE_ENV === 'production') {
      console.error('Заборонено запускати на production');
      process.exitCode = 1;
      return;
    }

    for (const name of ROLE_LIST) {
      if (!(await repo.findRoleByName(name))) {
        await prisma.roles.create({ data: { name } });
      }
    }

    for (const acc of ACCOUNTS) {
      if (await repo.findByEmail(acc.email)) {
        console.log(`Пропущено (вже є): ${acc.email}`);
        continue;
      }
      const user = await createUser({ ...acc, password: TEST_PASSWORD });
      console.log(`Створено: ${user.email} (${user.role})`);
    }

    console.log(`\nПароль усіх тестових акаунтів: ${TEST_PASSWORD}`);
  } catch (err) {
    console.error('Помилка:', err.status || '', err.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();