const { test } = require("node:test");
const assert = require("node:assert/strict");
const proxyquire = require("proxyquire").noCallThru();

test("не дозволяє змінити посаду працівника, призначеного до групи", async () => {
    const prisma = {
        employees: {
            findUnique: async () => ({
                id: 5,
                position: "EDUCATOR"
            }),
            update: async ({ data }) => ({
                id: 5,
                user_id: null,
                first_name: "Олена",
                last_name: "Тест",
                phone: null,
                position: data.position,
                subject: null,
                salary: 40000
            })
        },
        groups: { count: async () => 1 },
        staff_assignments: { count: async () => 0 },
        schedules: { count: async () => 0 },
        teacher_activities: { count: async () => 0 }
    };

    const service = proxyquire(
        "../src/modules/employees/staff.service.js",
        {
            "../../config/prisma": prisma,
            "../payroll/payroll.service": {}
        }
    );

    await assert.rejects(
        service.updateStaff(5, { position: "TEACHER" }),
        error =>
            error.code === "STAFF_POSITION_IN_USE" &&
            error.status === 409
    );
});

test("не дозволяє змінити посаду призначеного помічника", async () => {
    const prisma = {
        employees: {
            findUnique: async () => ({
                id: 6,
                position: "ASSISTANT"
            }),
            update: async ({ data }) => ({
                id: 6,
                user_id: null,
                first_name: "Марія",
                last_name: "Тест",
                phone: null,
                position: data.position,
                subject: null,
                salary: 20000
            })
        },
        groups: { count: async () => 1 },
        staff_assignments: { count: async () => 0 },
        schedules: { count: async () => 0 },
        teacher_activities: { count: async () => 0 }
    };

    const service = proxyquire(
        "../src/modules/employees/staff.service.js",
        {
            "../../config/prisma": prisma,
            "../payroll/payroll.service": {}
        }
    );

    await assert.rejects(
        service.updateStaff(6, { position: "EDUCATOR" }),
        error =>
            error.code === "STAFF_POSITION_IN_USE" &&
            error.status === 409
    );
});

test("не дозволяє змінити предмет викладача, призначеного до дисципліни", async () => {
    const prisma = {
        employees: {
            findUnique: async () => ({
                id: 7,
                position: "TEACHER"
            }),
            update: async () => {
                throw new Error("Оновлення не мало виконатися");
            }
        },
        teacher_activities: {
            findMany: async () => [
                { activities: { name: "Музика" } }
            ],
            count: async () => 1
        },
        groups: { count: async () => 0 },
        staff_assignments: { count: async () => 0 },
        schedules: { count: async () => 0 }
    };

    const service = proxyquire(
        "../src/modules/employees/staff.service.js",
        {
            "../../config/prisma": prisma,
            "../payroll/payroll.service": {}
        }
    );

    await assert.rejects(
        service.updateStaff(7, { subject: "Математика" }),
        (error) =>
            error.code === "STAFF_SUBJECT_IN_USE" &&
            error.status === 409
    );
});