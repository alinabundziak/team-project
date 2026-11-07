
const repo = require('./audit.repository');
const AppError = require('../../utils/AppError');
const { parsePagination } = require('../../utils/pagination');

const ALLOWED_OPERATIONS = ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'];

const ALLOWED_TABLES = [
  'public.roles',
  'public.users',
  'public.employees',
  'public.parents',
  'public.rooms',
  'public.groups',
  'public.children',
  'public.discounts',
  'public.activities',
  'public.teacher_activities',
  'public.schedules',
  'public.staff_assignments',
  'public.rules',
  'public.charges',
  'public.payments',
  'public.refunds',
  'public.tariffs',
  'public.meal_rates',
  'public.adjustments',
  'public.subscriptions',
  'public.child_benefits',
  'public.meal_plans',
  'public.pricing_plans',
  'public.expenses',
  'public.child_parents',
];

function parseDate(value, name) {
  if (value === undefined) return undefined;

  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(400, `${name} має бути у форматі YYYY-MM-DD`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new AppError(400, `${name} містить некоректну дату`);
  }

  return date;
}

function toAuditDto(log) {
  return {
    id: log.id,
    tableName: log.table_name,
    recordKey: log.record_key,
    operation: log.operation,
    oldData: log.old_data,
    newData: log.new_data,
    changedColumns: log.changed_columns,
    databaseUser: log.db_user,
    changedAt: new Date(log.changed_at).toISOString(),
  };
}

async function listAuditLogs(query = {}) {
  const { tableName, operation, from, to } = query;
  const { page, limit } = parsePagination(query);

  if (tableName !== undefined && !ALLOWED_TABLES.includes(tableName)) {
    throw new AppError(400, 'Невідома назва таблиці');
  }

  if (operation !== undefined && !ALLOWED_OPERATIONS.includes(operation)) {
    throw new AppError(400, 'Некоректний тип операції');
  }

  const fromDate = parseDate(from, 'from');
  const toDate = parseDate(to, 'to');

  if (fromDate && toDate && fromDate > toDate) {
    throw new AppError(400, 'Дата from не може бути пізніше за to');
  }

  const where = {};

  if (tableName !== undefined) {
    where.table_name = tableName;
  }

  if (operation !== undefined) {
    where.operation = operation;
  }

  if (fromDate || toDate) {
    where.changed_at = {};

    if (fromDate) {
      where.changed_at.gte = fromDate;
    }

    if (toDate) {
      const nextDay = new Date(toDate);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      where.changed_at.lt = nextDay;
    }
  }

  const skip = (page - 1) * limit;

  const logs = await repo.findMany({
    where,
    skip,
    take: limit,
  });

  const total = await repo.count(where);

  return {
    data: logs.map(toAuditDto),
    meta: {
      page,
      limit,
      total,
    },
  };
}

module.exports = { listAuditLogs };
