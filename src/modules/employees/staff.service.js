const prisma = require("../../config/prisma");
const payrollService = require("../payroll/payroll.service");

function createStaffError(message, code, status) {
    const error = new Error(message);
    error.code = code;
    error.status = status;

    return error;
}

const staffSelect = {
    id: true,
    user_id: true,
    first_name: true,
    last_name: true,
    phone: true,
    position: true,
    subject: true,
    salary: true
};

function formatStaff(staff, includeSalary = false) {
    const result = {
        id: staff.id,
        userId: staff.user_id,
        firstName: staff.first_name,
        lastName: staff.last_name,
        phone: staff.phone,
        position: staff.position,
        subject: staff.subject
    };

    if (includeSalary) {
        result.monthlySalary = Number(staff.salary);
    }

    return result;
}

async function getStaff(includeSalary = false) {
    const staff = await prisma.employees.findMany({
        select: staffSelect,
        orderBy: {
            id: "asc"
        }
    });

    return staff.map(item => formatStaff(item, includeSalary));
}

async function getStaffById(id, includeSalary = false) {
    const staff = await prisma.employees.findUnique({
        where: {
            id
        },
        select: staffSelect
    });

    if (!staff) {
        throw createStaffError(
            "Працівника не знайдено",
            "STAFF_NOT_FOUND",
            404
        );
    }

    return formatStaff(staff, includeSalary);
}

async function createStaff(data, includeSalary = false) {
    const staffData = {
        first_name: data.firstName,
        last_name: data.lastName,
        position: data.position,
        phone: data.phone ?? null,
        subject: data.subject ?? null
    };

    if (data.userId !== undefined) {
        staffData.user_id = data.userId;
    }

    if (data.monthlySalary !== undefined) {
        staffData.salary = data.monthlySalary;
    }

    const staff = await prisma.employees.create({
        data: staffData,
        select: staffSelect
    });

    return formatStaff(staff, includeSalary);
}

async function updateStaff(id, data, includeSalary = false) {
    const existingStaff = await prisma.employees.findUnique({
        where: {
            id
        },
        select: {
            id: true
        }
    });

    if (!existingStaff) {
        throw createStaffError(
            "Працівника не знайдено",
            "STAFF_NOT_FOUND",
            404
        );
    }

    const updateData = {};

    if (data.monthlySalary !== undefined) {
        updateData.salary = data.monthlySalary;
    }

    if (data.firstName !== undefined) {
        updateData.first_name = data.firstName;
    }

    if (data.lastName !== undefined) {
        updateData.last_name = data.lastName;
    }

    if (data.phone !== undefined) {
        updateData.phone = data.phone;
    }

    if (data.position !== undefined) {
        updateData.position = data.position;
    }

    if (data.subject !== undefined) {
        updateData.subject = data.subject;
    }

    if (data.userId !== undefined) {
        updateData.user_id = data.userId;
    }

    const staff = await prisma.employees.update({
        where: {
            id
        },
        data: updateData,
        select: staffSelect
    });

    return formatStaff(staff, includeSalary);
}

async function deleteStaff(id) {
    const existingStaff = await prisma.employees.findUnique({
        where: {
            id
        },
        select: {
            id: true
        }
    });

    if (!existingStaff) {
        throw createStaffError(
            "Працівника не знайдено",
            "STAFF_NOT_FOUND",
            404
        );
    }

    const [
        groupsCount,
        schedulesCount,
        activitiesCount,
        assignmentsCount
    ] = await Promise.all([
        prisma.groups.count({
            where: {
                OR: [
                    { educator_id: id },
                    { assistant_id: id }
                ]
            }
        }),
        prisma.schedules.count({
            where: {
                teacher_id: id
            }
        }),
        prisma.teacher_activities.count({
            where: {
                employee_id: id
            }
        }),
        prisma.staff_assignments.count({
            where: {
                employee_id: id
            }
        })
    ]);

    if (
        groupsCount > 0 ||
        schedulesCount > 0 ||
        activitiesCount > 0 ||
        assignmentsCount > 0
    ) {
        throw createStaffError(
            "Не можна видалити працівника, який має пов'язані записи",
            "STAFF_IN_USE",
            409
        );
    }

    return prisma.employees.delete({
        where: {
            id
        }
    });
}

async function getSalaryEstimates() {
    const [groups, roomsCount, payroll] = await Promise.all([
        prisma.groups.findMany({
            select: {
                id: true,
                name: true,
                room: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                children: {
                    select: { id: true }
                },
                employees_educator: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true
                    }
                },
                employees_assistant: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true
                    }
                }
            },
            orderBy: { id: "asc" }
        }),
        prisma.rooms.count(),
        payrollService.getKindergartenPayroll()
    ]);

    const groupEstimates = groups.map(group => {
        const childrenCount = group.children.length;

        const educatorSalary = group.employees_educator
            ? payrollService.calculateSalary("EDUCATOR", childrenCount)
            : 0;

        const assistantSalary = group.employees_assistant
            ? payrollService.calculateSalary("ASSISTANT")
            : 0;

        return {
            groupId: group.id,
            groupName: group.name,
            room: group.room,
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
            monthlyPersonnelExpenses: educatorSalary + assistantSalary
        };
    });

    const monthlyRent = roomsCount * 50000;

    return {
        currency: "UAH",
        groups: groupEstimates,
        totalMonthlyPersonnelExpenses: payroll.totalMonthlySalary,
        rent: {
            roomCount: roomsCount,
            monthlyCostPerRoom: 50000,
            totalMonthlyRent: monthlyRent
        },
        totalMonthlyExpenses: payroll.totalMonthlySalary + monthlyRent
    };
}

