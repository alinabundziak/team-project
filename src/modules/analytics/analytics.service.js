const { PrismaClient } = require('@prisma/client');
const Decimal = require('decimal.js');
const prisma = new PrismaClient();

class AnalyticsService {
  async getFinancialSummary(startDate, endDate) {
    try {
      const dateFilter = {};
      if (startDate && endDate) {
        dateFilter.created_at = {
          gte: new Date(startDate),
          lte: new Date(endDate),
        };
      }

      let chargesTotal = new Decimal(0);
      try {
        if (prisma.charges) {
          const res = await prisma.charges.aggregate({
            _sum: { total_amount: true },
            where: dateFilter,
          });
          chargesTotal = new Decimal(res?._sum?.total_amount?.toString() || 0);
        }
      } catch (e) {
        chargesTotal = new Decimal(0);
      }

      let paymentsTotal = new Decimal(0);
      try {
        if (prisma.payments) {
          const res = await prisma.payments.aggregate({
            _sum: { paid_amount: true },
            where: { ...dateFilter, status: 'PAID' },
          });
          paymentsTotal = new Decimal(res?._sum?.paid_amount?.toString() || 0);
        }
      } catch (e) {
        paymentsTotal = new Decimal(0);
      }

      let refundsTotal = new Decimal(0);
      try {
        if (prisma.refunds) {
          const res = await prisma.refunds.aggregate({
            _sum: { amount: true },
            where: dateFilter,
          });
          refundsTotal = new Decimal(res?._sum?.amount?.toString() || 0);
        }
      } catch (e) {
        refundsTotal = new Decimal(0);
      }

      const actualRevenue = paymentsTotal.sub(refundsTotal);
      const debtCalc = chargesTotal.sub(actualRevenue);
      const totalDebt = debtCalc.isNegative() ? new Decimal(0) : debtCalc;

      let groups = [];
      try {
        if (prisma.groups) {
          groups = await prisma.groups.findMany({ include: { children: true } });
        }
      } catch (e) {
        groups = [];
      }

      const groupsCount = groups.length;
      let groupSalariesTotal = new Decimal(0);
      for (const group of groups) {
        const N = group.children ? group.children.length : 0;
        const teacherSalary = new Decimal(2000).mul(N).add(new Decimal(500).mul(Math.max(0, N - 12)));
        const assistantSalary = new Decimal(20000);
        groupSalariesTotal = groupSalariesTotal.add(teacherSalary).add(assistantSalary);
      }

      let teachersCount = 0;
      try {
        if (prisma.employees) {
          teachersCount = await prisma.employees.count({ where: { position: 'TEACHER' } });
        }
      } catch (e) {
        teachersCount = 0;
      }

      const teachersSalaries = new Decimal(teachersCount).mul(40000);
      const managerSalary = new Decimal(80000);

      const totalStaffSalaries = groupSalariesTotal.add(teachersSalaries).add(managerSalary);
      const rentExpenses = new Decimal(50000).mul(groupsCount);
      const totalExpenses = totalStaffSalaries.add(rentExpenses);

      const financialResult = actualRevenue.sub(totalExpenses);

      return {
        period: {
          startDate: startDate || 'всі дати',
          endDate: endDate || 'всі дати',
        },
        chargesTotal: chargesTotal.toNumber(),
        actualRevenue: actualRevenue.toNumber(),
        totalDebt: totalDebt.toNumber(),
        expenses: {
          isEstimated: true, 
          staffSalaries: totalStaffSalaries.toNumber(),
          rentExpenses: rentExpenses.toNumber(),
          totalExpenses: totalExpenses.toNumber(),
        },
        financialResult: financialResult.toNumber(),
      };
    } catch (err) {
      console.error("Error in getFinancialSummary:", err);
      throw err;
    }
  }

  async getDebtsReport() {
    const children = await prisma.children.findMany({
      include: {
        charges: true,
        payments: {
          where: {
            status: 'PAID',
          },
        },
        refunds: true, 
      },
    });

    const debtors = [];
    let totalDebtAmount = new Decimal(0);
    let totalOverdueAmount = new Decimal(0);

    for (const child of children) {
      const totalCharged = child.charges.reduce(
        (acc, c) => acc.add(new Decimal(c.total_amount?.toString() || 0)),
        new Decimal(0)
      );

      const totalPaid = child.payments.reduce(
        (acc, p) => acc.add(new Decimal(p.paid_amount?.toString() || 0)),
        new Decimal(0)
      );

      const totalRefunded = (child.refunds || []).reduce(
        (acc, r) => acc.add(new Decimal(r.amount?.toString() || 0)),
        new Decimal(0)
      );

      const netPaid = totalPaid.sub(totalRefunded);

      const debt = totalCharged.sub(netPaid);

      if (debt.isPositive() && !debt.isZero()) {
        const overdueDebt = debt; 

        debtors.push({
          childId: child.id,
          childName: `${child.first_name || ''} ${child.last_name || ''}`.trim(),
          debtAmount: debt.toNumber(),
          overdueDebtAmount: overdueDebt.toNumber(),
          chargesCount: child.charges.length,
          lastPaymentDate: child.payments.length
            ? child.payments[child.payments.length - 1].created_at
            : null,
        });

        totalDebtAmount = totalDebtAmount.add(debt);
        totalOverdueAmount = totalOverdueAmount.add(overdueDebt);
      }
    }

    return {
      debtors,
      totalDebtAmount: totalDebtAmount.toNumber(),
      totalOverdueAmount: totalOverdueAmount.toNumber(),
      totalDebtorsCount: debtors.length,
    };
  }

