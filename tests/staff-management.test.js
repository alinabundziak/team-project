const { test } = require("node:test");
const assert = require("node:assert/strict");
const proxyquire = require("proxyquire").noCallThru();

test("створює працівника з переданими даними", async () => {
    let savedData;

    const prisma = {
        employees: {
            create: async ({ data }) => {
                savedData = data;

                return {
                    id: 1,
                    user_id: null,
                    first_name: data.first_name,
                    last_name: data.last_name,
                    phone: data.phone,
                    position: data.position,
                    subject: data.subject,
                    salary: 40000
                };
            }
        }
    };

    const service = proxyquire(
        "../src/modules/employees/staff.service.js",
        {
            "../../config/prisma": prisma,
            "../payroll/payroll.service": {}
        }
    );

    const result = await service.createStaff({
        firstName: "Олена",
        lastName: "Тест",
        position: "EDUCATOR"
    });

    assert.deepEqual(savedData, {
        first_name: "Олена",
        last_name: "Тест",
        position: "EDUCATOR",
        phone: null,
        subject: null
    });
    assert.equal(result.id, 1);
    assert.equal(result.position, "EDUCATOR");
});

test("оновлює контактні дані працівника", async () => {
    let updatedData;

    const prisma = {
        employees: {
            findUnique: async () => ({
                id: 1,
                position: "EDUCATOR"
            }),
            update: async ({ data }) => {
                updatedData = data;

                return {
                    id: 1,
                    user_id: null,
                    first_name: "Олена",
                    last_name: "Тест",
                    phone: data.phone,
                    position: "EDUCATOR",
                    subject: null,
                    salary: 40000
                };
            }
        }
    };

    const service = proxyquire(
        "../src/modules/employees/staff.service.js",
        {
            "../../config/prisma": prisma,
            "../payroll/payroll.service": {}
        }
    );

    const result = await service.updateStaff(1, {
        phone: "+380501112233"
    });

    assert.deepEqual(updatedData, {
        phone: "+380501112233"
    });
    assert.equal(result.phone, "+380501112233");
});

test("не дозволяє видалити працівника з пов'язаною групою", async () => {
    const prisma = {
        employees: {
            findUnique: async () => ({ id: 1 }),
            delete: async () => {
                throw new Error("delete не повинен викликатися");
            }
        },
        groups: { count: async () => 1 },
        schedules: { count: async () => 0 },
        teacher_activities: { count: async () => 0, findMany: async () => [] },
        staff_assignments: { count: async () => 0 }
    };

    const service = proxyquire(
        "../src/modules/employees/staff.service.js",
        {
            "../../config/prisma": prisma,
            "../payroll/payroll.service": {}
        }
    );

    await assert.rejects(
        service.deleteStaff(1),
        error => error.code === "STAFF_IN_USE" && error.status === 409
    );
});

test("видаляє працівника без пов'язаних записів", async () => {
    let deleted = false;

    const prisma = {
        employees: {
            findUnique: async () => ({ id: 1 }),
            delete: async () => {
                deleted = true;
                return { id: 1 };
            }
        },
        groups: { count: async () => 0 },
        schedules: { count: async () => 0 },
        teacher_activities: { count: async () => 0, findMany: async () => [] },
        staff_assignments: { count: async () => 0 }
    };

    const service = proxyquire(
        "../src/modules/employees/staff.service.js",
        {
            "../../config/prisma": prisma,
            "../payroll/payroll.service": {}
        }
    );

    const result = await service.deleteStaff(1);

    assert.equal(deleted, true);
    assert.deepEqual(result, { id: 1 });
});

test("повертає список працівників без зарплати", async () => {
    const prisma = {
        employees: {
            findMany: async () => [{
                id: 1,
                user_id: null,
                first_name: "Олена",
                last_name: "Тест",
                phone: null,
                position: "EDUCATOR",
                subject: null,
                salary: 40000
            }]
        }
    };

    const service = proxyquire(
        "../src/modules/employees/staff.service.js",
        {
            "../../config/prisma": prisma,
            "../payroll/payroll.service": {}
        }
    );

    const result = await service.getStaff();

    assert.equal(result.length, 1);
    assert.equal(result[0].position, "EDUCATOR");
    assert.equal("monthlySalary" in result[0], false);
});

test("повертає 404 для неіснуючого працівника", async () => {
    const prisma = {
        employees: {
            findUnique: async () => null
        }
    };

    const service = proxyquire(
        "../src/modules/employees/staff.service.js",
        {
            "../../config/prisma": prisma,
            "../payroll/payroll.service": {}
        }
    );

    await assert.rejects(
        service.getStaffById(999),
        error => error.code === "STAFF_NOT_FOUND" && error.status === 404
    );
});

test("створює працівника з посадою помічника", async () => {
    const prisma = {
        employees: {
            create: async ({ data }) => ({
                id: 2,
                user_id: null,
                first_name: data.first_name,
                last_name: data.last_name,
                phone: data.phone,
                position: data.position,
                subject: data.subject,
                salary: 20000
            })
        }
    };

    const service = proxyquire(
        "../src/modules/employees/staff.service.js",
        {
            "../../config/prisma": prisma,
            "../payroll/payroll.service": {}
        }
    );

    const result = await service.createStaff({
        firstName: "Марія",
        lastName: "Помічник",
        position: "ASSISTANT"
    });

    assert.equal(result.position, "ASSISTANT");
});

test("створює викладача із зазначеною дисципліною", async () => {
    let savedData;

    const prisma = {
        employees: {
            create: async ({ data }) => {
                savedData = data;

                return {
                    id: 3,
                    user_id: null,
                    first_name: data.first_name,
                    last_name: data.last_name,
                    phone: data.phone,
                    position: data.position,
                    subject: data.subject,
                    salary: 40000
                };
            }
        }
    };

    const service = proxyquire(
        "../src/modules/employees/staff.service.js",
        {
            "../../config/prisma": prisma,
            "../payroll/payroll.service": {}
        }
    );

    const result = await service.createStaff({
        firstName: "Ірина",
        lastName: "Тест",
        position: "TEACHER",
        subject: "Музика"
    });

    assert.equal(savedData.position, "TEACHER");
    assert.equal(savedData.subject, "Музика");
    assert.equal(result.subject, "Музика");
});

test("оновлює дисципліну викладача", async () => {
    let updatedData;

    const prisma = {
        teacher_activities: {
            count: async () => 0,
            findMany: async () => []
        },
        employees: {
            findUnique: async () => ({
                id: 3,
                position: "TEACHER"
            }),
            update: async ({ data }) => {
                updatedData = data;

                return {
                    id: 3,
                    user_id: null,
                    first_name: "Ірина",
                    last_name: "Тест",
                    phone: null,
                    position: "TEACHER",
                    subject: data.subject,
                    salary: 40000
                };
            }
        }
    };

    const service = proxyquire(
        "../src/modules/employees/staff.service.js",
        {
            "../../config/prisma": prisma,
            "../payroll/payroll.service": {}
        }
    );

    const result = await service.updateStaff(3, {
        subject: "Музика"
    });

    assert.deepEqual(updatedData, {
        subject: "Музика"
    });
    assert.equal(result.subject, "Музика");
});