async function getStaffDistributionAnalysis(options = {}) {
    const { groupId, childrenCount } = options;
    const [groups, employees] = await Promise.all([
        prisma.groups.findMany({
            select: {
                id: true,
                name: true,
                target_age: true,
                capacity: true,
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
                },
                staff_assignments: {
                    select: {
                        employee: {
                            select: {
                                id: true,
                                first_name: true,
                                last_name: true,
                                position: true
                            }
                        }
                    }
                },
                schedules: {
                    select: {
                        employees: {
                            select: {
                                id: true,
                                first_name: true,
                                last_name: true,
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

    const assignedGroupsByEmployee = new Map();

    const groupAnalysis = groups.map(group => {
        const groupStaff = new Map();

        function addStaff(employee, assignmentType) {
            if (!employee) {
                return;
            }

            if (!groupStaff.has(employee.id)) {
                groupStaff.set(employee.id, {
                    id: employee.id,
                    fullName:
                        `${employee.first_name} ${employee.last_name}`,
                    position: employee.position,
                    assignmentTypes: []
                });
            }

            const staffMember = groupStaff.get(employee.id);

            if (!staffMember.assignmentTypes.includes(assignmentType)) {
                staffMember.assignmentTypes.push(assignmentType);
            }
        }

        addStaff(group.employees_educator, "EDUCATOR_SLOT");
        addStaff(group.employees_assistant, "ASSISTANT_SLOT");

        for (const assignment of group.staff_assignments) {
            addStaff(assignment.employee, "STAFF_ASSIGNMENT");
        }

        for (const schedule of group.schedules) {
            addStaff(schedule.employees, "SCHEDULE");
        }

        const assignedStaff = [...groupStaff.values()];

        for (const employee of assignedStaff) {
            if (!assignedGroupsByEmployee.has(employee.id)) {
                assignedGroupsByEmployee.set(employee.id, new Set());
            }

            assignedGroupsByEmployee.get(employee.id).add(group.id);
        }

        const educatorsCount = assignedStaff.filter(
            employee => employee.position === "EDUCATOR"
        ).length;

        const assistantsCount = assignedStaff.filter(
            employee => employee.position === "ASSISTANT"
        ).length;

        function getRoleStatus(actual) {
            if (actual < 1) {
                return "SHORTAGE";
            }

            if (actual > 1) {
                return "SURPLUS";
            }

            return "OK";
        }

        return {
            groupId: group.id,
            groupName: group.name,
            ageYears: group.target_age,
            childrenCount: group.children.length,
            capacity: group.capacity,

            staffing: {
                educators: {
                    required: 1,
                    actual: educatorsCount,
                    status: getRoleStatus(educatorsCount)
                },
                assistants: {
                    required: 1,
                    actual: assistantsCount,
                    status: getRoleStatus(assistantsCount)
                }
            },

            assignedStaff,

            hasShortage: educatorsCount < 1 || assistantsCount < 1,
            hasSurplus: educatorsCount > 1 || assistantsCount > 1
        };
    });

    const unassignedEmployees = employees
        .filter(employee => !assignedGroupsByEmployee.has(employee.id))
        .map(employee => ({
            id: employee.id,
            fullName: `${employee.first_name} ${employee.last_name}`,
            position: employee.position
        }));

        let scenario = null;

    if (groupId !== undefined) {
        const group = groupAnalysis.find(item => item.groupId === groupId);

        if (!group) {
            throw createStaffError(
                "Групу не знайдено",
                "GROUP_NOT_FOUND",
                404
            );
        }

        const capacityLimit = Math.min(group.capacity, 20);

        function getCapacityStatus(count) {
            return count > capacityLimit
                ? "OVER_CAPACITY"
                : "WITHIN_CAPACITY";
        }

        scenario = {
            groupId: group.groupId,
            groupName: group.groupName,

            current: {
                childrenCount: group.childrenCount,
                capacityLimit,
                capacityStatus: getCapacityStatus(group.childrenCount)
            },

            simulated: {
                childrenCount,
                childrenDifference: childrenCount - group.childrenCount,
                capacityLimit,
                capacityStatus: getCapacityStatus(childrenCount)
            },

            staffingNeed: {
                educators: {
                    currentRequired: 1,
                    simulatedRequired: 1,
                    change: 0
                },
                assistants: {
                    currentRequired: 1,
                    simulatedRequired: 1,
                    change: 0
                },
                otherStaffRuleDefined: false
            },

            staffingNeedChanged: false
        };
    }

    const result = {
        summary: {
            groupsCount: groupAnalysis.length,
            groupsWithShortage: groupAnalysis.filter(
                group => group.hasShortage
            ).length,
            groupsWithSurplus: groupAnalysis.filter(
                group => group.hasSurplus
            ).length,
            employeesCount: employees.length,
            unassignedEmployeesCount: unassignedEmployees.length
        },
        groups: groupAnalysis,
        unassignedEmployees
    };

    if (scenario) {
        result.scenario = scenario;
    }

    return result;
}

module.exports = {
    getStaff,
    getStaffById,
    createStaff,
    updateStaff,
    deleteStaff,
    getSalaryEstimates,
    getStaffDistributionAnalysis
};