
const service = require("./optimization.service");

async function getRecommendations(req, res) {
    try {
        const recommendations =
            await service.getOptimizationRecommendations();

        return res.status(200).json({ data: recommendations });
    } catch (error) {
        console.error("Помилка формування рекомендацій:", error);

        return res.status(error.status || 500).json({
            error: {
                status: error.status || 500,
                message: error.status
                    ? error.message
                    : "Не вдалося сформувати рекомендації"
            }
        });
    }
}

module.exports = {
    getRecommendations
};
