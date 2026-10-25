const prisma = require("../../config/prisma");

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

const RULE_NAMES = {
    educator: "PAYROLL_EDUCATOR",
    assistant: "PAYROLL_ASSISTANT",
    teacher: "PAYROLL_TEACHER",
    manager: "PAYROLL_MANAGER",
    rent: "PAYROLL_RENT"
};

function createSettingsError(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    return error;
}

async function getExpenseSettings() {
    const rows = await prisma.rules.findMany({
        where: { name: { in: Object.values(RULE_NAMES) } },
        select: {
            name: true,
            min_children: true,
            base_cost: true,
            extra_child_cost: true,
            is_active: true
        }
    });

    const activeRows = rows.filter(row => row.is_active !== false);
    const byName = new Map(activeRows.map(row => [row.name, row]));
    const educator = byName.get(RULE_NAMES.educator);
    const assistant = byName.get(RULE_NAMES.assistant);
    const teacher = byName.get(RULE_NAMES.teacher);
    const manager = byName.get(RULE_NAMES.manager);
    const rent = byName.get(RULE_NAMES.rent);
    const asNumber = (value, fallback) =>
        value == null ? fallback : Number(value);

    return {
        extraChildrenThreshold: asNumber(
            educator?.min_children ?? assistant?.min_children,
            DEFAULTS.extraChildrenThreshold
        ),
        educatorBasePerChild: asNumber(
            educator?.base_cost,
            DEFAULTS.educatorBasePerChild
        ),
        educatorExtraPerChild: asNumber(
            educator?.extra_child_cost,
            DEFAULTS.educatorExtraPerChild
        ),
        assistantBaseMonthlySalary: asNumber(
            assistant?.base_cost,
            DEFAULTS.assistantBaseMonthlySalary
        ),
        assistantExtraPerChild: asNumber(
            assistant?.extra_child_cost,
            DEFAULTS.assistantExtraPerChild
        ),
        teacherMonthlySalary: asNumber(
            teacher?.base_cost,
            DEFAULTS.teacherMonthlySalary
        ),
        managerMonthlySalary: asNumber(
            manager?.base_cost,
            DEFAULTS.managerMonthlySalary
        ),
        rentPerGroup: asNumber(
            rent?.base_cost,
            DEFAULTS.rentPerGroup
        )
    };
}

async function updateExpenseSettings(patch) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
        throw createSettingsError("Передайте параметри у форматі JSON");
    }

    const allowedKeys = Object.keys(DEFAULTS);
    const keys = Object.keys(patch);

    if (keys.length === 0 || keys.some(key => !allowedKeys.includes(key))) {
        throw createSettingsError("Передано порожні або невідомі параметри");
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
            throw createSettingsError(`Некоректне значення параметра ${key}`);
        }
    }

    const settings = {
        ...(await getExpenseSettings()),
        ...patch
    };
    const ruleConfigs = [
        {
            name: RULE_NAMES.educator,
            min_children: settings.extraChildrenThreshold,
            base_cost: settings.educatorBasePerChild,
            extra_child_cost: settings.educatorExtraPerChild
        },
        {
            name: RULE_NAMES.assistant,
            min_children: settings.extraChildrenThreshold,
            base_cost: settings.assistantBaseMonthlySalary,
            extra_child_cost: settings.assistantExtraPerChild
        },
        {
            name: RULE_NAMES.teacher,
            min_children: settings.extraChildrenThreshold,
            base_cost: settings.teacherMonthlySalary,
            extra_child_cost: 0
        },
        {
            name: RULE_NAMES.manager,
            min_children: settings.extraChildrenThreshold,
            base_cost: settings.managerMonthlySalary,
            extra_child_cost: 0
        },
        {
            name: RULE_NAMES.rent,
            min_children: settings.extraChildrenThreshold,
            base_cost: settings.rentPerGroup,
            extra_child_cost: 0
        }
    ];

    const operations = [];

    for (const config of ruleConfigs) {
        const existing = await prisma.rules.findFirst({
            where: { name: config.name },
            select: { id: true }
        });

        if (existing) {
            operations.push(
                prisma.rules.update({
                    where: { id: existing.id },
                    data: { ...config, is_active: true }
                })
            );
        } else {
            operations.push(
                prisma.rules.create({
                    data: { ...config, is_active: true }
                })
            );
        }
    }

    await prisma.$transaction(operations);
    return settings;
}

module.exports = {
    getExpenseSettings,
    updateExpenseSettings
};