const prisma = require('../../config/prisma');
const Decimal = require('decimal.js');

const MEAL_RATES_BY_AGE = {
    2: 300,
    3: 400,
    4: 500,
    5: 600
};

class PricingService {
    static async createPricingPlan(data) {
        if (!data.amount || new Decimal(data.amount).lte(0)) {
            throw { status: 400, message: 'Invalid pricing plan amount' };
        }

        await prisma.pricing_plans.updateMany({
            where: { is_active: true },
            data: { is_active: false, effective_to: new Date() }
        });

        return await prisma.pricing_plans.create({
            data: {
                name: data.name || 'Базовий тариф',
                amount: new Decimal(data.amount).toFixed(2),
                effective_from: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
                is_active: true
            }
        });
    }

    static async getPricingPlans() {
        return await prisma.pricing_plans.findMany({ orderBy: { effective_from: 'desc' } });
    }

    static async updatePricingPlan(id, data) {
        const updateData = {};
        if (data.amount) updateData.amount = new Decimal(data.amount).toFixed(2);
        if (data.name) updateData.name = data.name;
        if (data.isActive !== undefined) updateData.is_active = data.isActive;

        return await prisma.pricing_plans.update({
            where: { id: Number(id) },
            data: updateData
        });
    }

    static async deletePricingPlan(id) {
        return await prisma.pricing_plans.delete({ where: { id: Number(id) } });
    }

    static async getMealRates() {
        const rates = await prisma.meal_rates.findMany({ orderBy: { age: 'asc' } });
        return rates.length > 0 ? rates : MEAL_RATES_BY_AGE;
    }

    static async getBenefits() {
        return await prisma.discounts.findMany();
    }

    static async createBenefit(data) {
        if (
            !data.code ||
            data.percentage === undefined ||
            !new Decimal(data.percentage).isFinite() ||
            new Decimal(data.percentage).lt(0) ||
            new Decimal(data.percentage).gt(100)
        ) {
            throw { status: 400, message: 'code and valid percentage (0-100) are required' };
        }

        return await prisma.discounts.create({
            data: {
                name: data.name,
                code: data.code,
                description: data.description || data.name || null,
                percentage: new Decimal(data.percentage).toFixed(2)
            }
        });
    }

    static async assignBenefitToChild(childId, { benefitId, discountId, effectiveFrom, effectiveTo }) {
        const targetDiscountId = benefitId || discountId;
        const child = await prisma.children.findUnique({ where: { id: Number(childId) } });

        if (!child) {
            throw { status: 404, message: 'Child with this ID was not found' };
        }

        await prisma.child_benefits.updateMany({
            where: { child_id: Number(childId), is_active: true },
            data: { is_active: false, effective_to: new Date() }
        });

        return await prisma.child_benefits.create({
            data: {
                child_id: Number(childId),
                discount_id: Number(targetDiscountId),
                effective_from: effectiveFrom ? new Date(effectiveFrom) : new Date(),
                effective_to: effectiveTo ? new Date(effectiveTo) : null,
                is_active: true
            }
        });
    }

    static async removeChildBenefit(childId, benefitId) {
        return await prisma.child_benefits.updateMany({
            where: {
                child_id: Number(childId),
                discount_id: Number(benefitId),
                is_active: true
            },
            data: { is_active: false, effective_to: new Date() }
        });
    }

    static async calculateTuition({ childId, period, isAnnual = false, mealDays = 0 }) {
        if (mealDays < 0) {
            throw { status: 400, message: 'The number of days of meals cannot be negative' };
        }

        const periodRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

        if (period && !periodRegex.test(period)) {
            throw { status: 400, message: 'Invalid period format. Use YYYY-MM' };
        }

        const child = await prisma.children.findUnique({
            where: { id: Number(childId) }
        });

        if (!child) {
            throw { status: 404, message: 'A child with this ID was not found' };
        }

        const activePlan = await prisma.pricing_plans.findFirst({
            where: { is_active: true },
            orderBy: { effective_from: 'desc' }
        });

        const baseTuition = activePlan
            ? new Decimal(activePlan.amount)
            : new Decimal(15000);

        const activeChildBenefit = await prisma.child_benefits.findFirst({
            where: {
                child_id: Number(childId),
                is_active: true,
                effective_from: { lte: new Date() },
                OR: [
                    { effective_to: null },
                    { effective_to: { gte: new Date() } }
                ]
            },
            include: { discounts: true }
        });

        let benefitPercent = new Decimal(0);

        if (activeChildBenefit && activeChildBenefit.discounts) {
            benefitPercent = new Decimal(activeChildBenefit.discounts.percentage);
        } else if (child.discount_id) {
            const discount = await prisma.discounts.findUnique({
                where: { id: child.discount_id }
            });

            if (discount) {
                benefitPercent = new Decimal(discount.percentage);
            }
        }

        const selectedPeriod = isAnnual ? 'ANNUAL' : 'MONTHLY';
        const tuitionCalc = calculateTuitionCalc({
            baseFee: baseTuition,
            discountPercent: benefitPercent,
            period: selectedPeriod
        });

        const birthDate = new Date(child.date_of_birth || child.birth_date);
        const age = calculateAge(birthDate);

        const dbMealRate = await prisma.meal_rates.findUnique({
            where: { age }
        }).catch(() => null);

        const pricePerDay = dbMealRate
            ? new Decimal(dbMealRate.daily_rate)
            : new Decimal(MEAL_RATES_BY_AGE[age] || 0);

        const totalMeal = pricePerDay.mul(mealDays);
        const totalTuition = new Decimal(tuitionCalc.total);
        const totalAmount = totalTuition.add(totalMeal);

        return {
            childId: child.id,
            age,
            period: period || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
            isAnnual,
            mealDays,
            baseEducationFee: tuitionCalc.baseFee,
            benefitPercentage: tuitionCalc.discountPercent,
            annualDiscountPercentage: tuitionCalc.annualPaymentDiscountPercent || '0.00',
            tuitionAmount: tuitionCalc.total,
            mealAmount: totalMeal.toFixed(2),
            totalAmount: totalAmount.toFixed(2)
        };
    }

