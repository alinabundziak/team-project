const prisma = require("../src/config/prisma");
const staffService = require("../src/modules/employees/staff.service");

async function main() {
    let staffId = null;

    try {
        const suffix = `${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 7)}`;

        const created = await staffService.createStaff({
            firstName: "DEV2",
            lastName: `StaffSmoke_${suffix}`,
            position: "TEACHER",
            subject: "Музика",
            phone: "+380501234567",
            monthlySalary: 32000
        }, true);
        staffId = created.id;

        const found = await staffService.getStaffById(staffId, true);
        if (
            found.id !== staffId ||
            found.monthlySalary !== 32000 ||
            found.subject !== "Музика"
        ) {
            throw new Error("Не вдалося прочитати створеного працівника");
        }

        const updated = await staffService.updateStaff(staffId, {
            phone: "+380509876543",
            monthlySalary: 33000
        }, true);

        if (
            updated.phone !== "+380509876543" ||
            updated.monthlySalary !== 33000
        ) {
            throw new Error("Дані працівника не оновилися");
        }

        const listed = await staffService.getStaff(true);
        if (!listed.some(employee => employee.id === staffId)) {
            throw new Error("Створеного працівника немає у списку");
        }

        await staffService.deleteStaff(staffId);
        staffId = null;

        let returned404 = false;
        try {
            await staffService.getStaffById(created.id);
        } catch (error) {
            returned404 =
                error.code === "STAFF_NOT_FOUND" && error.status === 404;
            if (!returned404) throw error;
        }

        if (!returned404) {
            throw new Error("Після видалення працівника його все ще знайдено");
        }

        console.log("CRUD працівника пройшов; тестовий запис видалено.");
    } finally {
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

        await prisma.$disconnect();
    }
}

main().catch(error => {
    console.error("Перевірка не пройшла:", error);
    process.exitCode = 1;
});