const service = require("./payroll.service");

function handlePayrollError(error, res) {
    if (error.status === 404) {
        return res.status(404).json({
            error: {
                status: 404,
                message: error.message
            }
        });
    }

    console.error(error);

    return res.status(500).json({
        error: {
            status: 500,
            message: "Помилка розрахунку зарплат"
        }
    });
}

async function getGroupPayroll(req, res) {
    const groupId = Number(req.params.id);

    if (!Number.isInteger(groupId) || groupId <= 0) {
        return res.status(400).json({
            error: {
                status: 400,
                message: "ID групи повинен бути додатним цілим числом"
            }
        });
    }

    try {
        const payroll = await service.getGroupPayroll(groupId);
        return res.status(200).json(payroll);
    } catch (error) {
        return handlePayrollError(error, res);
    }
}

async function getKindergartenPayroll(req, res) {
    try {
        const payroll = await service.getKindergartenPayroll();
        return res.status(200).json(payroll);
    } catch (error) {
        return handlePayrollError(error, res);
    }
}

module.exports = {
    getGroupPayroll,
    getKindergartenPayroll
};