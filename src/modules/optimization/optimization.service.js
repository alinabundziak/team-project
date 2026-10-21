
const prisma = require("../../config/prisma");

function createOptimizationError(message, status = 500) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function calculateAge(birthDate) {
    const today = new Date();

    let age = today.getUTCFullYear() - birthDate.getUTCFullYear();

    const monthDifference =
        today.getUTCMonth() - birthDate.getUTCMonth();

    if (
        monthDifference < 0 ||
        (
            monthDifference === 0 &&
            today.getUTCDate() < birthDate.getUTCDate()
        )
    ) {
        age--;
    }

    return age;
}

async function getOptimizationRecommendations() {
    const [groups, employees] = await Promise.all([
        prisma.groups.findMany({
            include: {
                room: {
                    select: {
                        id: true,
                        name: true,
                        capacity: true
                    }
                },
                children: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        birth_date: true
                    }
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

    const recommendations = [];

    for (const sourceGroup of groups) {
        const sourceRoomCapacity =
            sourceGroup.room?.capacity ?? sourceGroup.capacity;
        const sourceEffectiveCapacity = Math.min(
            sourceGroup.capacity,
            sourceRoomCapacity
        );
        const excessChildren = sourceGroup.children.length - sourceEffectiveCapacity;

        if (excessChildren <= 0) {
            continue;
        }

        let remainingExcess = excessChildren;
        const selectedChildIds = new Set();

        for (const targetGroup of groups) {
            if (remainingExcess <= 0) {
                break;
            }

            if (targetGroup.id === sourceGroup.id) {
                continue;
            }

            if (targetGroup.target_age !== sourceGroup.target_age) {
                continue;
            }

            const targetRoomCapacity =
                targetGroup.room?.capacity ?? targetGroup.capacity;
            const targetEffectiveCapacity = Math.min(
                targetGroup.capacity,
                targetRoomCapacity
            );
            const freePlaces =
                targetEffectiveCapacity - targetGroup.children.length;

            if (freePlaces <= 0) {
                continue;
            }

            const eligibleChildren = sourceGroup.children.filter(child => {
                if (selectedChildIds.has(child.id) || !child.birth_date) {
                    return false;
                }

                const birthDate = new Date(child.birth_date);
                if (Number.isNaN(birthDate.getTime())) {
                    return false;
                }

                return calculateAge(birthDate) === targetGroup.target_age;
            });

            const childrenToMove = Math.min(
                remainingExcess,
                freePlaces,
                eligibleChildren.length
            );

            if (childrenToMove <= 0) {
                continue;
            }

            const suggestedChildren = eligibleChildren
                .slice(0, childrenToMove)
                .map(child => ({
                    id: child.id,
                    fullName: `${child.first_name} ${child.last_name}`.trim()
                }));

            for (const child of suggestedChildren) {
                selectedChildIds.add(child.id);
            }
            remainingExcess -= childrenToMove;

            recommendations.push({
                type: "CHILD_TRANSFER",
                priority: "HIGH",
                sourceGroup: {
                    id: sourceGroup.id,
                    name: sourceGroup.name
                },
                targetGroup: {
                    id: targetGroup.id,
                    name: targetGroup.name
                },
                suggestedChildren,
                suggestedChildIds: suggestedChildren.map(child => child.id),
                suggestedChildrenCount: childrenToMove,
                reason:
                    `Група "${sourceGroup.name}" перевищує ефективну місткість ` +
                    `на ${excessChildren} дітей. У групі "${targetGroup.name}" ` +
                    `є ${freePlaces} вільних місць; вікова категорія збігається, ` +
                    `а фактичний вік рекомендованих дітей відповідає цільовому віку.`,
                expectedResult:
                    `Можна перемістити ${childrenToMove} дітей, ` +
                    `не перевищуючи ефективну місткість цільової групи.`,
                applied: false
            });
        }
    }

    const assignedEmployeeIds = new Set();

    for (const group of groups) {
        if (group.educator_id != null) {
            assignedEmployeeIds.add(group.educator_id);
        }

        if (group.assistant_id != null) {
            assignedEmployeeIds.add(group.assistant_id);
        }

        for (const assignment of (group.staff_assignments || [])) {
            if (assignment.employee) {
                assignedEmployeeIds.add(assignment.employee.id);
            }
        }

        for (const schedule of (group.schedules || [])) {
            if (schedule.employees) {
                assignedEmployeeIds.add(schedule.employees.id);
            }
        }
    }

    const unassignedEmployees = employees.filter(
        employee => !assignedEmployeeIds.has(employee.id)
    );

    const groupStaff = new Map();

    for (const group of groups) {
        const staffById = new Map();

        if (group.employees_educator) {
            staffById.set(group.employees_educator.id, {
                ...group.employees_educator,
                assignmentSource: "EDUCATOR_SLOT"
            });
        }

        if (group.employees_assistant) {
            staffById.set(group.employees_assistant.id, {
                ...group.employees_assistant,
                assignmentSource: "ASSISTANT_SLOT"
            });
        }

        for (const assignment of (group.staff_assignments || [])) {
            const employee = assignment.employee;
            if (!employee) {
                continue;
            }

            const existing = staffById.get(employee.id);
            if (!existing) {
                staffById.set(employee.id, {
                    ...employee,
                    assignmentSource: "STAFF_ASSIGNMENT"
                });
            }
        }

        for (const schedule of (group.schedules || [])) {
            const employee = schedule.employees;
            if (employee && !staffById.has(employee.id)) {
                staffById.set(employee.id, {
                    ...employee,
                    assignmentSource: "SCHEDULE"
                });
            }
        }

        groupStaff.set(group.id, [...staffById.values()]);
    }

    const roleCount = (group, position) =>
        (groupStaff.get(group.id) || []).filter(
            employee => employee.position === position
        ).length;

    const missingRolesByGroup = new Map();
    for (const group of groups) {
        const missingRoles = [];
        if (roleCount(group, "EDUCATOR") === 0) {
            missingRoles.push("EDUCATOR");
        }
        if (roleCount(group, "ASSISTANT") === 0) {
            missingRoles.push("ASSISTANT");
        }
        missingRolesByGroup.set(group.id, missingRoles);
    }

    const reservedEmployeeIds = new Set();

    for (const group of groups) {
        for (const position of missingRolesByGroup.get(group.id)) {
            const availableEmployee = unassignedEmployees.find(
                employee =>
                    employee.position === position &&
                    !reservedEmployeeIds.has(employee.id)
            );

            if (!availableEmployee) {
                continue;
            }

            reservedEmployeeIds.add(availableEmployee.id);

            recommendations.push({
                type: "STAFF_ASSIGNMENT",
                priority: "HIGH",
                group: {
                    id: group.id,
                    name: group.name
                },
                employee: {
                    id: availableEmployee.id,
                    fullName:
                        `${availableEmployee.first_name} ` +
                        `${availableEmployee.last_name}`,
                    position: availableEmployee.position
                },
                reason:
                    `У групі "${group.name}" немає працівника на посаді ` +
                    `${position}. Запропоновано вільного працівника відповідної посади.`,
                expectedResult:
                    "Призначення може усунути нестачу персоналу після підтвердження доступності.",
                applied: false
            });
        }
    }

    for (const sourceGroup of groups) {
        const sourceStaff = groupStaff.get(sourceGroup.id) || [];

        for (const position of ["EDUCATOR", "ASSISTANT"]) {
            const surplusCandidates = roleCount(sourceGroup, position) > 1
                ? sourceStaff.filter(
                    employee =>
                        employee.position === position &&
                        employee.assignmentSource === "STAFF_ASSIGNMENT" &&
                        !reservedEmployeeIds.has(employee.id)
                )
                : [];

            for (const employee of surplusCandidates) {
                const targetGroup = groups.find(
                    group =>
                        group.id !== sourceGroup.id &&
                        missingRolesByGroup.get(group.id).includes(position) &&
                        !reservedEmployeeIds.has(employee.id)
                );

                if (!targetGroup) {
                    continue;
                }

                reservedEmployeeIds.add(employee.id);

                recommendations.push({
                    type: "STAFF_REDISTRIBUTION",
                    priority: "MEDIUM",
                    sourceGroup: {
                        id: sourceGroup.id,
                        name: sourceGroup.name
                    },
                    targetGroup: {
                        id: targetGroup.id,
                        name: targetGroup.name
                    },
                    employee: {
                        id: employee.id,
                        fullName:
                            `${employee.first_name} ${employee.last_name}`,
                        position: employee.position
                    },
                    reason:
                        `У групі "${sourceGroup.name}" є додатковий працівник ` +
                        `на посаді ${position}, а в групі "${targetGroup.name}" ` +
                        `бракує працівника цієї посади.`,
                    expectedResult:
                        "Перерозподіл може усунути нестачу без автоматичної зміни призначень.",
                    applied: false
                });
            }
        }
    }

    return {
        generatedAt: new Date().toISOString(),
        appliedAutomatically: false,
        recommendationsCount: recommendations.length,
        recommendations
    };
}

module.exports = {
    getOptimizationRecommendations
};
