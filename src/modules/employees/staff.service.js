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
        result.monthlySalary =
            staff.salary == null ? null : Number(staff.salary);
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
        where: { id },
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
        where: { id },
        select: { id: true, position: true}
    });

    if (!existingStaff) {
        throw createStaffError(
            "Працівника не знайдено",
            "STAFF_NOT_FOUND",
            404
        );
    }

    if (
        data.position !== undefined &&
        data.position !== existingStaff.position
    ) {
        const [
            schedulesCount,
            activitiesCount,
            assignmentsCount
        ] = await Promise.all([
            prisma.schedules.count({
                where: { teacher_id: id }
            }),
            prisma.teacher_activities.count({
                where: { employee_id: id }
            }),
            prisma.staff_assignments.count({
                where: { employee_id: id }
            })
        ]);

        if (
            schedulesCount > 0 ||
            activitiesCount > 0 ||
            assignmentsCount > 0
        ) {
            throw createStaffError(
                "Не можна змінити посаду працівника, поки він має пов'язані призначення",
                "STAFF_POSITION_IN_USE",
                409
            );
        }
    }

        if (
            data.subject !== undefined &&
            existingStaff.position === "TEACHER"
        ) {
            const activityAssignments =
                await prisma.teacher_activities.findMany({
                    where: { employee_id: id },
                    select: {
                        activities: {
                            select: { name: true }
                        }
                    }
                });

            const newSubject =
                typeof data.subject === "string"
                    ? data.subject.trim().toLocaleLowerCase("uk-UA")
                    : "";

            const hasMismatchedActivity = activityAssignments.some(
                ({ activities }) =>
                    !newSubject ||
                    newSubject !==
                        activities.name.trim().toLocaleLowerCase("uk-UA")
            );

            if (hasMismatchedActivity) {
                throw createStaffError(
                    "Не можна змінити предмет викладача, поки він призначений до іншої дисципліни",
                    "STAFF_SUBJECT_IN_USE",
                    409
                );
            }
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
        where: { id },
        data: updateData,
        select: staffSelect
    });

    return formatStaff(staff, includeSalary);
}

async function deleteStaff(id) {
    const existingStaff = await prisma.employees.findUnique({
        where: { id },
        select: { id: true }
    });

    if (!existingStaff) {
        throw createStaffError(
            "Працівника не знайдено",
            "STAFF_NOT_FOUND",
            404
        );
    }

    const [
        schedulesCount,
        activitiesCount,
        assignmentsCount
    ] = await Promise.all([
        prisma.schedules.count({
            where: { teacher_id: id }
        }),
        prisma.teacher_activities.count({
            where: { employee_id: id }
        }),
        prisma.staff_assignments.count({
            where: { employee_id: id }
        })
    ]);

    if (
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
        where: { id }
    });
}

