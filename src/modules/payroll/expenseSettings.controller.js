const service = require("./expenseSettings.service");
const { validateExpenseSettingsPatch } = require("./expenseSettings.validation");

function handleError(error, res) {
    const status = error.status || 500;

    return res.status(status).json({
        error: {
            status,
            message:
                status === 500
                    ? "Помилка налаштувань витрат"
                    : error.message
        }
    });
}

async function getSettings(req, res) {
    try {
        const settings = await service.getExpenseSettings();
        return res.status(200).json({ data: settings });
    } catch (error) {
        return handleError(error, res);
    }
}

async function updateSettings(req, res) {
    const validationError = validateExpenseSettingsPatch(req.body);

    if (validationError) {
        return res.status(400).json({
            error: {
                status: 400,
                message: validationError
            }
        });
    }

    try {
        const settings = await service.updateExpenseSettings(req.body);
        return res.status(200).json({ data: settings });
    } catch (error) {
        return handleError(error, res);
    }
}

module.exports = { getSettings, updateSettings };