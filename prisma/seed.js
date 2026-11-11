require("dotenv").config();

const ROLES = ["ADMIN", "MANAGER", "TEACHER", "PARENT"];

const DISCOUNTS = [
    {
        code: "NO_DISCOUNT",
        description: "Без знижки",
        percentage: 0
    },
    {
        code: "DISCOUNT_10",
        description: "Знижка 10%",
        percentage: 10
    },
    {
        code: "DISCOUNT_20",
        description: "Знижка 20%",
        percentage: 20
    },
    {
        code: "DISCOUNT_30",
        description: "Знижка 30%",
        percentage: 30
    }
];

async function main() {
    const testDatabaseUrl = process.env.TEST_DATABASE_URL;

    if (!testDatabaseUrl || process.env.SEED_TEST_DATABASE !== "YES") {
        throw new Error(
            "Seed зупинено. Потрібні окрема TEST_DATABASE_URL " +
            "і SEED_TEST_DATABASE=YES."
        );
    }

    // Prisma підключиться тільки до явно заданої тестової БД.
    process.env.DATABASE_URL = testDatabaseUrl;

    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();

    try {
        for (const name of ROLES) {
            await prisma.roles.upsert({
                where: { name },
                update: {},
                create: { name }
            });
        }

        const noDiscountRows = await prisma.discounts.findMany({
            where: { code: "NO_DISCOUNT" },
            select: { id: true, percentage: true }
        });

        if (noDiscountRows.length > 1) {
            throw new Error("У БД є дублікати знижки NO_DISCOUNT.");
        }

        if (noDiscountRows.length === 1) {
            const row = noDiscountRows[0];

            if (row.id !== 1 || Number(row.percentage) !== 0) {
                throw new Error(
                    "NO_DISCOUNT має бути записом з id=1 і percent=0."
                );
            }
        } else {
            const discountWithIdOne = await prisma.discounts.findUnique({
                where: { id: 1 }
            });

            if (discountWithIdOne) {
                throw new Error(
                    "discounts.id=1 уже зайнятий іншою знижкою."
                );
            }

            const anyDiscount = await prisma.discounts.findFirst();

            if (anyDiscount) {
                throw new Error(
                    "Таблиця discounts уже містить записи, " +
                    "але NO_DISCOUNT з id=1 немає."
                );
            }

            await prisma.discounts.create({
                data: DISCOUNTS[0]
            });
        }

        for (const discount of DISCOUNTS.slice(1)) {
            const existingRows = await prisma.discounts.findMany({
                where: { code: discount.code },
                select: { id: true, percentage: true }
            });

            if (existingRows.length > 1) {
                throw new Error(
                    `У БД є дублікати знижки ${discount.code}.`
                );
            }

            if (existingRows.length === 1) {
                if (Number(existingRows[0].percentage) !== discount.percentage) {
                    throw new Error(
                        `Знижка ${discount.code} має неочікуваний відсоток.`
                    );
                }

                continue;
            }

            await prisma.discounts.create({
                data: discount
            });
        }

        console.log("Seed ролей і знижок завершився успішно.");
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(error => {
    console.error("Seed не виконано:", error.message);
    process.exitCode = 1;
});