    static async createPayment(data) {
        const calc = await this.calculateTuition(data);

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);

        return await prisma.payments.create({
            data: {
                child_id: Number(calc.childId),
                period: calc.period,
                due_date: dueDate,
                base_education_fee: new Decimal(calc.baseEducationFee).toFixed(2),
                benefit_percentage: new Decimal(calc.benefitPercentage).toFixed(2),
                annual_discount: new Decimal(calc.annualDiscountPercentage).toFixed(2),
                education_amount: new Decimal(calc.tuitionAmount).toFixed(2),
                meal_amount: new Decimal(calc.mealAmount).toFixed(2),
                total_amount: new Decimal(calc.totalAmount).toFixed(2),
                paid_amount: '0.00',
                status: 'PENDING'
            }
        });
    }

    static async getPayments(user) {
        if (user && user.role === 'PARENT') {
            const parent = await prisma.parents.findUnique({
                where: { user_id: Number(user.id) }
            });

            if (!parent) return [];

            return await prisma.payments.findMany({
                where: {
                    children: {
                        child_parents: {
                            some: {
                                parent_id: parent.id
                            }
                        }
                    }
                },
                include: { children: true }
            });
        }

        return await prisma.payments.findMany({
            include: { children: true }
        });
    }

    static async getPaymentById(id) {
        const payment = await prisma.payments.findUnique({
            where: { id: Number(id) },
            include: { children: true }
        });

        if (!payment) {
            throw { status: 404, message: 'Payment not found' };
        }

        return payment;
    }

    static async updatePayment(id, data) {
        const updateData = {};

        if (data.status) {
            const validStatuses = ['PENDING', 'PAID', 'PARTIALLY_PAID', 'CANCELLED'];
            if (!validStatuses.includes(data.status)) {
                throw new Error(`Некоректний статус платежу: ${data.status}`);
            }
            updateData.status = data.status;
        }

        if (data.paidAmount !== undefined && data.paidAmount !== null) {
            const paidNum = Number(data.paidAmount);

            if (isNaN(paidNum) || paidNum < 0) {
                throw new Error("Сума платежу не може бути від'ємною");
            }

            updateData.paid_amount = new Decimal(paidNum).toFixed(2);

            if (!data.status) {
                updateData.status = paidNum === 0 ? 'PENDING' : 'PAID';
            }
        }

        return await prisma.payments.update({
            where: { id: Number(id) },
            data: updateData
        });
    }

    static async deletePayment(id) {
        return await prisma.payments.delete({
            where: { id: Number(id) }
        });
    }

    static async getCostRules() {
        return await prisma.rules.findMany({
            where: { is_active: true }
        });
    }

    static async createCostRule(data) {
        if (!data.name || data.baseCost === undefined) {
            throw { status: 400, message: 'Name and baseCost are required' };
        }

        return await prisma.rules.create({
            data: {
                name: data.name,
                min_children: data.minChildren || 12,
                base_cost: new Decimal(data.baseCost).toFixed(2),
                extra_child_cost: data.extraChildCost
                    ? new Decimal(data.extraChildCost).toFixed(2)
                    : '0.00',
                description: data.description || null,
                is_active: true
            }
        });
    }

    static async updateCostRule(id, data) {
        const updateData = {};

        if (data.name) updateData.name = data.name;
        if (data.minChildren) updateData.min_children = data.minChildren;
        if (data.baseCost) updateData.base_cost = new Decimal(data.baseCost).toFixed(2);
        if (data.extraChildCost) {
            updateData.extra_child_cost = new Decimal(data.extraChildCost).toFixed(2);
        }
        if (data.description) updateData.description = data.description;
        if (data.isActive !== undefined) updateData.is_active = data.isActive;

        return await prisma.rules.update({
            where: { id: Number(id) },
            data: updateData
        });
    }

    static async deleteCostRule(id) {
        return await prisma.rules.delete({
            where: { id: Number(id) }
        });
    }
}

