const prisma = require("../src/config/prisma");
const optimizationService =
    require("../src/modules/optimization/optimization.service");

async function main() {
    try {
        const result =
            await optimizationService.getOptimizationRecommendations();

        console.log(
            `Оптимізація прочитала БД і сформувала ${result.recommendationsCount} рекомендацій; дані не змінювалися.`
        );
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(error => {
    console.error("Перевірка не пройшла:", error);
    process.exitCode = 1;
});