  async getRevenueForecast() {
    const activePricingPlan = await prisma.pricing_plans?.findFirst({
      where: { is_active: true },
      orderBy: { created_at: 'desc' },
    }).catch(() => null);

    const activeMealRate = await prisma.meal_rates?.findFirst({
      where: { is_active: true },
      orderBy: { created_at: 'desc' },
    }).catch(() => null);

    const baseTuitionPrice = new Decimal(activePricingPlan?.price?.toString() || 15000);
    const baseDailyMealFee = new Decimal(activeMealRate?.daily_rate?.toString() || 400);

    const children = await prisma.children.findMany({
      include: {
        discounts: true,
      },
    });

    let expectedTuitionRevenue = new Decimal(0);
    let expectedMealsRevenue = new Decimal(0);

    const WORK_DAYS_PER_MONTH = 22;

    for (const child of children) {
      const discountPct = child.discounts ? new Decimal(child.discounts.percentage?.toString() || 0) : new Decimal(0);
      const discountMultiplier = new Decimal(1).sub(discountPct.div(100));
      const childTuition = baseTuitionPrice.mul(discountMultiplier);
      expectedTuitionRevenue = expectedTuitionRevenue.add(childTuition);
      expectedMealsRevenue = expectedMealsRevenue.add(baseDailyMealFee.mul(WORK_DAYS_PER_MONTH));
    }

    const expectedTotalRevenue = expectedTuitionRevenue.add(expectedMealsRevenue);

    return {
      activeChildrenCount: children.length,
      expectedTuitionRevenue: expectedTuitionRevenue.toNumber(),
      expectedMealsRevenue: expectedMealsRevenue.toNumber(),
      expectedTotalRevenue: expectedTotalRevenue.toNumber(),
    };
  }

  async calculateScenario(scenarioParams = {}) {
    const rawTarget = parseInt(scenarioParams.targetChildrenPerGroup, 10);
    const targetChildrenPerGroup = (!isNaN(rawTarget) && rawTarget > 0) ? rawTarget : 12;

    const rawTariffChange = parseFloat(scenarioParams.tariffPriceChangePercent);
    const tariffPriceChangePercent = !isNaN(rawTariffChange) ? rawTariffChange : 0;

    const rawDiscountChange = parseFloat(scenarioParams.discountChangePercent);
    const discountChangePercent = !isNaN(rawDiscountChange) ? rawDiscountChange : 0;

    const activePricingPlan = await prisma.pricing_plans?.findFirst({
      where: { is_active: true },
      orderBy: { created_at: 'desc' },
    }).catch(() => null);

    const activeMealRate = await prisma.meal_rates?.findFirst({
      where: { is_active: true },
      orderBy: { created_at: 'desc' },
    }).catch(() => null);

    const baseTuitionFromDb = new Decimal(activePricingPlan?.price?.toString() || 15000);
    const baseMealFeeFromDb = new Decimal(activeMealRate?.daily_rate?.toString() || 400);

    const groupsCount = await prisma.groups.count();
    const effectiveGroupsCount = groupsCount || 1;
    const simulatedChildrenCount = targetChildrenPerGroup * effectiveGroupsCount;

    const currentForecast = await this.getRevenueForecast();
    const currentSummary = await this.getFinancialSummary();

    const baseTuitionPerChild = baseTuitionFromDb.mul(new Decimal(1).add(new Decimal(tariffPriceChangePercent).div(100)));
    const avgDiscount = new Decimal(0.1).add(new Decimal(discountChangePercent).div(100));
    const effectiveDiscount = Decimal.max(0, avgDiscount);
    
    const simTuitionTotal = new Decimal(simulatedChildrenCount)
      .mul(baseTuitionPerChild)
      .mul(new Decimal(1).sub(effectiveDiscount));
      
    const simMealsTotal = new Decimal(simulatedChildrenCount).mul(baseMealFeeFromDb).mul(22);
    const simulatedRevenue = simTuitionTotal.add(simMealsTotal);

    const N = targetChildrenPerGroup;
    const teacherSalaryPerGroup = new Decimal(2000).mul(N).add(new Decimal(500).mul(Math.max(0, N - 12)));
    const assistantSalaryPerGroup = new Decimal(20000);
    const simulatedGroupSalaries = teacherSalaryPerGroup.add(assistantSalaryPerGroup).mul(effectiveGroupsCount);

    const simulatedRent = new Decimal(50000).mul(effectiveGroupsCount);
    const simulatedExpenses = simulatedGroupSalaries.add(simulatedRent).add(120000);

    const simulatedProfit = simulatedRevenue.sub(simulatedExpenses);
    const baselineRevenue = new Decimal(currentForecast.expectedTotalRevenue);
    const baselineExpenses = new Decimal(currentSummary.expenses.totalExpenses);
    const baselineProfit = baselineRevenue.sub(baselineExpenses);

    return {
      baseline: {
        childrenCount: currentForecast.activeChildrenCount,
        expectedRevenue: baselineRevenue.toNumber(),
        expectedExpenses: baselineExpenses.toNumber(),
        profit: baselineProfit.toNumber(),
      },
      scenario: {
        simulatedChildrenCount,
        targetChildrenPerGroup,
        simulatedRevenue: simulatedRevenue.toNumber(),
        simulatedExpenses: simulatedExpenses.toNumber(),
        simulatedProfit: simulatedProfit.toNumber(),
      },
      diff: {
        revenueDelta: simulatedRevenue.sub(baselineRevenue).toNumber(),
        expensesDelta: simulatedExpenses.sub(baselineExpenses).toNumber(),
        profitDelta: simulatedProfit.sub(baselineProfit).toNumber(),
      },
    };
  }
}

module.exports = new AnalyticsService();