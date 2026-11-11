const prisma = require("../src/config/prisma");
const roomsService = require("../src/modules/rooms/rooms.service");
const groupsService = require("../src/modules/groups/groups.service");

async function main() {
    let roomId = null;
    let groupId = null;

    try {
        const suffix = `${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 7)}`;

        const room = await roomsService.createRoom({
            name: `DEV2_GROUP_ROOM_${suffix}`,
            capacity: 4,
            description: "Тимчасова перевірка групи"
        });
        roomId = room.id;

        const created = await groupsService.createGroup({
            name: `DEV2_GROUP_${suffix}`,
            ageYears: 3,
            capacity: 4,
            roomId
        });
        groupId = created.id;

        const found = await groupsService.getGroupById(groupId);
        if (found.name !== created.name || found.roomId !== roomId) {
            throw new Error("Не вдалося прочитати групу або її кімнату");
        }

        const listed = await groupsService.getGroups();
        if (!listed.some(group => group.id === groupId)) {
            throw new Error("Створеної групи немає у списку");
        }

        const updated = await groupsService.updateGroup(groupId, {
            name: `DEV2_GROUP_UPDATED_${suffix}`,
            capacity: 3
        });
        if (updated.capacity !== 3) {
            throw new Error("Місткість групи не оновилась");
        }

        await groupsService.deleteGroup(groupId);
        groupId = null;

        let groupNotFound = false;
        try {
            await groupsService.getGroupById(created.id);
        } catch (error) {
            groupNotFound =
                error.code === "GROUP_NOT_FOUND" && error.status === 404;
            if (!groupNotFound) throw error;
        }

        if (!groupNotFound) {
            throw new Error("Після видалення групу все ще знайдено");
        }

        await roomsService.deleteRoom(roomId);
        roomId = null;

        console.log("CRUD групи й зв’язок із кімнатою пройшли; тестові записи видалено.");
    } finally {
        if (groupId !== null) {
            try {
                await groupsService.deleteGroup(groupId);
                groupId = null;
            } catch (error) {
                console.error("Не вдалося прибрати тестову групу:", groupId, error.message);
            }
        }

        if (roomId !== null && groupId === null) {
            try {
                await roomsService.deleteRoom(roomId);
                roomId = null;
            } catch (error) {
                console.error("Не вдалося прибрати тестову кімнату:", roomId, error.message);
            }
        }

        await prisma.$disconnect();
    }
}

main().catch(error => {
    console.error("Перевірка не пройшла:", error);
    process.exitCode = 1;
});