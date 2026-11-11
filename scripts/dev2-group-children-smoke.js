const prisma = require("../src/config/prisma");
const roomsService = require("../src/modules/rooms/rooms.service");
const groupsService = require("../src/modules/groups/groups.service");

function birthDateForAge(age) {
    const today = new Date();

    return new Date(Date.UTC(
        today.getUTCFullYear() - age,
        today.getUTCMonth(),
        today.getUTCDate()
    ));
}

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
    const childIds = [];

    try {
        const suffix = `${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 7)}`;

        const room = await roomsService.createRoom({
            name: `DEV2_CHILD_ROOM_${suffix}`,
            capacity: 1,
            description: "Тимчасова перевірка призначення дітей"
        });
        roomId = room.id;

        const group = await groupsService.createGroup({
            name: `DEV2_CHILD_GROUP_${suffix}`,
            ageYears: 3,
            capacity: 1,
            roomId
        });
        groupId = group.id;

        async function createChild(label, age) {
            const child = await prisma.children.create({
                data: {
                    first_name: "DEV2",
                    last_name: `${label}_${suffix}`,
                    birth_date: birthDateForAge(age),
                    discount_id: null
                }
            });

            childIds.push(child.id);
            return child;
        }

        const firstChild = await createChild("AGE3_A", 3);
        const secondChild = await createChild("AGE3_B", 3);
        const wrongAgeChild = await createChild("AGE4", 4);

        const assignment = await groupsService.addChildToGroup(
            groupId,
            firstChild.id
        );

        if (assignment.groupId !== groupId) {
            throw new Error("Дитину не призначено до очікуваної групи");
        }

        const savedChild = await prisma.children.findUnique({
            where: { id: firstChild.id },
            select: { group_id: true }
        });

        if (savedChild.group_id !== groupId) {
            throw new Error("Призначення дитини не збереглося в БД");
        }

        await expectConflict(
            () => groupsService.addChildToGroup(groupId, firstChild.id),
            "CHILD_ALREADY_IN_GROUP"
        );

        await expectConflict(
            () => groupsService.addChildToGroup(groupId, secondChild.id),
            "GROUP_FULL"
        );

        await expectConflict(
            () => groupsService.addChildToGroup(groupId, wrongAgeChild.id),
            "CHILD_AGE_MISMATCH"
        );

        console.log(
            "Призначення дитини, повторне призначення, вік і місткість перевірені."
        );
    } finally {
        for (const childId of childIds) {
            try {
                await prisma.children.delete({ where: { id: childId } });
            } catch (error) {
                console.error(
                    `Не вдалося прибрати тестову дитину ${childId}:`,
                    error.message
                );
                process.exitCode = 1;
            }
        }

        if (groupId !== null) {
            try {
                await groupsService.deleteGroup(groupId);
            } catch (error) {
                console.error(
                    `Не вдалося прибрати тестову групу ${groupId}:`,
                    error.message
                );
                process.exitCode = 1;
            }
        }

        if (roomId !== null) {
            try {
                await roomsService.deleteRoom(roomId);
            } catch (error) {
                console.error(
                    `Не вдалося прибрати тестову кімнату ${roomId}:`,
                    error.message
                );
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