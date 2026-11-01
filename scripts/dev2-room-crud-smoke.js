const prisma = require("../src/config/prisma");
const roomsService = require("../src/modules/rooms/rooms.service");

async function main() {
    let roomId = null;

    try {
        const suffix = `${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 7)}`;

        const created = await roomsService.createRoom({
            name: `DEV2_ROOM_SMOKE_${suffix}`,
            capacity: 4,
            description: "Тимчасова перевірка CRUD"
        });
        roomId = created.id;

        const found = await roomsService.getRoomById(roomId);
        if (found.name !== created.name) {
            throw new Error("Не вдалося прочитати створену кімнату");
        }

        const listed = await roomsService.getRooms();
        if (!listed.some(room => room.id === roomId)) {
            throw new Error("Створеної кімнати немає у списку");
        }

        const updated = await roomsService.updateRoom(roomId, {
            capacity: 3,
            description: "Оновлена тимчасова перевірка CRUD"
        });

        if (updated.capacity !== 3) {
            throw new Error("Місткість кімнати не оновилась");
        }

        await roomsService.deleteRoom(roomId);
        roomId = null;

        let returned404 = false;
        try {
            await roomsService.getRoomById(created.id);
        } catch (error) {
            returned404 =
                error.code === "ROOM_NOT_FOUND" && error.status === 404;
            if (!returned404) throw error;
        }

        if (!returned404) {
            throw new Error("Після видалення кімнату все ще знайдено");
        }

        console.log("CRUD кімнати пройшов; тестову кімнату видалено.");
    } finally {
        if (roomId !== null) {
            await roomsService.deleteRoom(roomId);
        }
        await prisma.$disconnect();
    }
}

main().catch(error => {
    console.error("Перевірка не пройшла:", error);
    process.exitCode = 1;
});