async function getSalaryEstimates() {
    const groups = await prisma.groups.findMany({
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
        },
        orderBy: { id: "asc" }
    });

    const payrollEstimate =
        await payrollService.getKindergartenSalaryEstimate(groups);

    const estimatedGroupsById = new Map(
        payrollEstimate.groups.map(group => [group.groupId, group])
    );

    const groupEstimates = groups.map(group => {
        const estimate = estimatedGroupsById.get(group.id);
        const assignments = group.staff_assignments || [];
        const educator =
            assignments.find(item => item.role === "EDUCATOR")?.employee ?? null;
        const assistant =
            assignments.find(item => item.role === "ASSISTANT")?.employee ?? null;

        return {
            groupId: group.id,
            groupName: group.name,
            room: group.room,
            childrenCount: group.children.length,
            educator: {
                id: educator?.id ?? null,
                fullName: educator
                    ? `${educator.first_name} ${educator.last_name}`
                    : null,
                monthlySalary: estimate.educatorMonthlySalary
            },
            assistant: {
                id: assistant?.id ?? null,
                fullName: assistant
                    ? `${assistant.first_name} ${assistant.last_name}`
                    : null,
                monthlySalary: estimate.assistantMonthlySalary
            },
            monthlyPersonnelExpenses: estimate.totalMonthlySalary
        };
    });

    const monthlyRent = groups.length * (payrollEstimate.rentPerGroup ?? 50000);

    return {
        currency: "UAH",
        groups: groupEstimates,
        staffCosts: {
            teachersCount: payrollEstimate.teachersCount,
            monthlySalaryPerTeacher:
                payrollEstimate.monthlySalaryPerTeacher ?? 40000,
            teachersMonthlySalary: payrollEstimate.teachersMonthlySalary,
            managerCount: 1,
            managerMonthlySalary: payrollEstimate.managerMonthlySalary
        },
        totalMonthlyPersonnelExpenses: payrollEstimate.totalMonthlySalary,
        rent: {
            roomCount: groups.length,
            monthlyCostPerRoom: payrollEstimate.rentPerGroup ?? 50000,
            totalMonthlyRent: monthlyRent
        },
        totalMonthlyExpenses:
            payrollEstimate.totalMonthlySalary + monthlyRent
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

                room: {
                    select: {
                        capacity: true
                    }
                },

                children: {
                    select: { id: true }
                },

                staff_assignments: {
                    select: {
                        role: true,
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

        function addStaff(employee, assignmentType, role) {
            if (!employee) {
                return;
            }

            if (!groupStaff.has(employee.id)) {
                groupStaff.set(employee.id, {
                    id: employee.id,
                    fullName: `${employee.first_name} ${employee.last_name}`,
                    position: employee.position,
                    role: role ?? employee.position,
                    assignmentTypes: []
                });
            }

            const staffMember = groupStaff.get(employee.id);

            if (!staffMember.assignmentTypes.includes(assignmentType)) {
                staffMember.assignmentTypes.push(assignmentType);
            }
        }

        for (const assignment of group.staff_assignments || []) {
            const role = assignment.role ?? assignment.employee?.position;
            const assignmentType =
                role === "EDUCATOR"
                    ? "EDUCATOR_SLOT"
                    : role === "ASSISTANT"
                        ? "ASSISTANT_SLOT"
                        : "STAFF_ASSIGNMENT";

            addStaff(assignment.employee, assignmentType, role);
        }

        for (const schedule of group.schedules || []) {
            addStaff(schedule.employees, "SCHEDULE");
        }

        const assignedStaff = [...groupStaff.values()];

        for (const employee of assignedStaff) {
            if (!assignedGroupsByEmployee.has(employee.id)) {
                assignedGroupsByEmployee.set(
                    employee.id,
                    new Set()
                );
            }

            assignedGroupsByEmployee
                .get(employee.id)
                .add(group.id);
        }

        const educatorsCount = assignedStaff.filter(
            employee => employee.role === "EDUCATOR"
        ).length;

        const assistantsCount = assignedStaff.filter(
            employee => employee.role === "ASSISTANT"
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

            roomCapacity: group.room
                ? group.room.capacity
                : group.capacity,

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

            hasShortage:
                educatorsCount < 1 || assistantsCount < 1,

            hasSurplus:
                educatorsCount > 1 || assistantsCount > 1
        };
    });

    const unassignedEmployees = employees
        .filter(
            employee =>
                !assignedGroupsByEmployee.has(employee.id)
        )
        .map(employee => ({
            id: employee.id,

            fullName:
                `${employee.first_name} ${employee.last_name}`,

            position: employee.position
        }));

    let scenario = null;

    if (groupId !== undefined) {
        const group = groupAnalysis.find(
            item => item.groupId === groupId
        );

        if (!group) {
            throw createStaffError(
                "Групу не знайдено",
                "GROUP_NOT_FOUND",
                404
            );
        }

        if (
            !Number.isInteger(childrenCount) ||
            childrenCount < 0
        ) {
            throw createStaffError(
                "Кількість дітей має бути невід’ємним цілим числом",
                "INVALID_CHILDREN_COUNT",
                400
            );
        }

        const capacityLimit = Math.min(
            group.capacity,
            group.roomCapacity
        );

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

                capacityStatus: getCapacityStatus(
                    group.childrenCount
                )
            },

            simulated: {
                childrenCount,

                childrenDifference:
                    childrenCount - group.childrenCount,

                capacityLimit,

                capacityStatus: getCapacityStatus(
                    childrenCount
                )
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

            unassignedEmployeesCount:
                unassignedEmployees.length
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