const childrenRepo = require('../children/children.repository');
const discountsRepo = require('../discounts/discounts.repository');
const { isSupportedPercent } = require('../discounts/discounts.service');
const AppError = require('../../utils/AppError');
const parseId = require('../../utils/parseId');
const cfg = require('../../config/pricing');
const { calculateTuition: calculateTuitionCalc } = require('./tuition.calculator');
const pricingRepo = require('./pricing.repository');
const { getTariffAmount } = require('../tariffs/tariffs.service');
const { mealPriceForDays } = require('./meal.calculator');
const {
    calculateAge,
    todayUtc,
    startOfMonthUtc,
    formatDateOnly
} = require('../../utils/age');

const PERIODS = ['MONTHLY', 'ANNUAL'];

function parsePeriod(value) {
    if (value === undefined) return 'MONTHLY';

    const p = typeof value === 'string'
        ? value.trim().toUpperCase()
        : '';

    if (!PERIODS.includes(p)) {
        throw new AppError(
            400,
            `period має бути одним із: ${PERIODS.join(', ')}`
        );
    }

    return p;
}

async function resolveDiscount(child, overrideId) {
    if (overrideId !== undefined) {
        const d = await discountsRepo.findById(overrideId);

        if (!d) {
            throw new AppError(404, 'Знижку не знайдено');
        }

        return d;
    }

    if (child.discount_id === null) return null;

    const d = await discountsRepo.findById(child.discount_id);

    if (!d) {
        throw new AppError(
            409,
            'Знижку дитини не знайдено в довіднику'
        );
    }

    return d;
}

async function estimateTuition(rawChildId, query = {}) {
    const childId = parseId(rawChildId, 'childId');
    const period = parsePeriod(query.period);

    const overrideId = query.discountId === undefined
        ? undefined
        : parseId(query.discountId, 'discountId');

    const child = await childrenRepo.findById(childId);

    if (!child) {
        throw new AppError(404, 'Дитину не знайдено');
    }

    const discount = await resolveDiscount(child, overrideId);
    const percent = discount
        ? new Decimal(discount.percentage)
        : new Decimal(0);

    if (!isSupportedPercent(percent)) {
        throw new AppError(
            409,
            `Непідтримуваний розмір знижки: ${percent.toString()}%. Дозволено: ${cfg.ALLOWED_DISCOUNT_PERCENTS.join(', ')}`
        );
    }

    const baseFee = await getTariffAmount(
        cfg.TARIFF_TUITION_CODE,
        startOfMonthUtc(todayUtc())
    );

    const calculation = calculateTuitionCalc({
        baseFee,
        discountPercent: percent,
        period
    });

    return {
        childId,
        discount: discount
            ? {
                id: discount.id,
                name: discount.description,
                percent: percent.toNumber()
            }
            : null,
        calculation
    };
}

function parseDays(value) {
    if (value === undefined) return undefined;

    if (typeof value !== 'string' || !/^\d+$/.test(value)) {
        throw new AppError(
            400,
            'days має бути цілим числом від 1 до 31'
        );
    }

    const n = Number(value);

    if (n < 1 || n > 31) {
        throw new AppError(
            400,
            'days має бути цілим числом від 1 до 31'
        );
    }

    return n;
}

async function calculateMealAmount(age, days, periodStart) {
    const rate = await pricingRepo.findMealRateEffective(age, periodStart);

    if (!rate) {
        throw new AppError(
            409,
            `Не знайдено ціну харчування для віку ${age} на ${formatDateOnly(periodStart)}. Для нарахування без харчування вкажіть mealDays: 0`
        );
    }

    const billedDays = days === undefined
        ? cfg.MEAL_DAYS_PER_MONTH
        : days;

    const pricePerDay = new Decimal(rate.daily_rate).toDecimalPlaces(2);

    return {
        pricePerDay,
        days: billedDays,
        total: mealPriceForDays(pricePerDay, billedDays)
    };
}

async function getChildDiscountPercent(child) {
    const discount = await resolveDiscount(child, undefined);

    const percent = discount
        ? new Decimal(discount.percentage)
        : new Decimal(0);

    if (!isSupportedPercent(percent)) {
        throw new AppError(
            409,
            `Непідтримуваний розмір знижки: ${percent.toString()}%`
        );
    }

    return percent;
}

async function estimateMeals(rawChildId, query = {}) {
    const childId = parseId(rawChildId, 'childId');
    const days = parseDays(query.days);

    const child = await childrenRepo.findById(childId);

    if (!child) {
        throw new AppError(404, 'Дитину не знайдено');
    }

    const age = calculateAge(child.birth_date);
    const meal = await calculateMealAmount(
        age,
        days,
        startOfMonthUtc(todayUtc())
    );

    return {
        childId,
        age,
        pricePerDay: meal.pricePerDay.toFixed(2),
        days: meal.days,
        total: meal.total.toFixed(2)
    };
}

module.exports = {
    PricingService,
    estimateTuition,
    estimateMeals,
    calculateMealAmount,
    getChildDiscountPercent
};