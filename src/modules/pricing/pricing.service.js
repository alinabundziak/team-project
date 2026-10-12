const prisma = require('../../config/prisma');
const Decimal = require('decimal.js');

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
        return await prisma.meal_rates.findMany({ orderBy: { age: 'asc' } });
    }

    static async getBenefits() {
        return await prisma.discounts.findMany();
    }

    static async createBenefit(data) {
        if (!data.percentage || new Decimal(data.percentage).lt(0) || new Decimal(data.percentage).gt(100)) {
            throw { status: 400, message: 'Invalid percentage (0-100 allowed)' };
        }
        return await prisma.discounts.create({
            data: {
                name: data.name,
                percentage: new Decimal(data.percentage).toFixed(2)
            }
        });
    }

    static async assignBenefitToChild(childId, { benefitId, discountId, effectiveFrom, effectiveTo }) {
        const targetDiscountId = benefitId || discountId;
        const child = await prisma.children.findUnique({ where: { id: Number(childId) } });
        if (!child) throw { status: 404, message: 'Child with this ID was not found' };

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
            where: { child_id: Number(childId), discount_id: Number(benefitId), is_active: true },
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

        const child = await prisma.children.findUnique({ where: { id: Number(childId) } });
        if (!child) throw { status: 404, message: 'A child with this ID was not found' };

        const activePlan = await prisma.pricing_plans.findFirst({
            where: { is_active: true },
            orderBy: { effective_from: 'desc' }
        });
        const baseTuition = activePlan ? new Decimal(activePlan.amount) : new Decimal(15000);

        const activeChildBenefit = await prisma.child_benefits.findFirst({
            where: {
                child_id: Number(childId),
                is_active: true,
                effective_from: { lte: new Date() },
                OR: [{ effective_to: null }, { effective_to: { gte: new Date() } }]
            },
            include: { discounts: true }
        });

        let benefitPercent = new Decimal(0);
        if (activeChildBenefit && activeChildBenefit.discounts) {
            benefitPercent = new Decimal(activeChildBenefit.discounts.percentage);
        } else if (child.discount_id) {
            const discount = await prisma.discounts.findUnique({ where: { id: child.discount_id } });
            if (discount) benefitPercent = new Decimal(discount.percentage);
        }

        const months = isAnnual ? 12 : 1;
        const tuitionAfterBenefit = baseTuition.mul(new Decimal(1).sub(benefitPercent.div(100)));
        const annualDiscountPercent = isAnnual ? new Decimal(12) : new Decimal(0);
        const annualMultiplier = new Decimal(1).sub(annualDiscountPercent.div(100));
        const totalTuition = tuitionAfterBenefit.mul(months).mul(annualMultiplier);

        const today = new Date();
        const birthDate = new Date(child.birth_date);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;

        const defaultMealRates = { 2: 300, 3: 400, 4: 500, 5: 600 };
        const dbMealRate = await prisma.meal_rates.findUnique({ where: { age } });
        const pricePerDay = dbMealRate ? new Decimal(dbMealRate.daily_rate) : new Decimal(defaultMealRates[age] || 0);

        const totalMeal = pricePerDay.mul(mealDays);
        const totalAmount = totalTuition.add(totalMeal);

        return {
            childId: child.id,
            age,
            period: period || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
            isAnnual,
            mealDays,
            baseEducationFee: baseTuition.toFixed(2),
            benefitPercentage: benefitPercent.toFixed(2),
            annualDiscountPercentage: annualDiscountPercent.toFixed(2),
            tuitionAmount: totalTuition.toFixed(2),
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
            const parent = await prisma.parents.findUnique({ where: { user_id: Number(user.id) } });
            if (!parent) return [];
            return await prisma.payments.findMany({
                where: { children: { parent_id: parent.id } },
                include: { children: true }
            });
        }
        return await prisma.payments.findMany({ include: { children: true } });
    }

    static async getPaymentById(id) {
        const payment = await prisma.payments.findUnique({ where: { id: Number(id) }, include: { children: true } });
        if (!payment) throw { status: 404, message: 'Payment not found' };
        return payment;
    }

    static async updatePayment(id, data) {
        const updateData = {};
        if (data.status) updateData.status = data.status;
        if (data.paidAmount) updateData.paid_amount = new Decimal(data.paidAmount).toFixed(2);

        return await prisma.payments.update({
            where: { id: Number(id) },
            data: updateData
        });
    }

    static async deletePayment(id) {
        return await prisma.payments.delete({ where: { id: Number(id) } });
    }

    static async getCostRules() {
        return await prisma.rules.findMany({ where: { is_active: true } });
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
                extra_child_cost: data.extraChildCost ? new Decimal(data.extraChildCost).toFixed(2) : '0.00',
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
        if (data.extraChildCost) updateData.extra_child_cost = new Decimal(data.extraChildCost).toFixed(2);
        if (data.description) updateData.description = data.description;
        if (data.isActive !== undefined) updateData.is_active = data.isActive;

        return await prisma.rules.update({
            where: { id: Number(id) },
            data: updateData
        });
    }

    static async deleteCostRule(id) {
        return await prisma.rules.delete({ where: { id: Number(id) } });
    }
}

module.exports = { PricingService };