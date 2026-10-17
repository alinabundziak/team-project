const prisma = require("../../config/prisma");

const SALARIES = {
    ASSISTANT: 20000,
    TEACHER: 40000,
    MANAGER: 80000
};

function calculateEducatorSalary(childrenCount) {
    return 2000 * childrenCount +
        500 * Math.max(0, childrenCount - 12);
}

function calculateSalary(position, childrenCount = 0) {
    switch (position) {
        case "EDUCATOR":
            return calculateEducatorSalary(childrenCount);

        case "ASSISTANT":
            return SALARIES.ASSISTANT;

        case "TEACHER":
            return SALARIES.TEACHER;

        case "MANAGER":
            return SALARIES.MANAGER;

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
            employees_educator: {
                select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                    position: true
                }
            },
            employees_assistant: {
                select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                    position: true
                }
            }
        }
    });

    if (!group) {
        const error = new Error("Групу не знайдено");
        error.status = 404;
        throw error;
    }

    const childrenCount = group.children.length;

    const educatorSalary = group.employees_educator
        ? calculateSalary("EDUCATOR", childrenCount)
        : 0;

    const assistantSalary = group.employees_assistant
        ? calculateSalary("ASSISTANT")
        : 0;

    return {
        groupId: group.id,
        groupName: group.name,
        childrenCount,
        educator: group.employees_educator
            ? {
                id: group.employees_educator.id,
                fullName: `${group.employees_educator.first_name} ${group.employees_educator.last_name}`,
                monthlySalary: educatorSalary
            }
            : null,
        assistant: group.employees_assistant
            ? {
                id: group.employees_assistant.id,
                fullName: `${group.employees_assistant.first_name} ${group.employees_assistant.last_name}`,
                monthlySalary: assistantSalary
            }
            : null,
        totalMonthlySalary: educatorSalary + assistantSalary
    };
}

async function getKindergartenPayroll() {
    const [groups, employees] = await Promise.all([
        prisma.groups.findMany({
            include: {
                children: {
                    select: { id: true }
                },
                employees_educator: {
                    select: {
                        id: true,
                        position: true
                    }
                },
                employees_assistant: {
                    select: {
                        id: true,
                        position: true
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

    const employeeSalaries = new Map();

    for (const group of groups) {
        const childrenCount = group.children.length;

        if (group.employees_educator) {
            employeeSalaries.set(
                group.employees_educator.id,
                calculateSalary("EDUCATOR", childrenCount)
            );
        }

        if (group.employees_assistant) {
            employeeSalaries.set(
                group.employees_assistant.id,
                calculateSalary("ASSISTANT")
            );
        }
    }

    const staff = employees.map(employee => {
        let salary;

        if (employee.position === "EDUCATOR") {
            salary = employeeSalaries.has(employee.id)
                ? employeeSalaries.get(employee.id)
                : 0;
        } else {
            salary = calculateSalary(employee.position);
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
    getGroupPayroll,
    getKindergartenPayroll
};