const prisma = require("../src/config/prisma");
const roomsService = require("../src/modules/rooms/rooms.service");
const groupsService = require("../src/modules/groups/groups.service");
const staffService = require("../src/modules/employees/staff.service");
const payrollService = require("../src/modules/payroll/payroll.service");
const expenseSettingsService =
    require("../src/modules/payroll/expenseSettings.service");

async function main() {
    let roomId = null;
    let groupId = null;
    let educatorId = null;
    let assistantId = null;
    const assignedStaffIds = [];

    try {
        const suffix = `${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 7)}`;

        const room = await roomsService.createRoom({
            name: `DEV2_PAYROLL_ROOM_${suffix}`,
            capacity: 4,
            description: "Тимчасова перевірка зарплат"
        });
        roomId = room.id;

        const group = await groupsService.createGroup({
            name: `DEV2_PAYROLL_GROUP_${suffix}`,
            ageYears: 3,
            capacity: 4,
            roomId
        });
        groupId = group.id;

        const educator = await staffService.createStaff({
            firstName: "DEV2",
            lastName: `Educator_${suffix}`,
            position: "EDUCATOR"
        });
        educatorId = educator.id;

        const assistant = await staffService.createStaff({
            firstName: "DEV2",
            lastName: `Assistant_${suffix}`,
            position: "ASSISTANT"
        });
        assistantId = assistant.id;

        await groupsService.assignStaffToGroup(groupId, educatorId);
        assignedStaffIds.push(educatorId);

        await groupsService.assignStaffToGroup(groupId, assistantId);
        assignedStaffIds.push(assistantId);

        const settings = await expenseSettingsService.getExpenseSettings();
        const expectedEducatorSalary =
            payrollService.calculateSalary("EDUCATOR", 0, settings);
        const expectedAssistantSalary =
            payrollService.calculateSalary("ASSISTANT", 0, settings);

        const payroll = await payrollService.getGroupPayroll(groupId);

        if (
            payroll.educator?.id !== educatorId ||
            payroll.assistant?.id !== assistantId ||
            payroll.educator.monthlySalary !== expectedEducatorSalary ||
            payroll.assistant.monthlySalary !== expectedAssistantSalary
        ) {
            throw new Error("Розрахунок зарплати групи не збігається з налаштуваннями");
        }

        const estimates = await staffService.getSalaryEstimates();
        const groupEstimate = estimates.groups.find(
            item => item.groupId === groupId
        );

        if (
            !groupEstimate ||
            groupEstimate.educator.id !== educatorId ||
            groupEstimate.assistant.id !== assistantId ||
            groupEstimate.educator.monthlySalary !== expectedEducatorSalary ||
            groupEstimate.assistant.monthlySalary !== expectedAssistantSalary
        ) {
            throw new Error("Кошторис персоналу не врахував призначення групи");
        }

        console.log(
            "Призначення вихователя й помічника та розрахунок зарплат перевірені."
        );
    } finally {
        for (const staffId of assignedStaffIds.reverse()) {
            try {
                await groupsService.removeStaffFromGroup(groupId, staffId);
            } catch (error) {
                console.error(
                    `Не вдалося прибрати призначення працівника ${staffId}:`,
                    error.message
                );
                process.exitCode = 1;
            }
        }

        for (const staffId of [assistantId, educatorId]) {
            if (staffId !== null) {
                try {
                    await staffService.deleteStaff(staffId);
                } catch (error) {
                    console.error(
                        `Не вдалося прибрати тестового працівника ${staffId}:`,
                        error.message
                    );
                    process.exitCode = 1;
                }
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