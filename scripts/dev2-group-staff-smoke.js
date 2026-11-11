const prisma = require("../src/config/prisma");
const roomsService = require("../src/modules/rooms/rooms.service");
const groupsService = require("../src/modules/groups/groups.service");
const staffService = require("../src/modules/employees/staff.service");

async function expectConflict(operation, expectedCode) {
    let caughtError;

    try {
        await operation();
    } catch (error) {
        caughtError = error;
    }

    if (
        !caughtError ||
        caughtError.code !== expectedCode ||
        caughtError.status !== 409
    ) {
        throw new Error(
            `Очікувалася помилка ${expectedCode} зі статусом 409; ` +
            `отримано: ${caughtError?.code ?? "помилки немає"}`
        );
    }
}

async function main() {
    let roomId = null;
    let groupId = null;
    let staffId = null;
    let assignmentCreated = false;

    try {
        const suffix = `${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 7)}`;

        const room = await roomsService.createRoom({
            name: `DEV2_STAFF_ROOM_${suffix}`,
            capacity: 4,
            description: "Тимчасова перевірка Group–Staff"
        });
        roomId = room.id;

        const group = await groupsService.createGroup({
            name: `DEV2_STAFF_GROUP_${suffix}`,
            ageYears: 3,
            capacity: 4,
            roomId
        });
        groupId = group.id;

        const staff = await staffService.createStaff({
            firstName: "DEV2",
            lastName: `Smoke_${suffix}`,
            position: "EDUCATOR"
        });
        staffId = staff.id;

        const assignment = await groupsService.assignStaffToGroup(
            groupId,
            staffId
        );
        assignmentCreated = true;

        const savedAssignment =
            await prisma.staff_assignments.findUnique({
                where: {
                    employee_id_group_id: {
                        employee_id: staffId,
                        group_id: groupId
                    }
                }
            });

        if (
            assignment.role !== "EDUCATOR" ||
            savedAssignment?.role !== "EDUCATOR"
        ) {
            throw new Error("Роль працівника не збереглася в призначенні");
        }

        await expectConflict(
            () => groupsService.assignStaffToGroup(groupId, staffId),
            "STAFF_ALREADY_ASSIGNED"
        );

        await expectConflict(
            () => groupsService.deleteGroup(groupId),
            "GROUP_IN_USE"
        );

        await expectConflict(
            () => roomsService.deleteRoom(roomId),
            "ROOM_IN_USE"
        );

        await groupsService.removeStaffFromGroup(groupId, staffId);
        assignmentCreated = false;

        const removedAssignment =
            await prisma.staff_assignments.findUnique({
                where: {
                    employee_id_group_id: {
                        employee_id: staffId,
                        group_id: groupId
                    }
                }
            });

        if (removedAssignment) {
            throw new Error("Призначення працівника не видалилося");
        }

        await staffService.deleteStaff(staffId);
        staffId = null;

        await groupsService.deleteGroup(groupId);
        groupId = null;

        await roomsService.deleteRoom(roomId);
        roomId = null;

        console.log(
            "Призначення персоналу, дублікати й захист пов’язаних записів перевірені; тестові записи видалено."
        );
    } finally {
        if (assignmentCreated && groupId !== null && staffId !== null) {
            try {
                await groupsService.removeStaffFromGroup(groupId, staffId);
            } catch (error) {
                console.error("Не вдалося прибрати тестове призначення:", error.message);
                process.exitCode = 1;
            }
        }

        if (staffId !== null) {
            try {
                await staffService.deleteStaff(staffId);
            } catch (error) {
                console.error(`Не вдалося прибрати тестового працівника ${staffId}:`, error.message);
                process.exitCode = 1;
            }
        }

        if (groupId !== null) {
            try {
                await groupsService.deleteGroup(groupId);
            } catch (error) {
                console.error(`Не вдалося прибрати тестову групу ${groupId}:`, error.message);
                process.exitCode = 1;
            }
        }

        if (roomId !== null) {
            try {
                await roomsService.deleteRoom(roomId);
            } catch (error) {
                console.error(`Не вдалося прибрати тестову кімнату ${roomId}:`, error.message);
                process.exitCode = 1;
            }
        }

        await prisma.$disconnect();
    }
}

main().catch(error => {
    console.error("Перевірка не пройшла:", error);
    process.exitCode = 1;
});