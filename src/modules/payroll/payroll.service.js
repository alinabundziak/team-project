const prisma = require("../../config/prisma");
const expenseSettingsService = require("./expenseSettings.service");

const DEFAULT_EXPENSE_SETTINGS = {
    extraChildrenThreshold: 12,
    educatorBasePerChild: 2000,
    educatorExtraPerChild: 5000,
    assistantBaseMonthlySalary: 20000,
    assistantExtraPerChild: 3000,
    teacherMonthlySalary: 40000,
    managerMonthlySalary: 80000,
    rentPerGroup: 50000
};

function calculateEducatorSalary(
    childrenCount,
    settings = DEFAULT_EXPENSE_SETTINGS
) {
    return settings.educatorBasePerChild * childrenCount +
        settings.educatorExtraPerChild *
            Math.max(0, childrenCount - settings.extraChildrenThreshold);
}

function calculateAssistantSalary(
    childrenCount = 0,
    settings = DEFAULT_EXPENSE_SETTINGS
) {
    return settings.assistantBaseMonthlySalary +
        settings.assistantExtraPerChild *
            Math.max(0, childrenCount - settings.extraChildrenThreshold);
}

function calculateSalary(
    position,
    childrenCount = 0,
    settings = DEFAULT_EXPENSE_SETTINGS
) {
    switch (position) {
        case "EDUCATOR":
            return calculateEducatorSalary(childrenCount, settings);
        case "ASSISTANT":
            return calculateAssistantSalary(childrenCount, settings);
        case "TEACHER":
            return settings.teacherMonthlySalary;
        case "MANAGER":
            return settings.managerMonthlySalary;
        default:
            throw new Error(`Невідома посада: ${position}`);
    }
}

async function getGroupPayroll(groupId) {
    const group = await prisma.groups.findUnique({
        where: { id: groupId },
        include: {
            children: {
                select: { id: true }
            },
            staff_assignments: {
                where: {
                    role: {
                        in: ["EDUCATOR", "ASSISTANT"]
                    }
                },
                select: {
                    role: true,
                    employee: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true
                        }
                    }
                }
            }
        }
    });

    if (!group) {
        const error = new Error("Групу не знайдено");
        error.status = 404;
        throw error;
    }

    const settings = await expenseSettingsService.getExpenseSettings();
    const childrenCount = group.children.length;
    const assignments = group.staff_assignments || [];

    const educator =
        assignments.find(item => item.role === "EDUCATOR")?.employee ?? null;
    const assistant =
        assignments.find(item => item.role === "ASSISTANT")?.employee ?? null;

    const educatorSalary = educator
        ? calculateSalary("EDUCATOR", childrenCount, settings)
        : 0;

    const assistantSalary = assistant
        ? calculateSalary("ASSISTANT", childrenCount, settings)
        : 0;

    return {
        groupId: group.id,
        groupName: group.name,
        childrenCount,
        educator: educator
            ? {
                id: educator.id,
                fullName: `${educator.first_name} ${educator.last_name}`,
                monthlySalary: educatorSalary
            }
            : null,
        assistant: assistant
            ? {
                id: assistant.id,
                fullName: `${assistant.first_name} ${assistant.last_name}`,
                monthlySalary: assistantSalary
            }
            : null,
        totalMonthlySalary: educatorSalary + assistantSalary
    };
}

function calculateKindergartenSalaryEstimate(groups, teachersCount, settings = DEFAULT_EXPENSE_SETTINGS) {
    const groupEstimates = groups.map(group => {
        const childrenCount = group.children.length;
        const educatorMonthlySalary = calculateEducatorSalary(childrenCount, settings);
        const assistantMonthlySalary = calculateAssistantSalary(childrenCount, settings);

        return {
            groupId: group.id,
            groupName: group.name,
            childrenCount,
            educatorMonthlySalary,
            assistantMonthlySalary,
            totalMonthlySalary:
                educatorMonthlySalary + assistantMonthlySalary
        };
    });

    const groupsMonthlySalary = groupEstimates.reduce(
        (total, group) => total + group.totalMonthlySalary,
        0
    );
    const teachersMonthlySalary = teachersCount * settings.teacherMonthlySalary;
    const managerMonthlySalary = settings.managerMonthlySalary;

    return {
        groups: groupEstimates,
        groupsMonthlySalary,
        teachersCount,
        teachersMonthlySalary,
        managerCount: 1,
        managerMonthlySalary,
        monthlySalaryPerTeacher: settings.teacherMonthlySalary,
        rentPerGroup: settings.rentPerGroup,
        totalMonthlySalary:
            groupsMonthlySalary +
            teachersMonthlySalary +
            managerMonthlySalary
    };
}

async function getKindergartenSalaryEstimate(groups) {
    const groupsForEstimate = groups ?? await prisma.groups.findMany({
        select: {
            id: true,
            name: true,
            children: { select: { id: true } }
        },
        orderBy: { id: "asc" }
    });

    const teachersCount = await prisma.employees.count({
        where: { position: "TEACHER" }
    });

    const settings = await expenseSettingsService.getExpenseSettings();

    return calculateKindergartenSalaryEstimate(
        groupsForEstimate,
        teachersCount,
        settings
    );
}

async function getKindergartenPayroll() {
    const [groups, employees] = await Promise.all([
        prisma.groups.findMany({
            include: {
                children: {
                    select: { id: true }
                },
                staff_assignments: {
                    select: {
                        employee_id: true,
                        role: true,
                        employee: {
                            select: {
                                position: true
                            }
                        }
                    }
                }
            },
            orderBy: { id: "asc" }
        }),
        prisma.employees.findMany({
            select: {
                id: true,
                first_name: true,
                last_name: true,
                position: true
            },
            orderBy: { id: "asc" }
        })
    ]);

    const settings = await expenseSettingsService.getExpenseSettings();
    const employeeSalaries = new Map();

    for (const group of groups) {
        const childrenCount = group.children.length;

        for (const assignment of group.staff_assignments || []) {
            const role = assignment.role ?? assignment.employee?.position;

            if (role === "EDUCATOR" || role === "ASSISTANT") {
                employeeSalaries.set(
                    assignment.employee_id,
                    calculateSalary(role, childrenCount, settings)
                );
            }
        }
    }

    const staff = employees.map(employee => {
        let salary;

        if (employee.position === "EDUCATOR") {
            salary = employeeSalaries.has(employee.id)
                ? employeeSalaries.get(employee.id)
                : 0;
        } else if (employee.position === "ASSISTANT") {
            salary = employeeSalaries.has(employee.id)
                ? employeeSalaries.get(employee.id)
                : calculateSalary("ASSISTANT", 0, settings);
        } else {
            salary = calculateSalary(employee.position, 0, settings);
        }

        return {
            id: employee.id,
            fullName: `${employee.first_name} ${employee.last_name}`,
            position: employee.position,
            monthlySalary: salary
        };
    });

    return {
        employees: staff,
        totalMonthlySalary: staff.reduce(
            (total, employee) => total + employee.monthlySalary,
            0
        )
    };
}

module.exports = {
    calculateEducatorSalary,
    calculateSalary,
    calculateKindergartenSalaryEstimate,
    getKindergartenSalaryEstimate,
    getGroupPayroll,
    getKindergartenPayroll
};