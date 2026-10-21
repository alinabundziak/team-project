const prisma = require("../../config/prisma");

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

module.exports = {
    getStaff,
    getStaffById,
    createStaff,
    updateStaff,
    deleteStaff
};