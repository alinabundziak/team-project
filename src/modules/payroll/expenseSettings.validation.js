const DEFAULTS = {
    extraChildrenThreshold: 12,
    educatorBasePerChild: 2000,
    educatorExtraPerChild: 5000,
    assistantBaseMonthlySalary: 20000,
    assistantExtraPerChild: 3000,
    teacherMonthlySalary: 40000,
    managerMonthlySalary: 80000,
    rentPerGroup: 50000
};

function validateExpenseSettingsPatch(patch) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
        return "Передайте параметри у форматі JSON";
    }

    const allowedKeys = Object.keys(DEFAULTS);
    const keys = Object.keys(patch);

    if (keys.length === 0 || keys.some(key => !allowedKeys.includes(key))) {
        return "Передано порожні або невідомі параметри";
    }

    for (const [key, value] of Object.entries(patch)) {
        const isThreshold = key === "extraChildrenThreshold";
        const validNumber =
            typeof value === "number" &&
            Number.isFinite(value) &&
            value >= 0 &&
            (isThreshold
                ? Number.isInteger(value)
                : Math.abs(value * 100 - Math.round(value * 100)) < 0.000001);

        if (!validNumber) {
            return `Некоректне значення параметра ${key}`;
        }
    }

    return null;
}

module.exports = {
    DEFAULTS,
    validateExpenseSettingsPatch
};