require('dotenv').config();
const prisma = require('../src/config/prisma');
const repo = require('../src/modules/users/users.repository');
const { createUser } = require('../src/modules/users/users.service');

const ROLE_NAMES = ['ADMIN', 'MANAGER', 'TEACHER', 'PARENT'];

(async () => {
  try {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
      console.error('Задай ADMIN_EMAIL та ADMIN_PASSWORD у .env');
      process.exitCode = 1;
      return;
    }

    for (const name of ROLE_NAMES) {
      if (!(await repo.findRoleByName(name))) {
        await prisma.roles.create({ data: { name } });
      }
    }

    if (await repo.findAnyByRole('ADMIN')) {
      console.log('Адміністратор уже існує');
      return;
    }

    const admin = await createUser({ email, password, role: 'ADMIN' });
    console.log('Першого адміністратора створено:', admin);
  } catch (err) {
    console.error('Помилка:', err.status || '', err.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();