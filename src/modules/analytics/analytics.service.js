const { PrismaClient } = require('@prisma/client');
const Decimal = require('decimal.js');
const prisma = new PrismaClient();

class AnalyticsService {
  async getFinancialSummary(startDate, endDate) {
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.created_at = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const chargesAggregate = await prisma.charges.aggregate({
      _sum: { amount: true },
      where: dateFilter,
    });
    const chargesTotal = new Decimal(chargesAggregate._sum.amount?.toString() || 0);

    const paymentsAggregate = await prisma.payments.aggregate({
      _sum: { total_amount: true },
      where: dateFilter,
    });
    const paymentsTotal = new Decimal(paymentsAggregate._sum.total_amount?.toString() || 0);

    let refundsTotal = new Decimal(0);

    const actualRevenue = paymentsTotal.sub(refundsTotal);
    const debtCalc = chargesTotal.sub(actualRevenue);
    const totalDebt = debtCalc.isNegative() ? new Decimal(0) : debtCalc;

    const groups = await prisma.groups.findMany({
      include: { children: true },
    });
    const groupsCount = groups.length;

    let groupSalariesTotal = new Decimal(0);
    for (const group of groups) {
      const N = group.children ? group.children.length : 0;
      const teacherSalary = new Decimal(2000).mul(N).add(new Decimal(500).mul(Math.max(0, N - 12)));
      const assistantSalary = new Decimal(20000);
      groupSalariesTotal = groupSalariesTotal.add(teacherSalary).add(assistantSalary);
    }

    const teachersCount = await prisma.employees.count({
      where: { position: 'TEACHER' },
    }).catch(() => 0);

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
  }

  async getDebtsReport() {
    const children = await prisma.children.findMany({
      include: {
        charges: true,
        payments: true,
      },
    });

    const debtors = [];
    let totalOverdueAmount = new Decimal(0);

    for (const child of children) {
      const totalCharged = child.charges.reduce(
        (acc, c) => acc.add(new Decimal(c.amount?.toString() || 0)),
        new Decimal(0)
      );
      const totalPaid = child.payments.reduce(
        (acc, p) => acc.add(new Decimal(p.total_amount?.toString() || 0)),
        new Decimal(0)
      );
      const debt = totalCharged.sub(totalPaid);

      if (debt.isPositive() && !debt.isZero()) {
        debtors.push({
          childId: child.id,
          childName: `${child.first_name || ''} ${child.last_name || ''}`.trim(),
          debtAmount: debt.toNumber(),
          chargesCount: child.charges.length,
          lastPaymentDate: child.payments.length
            ? child.payments[child.payments.length - 1].created_at
            : null,
        });
        totalOverdueAmount = totalOverdueAmount.add(debt);
      }
    }

    return {
      totalDebtorsCount: debtors.length,
      totalOverdueAmount: totalOverdueAmount.toNumber(),
      debtors,
    };
  }

  async getRevenueForecast() {
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
      const childTuition = new Decimal(15000).mul(discountMultiplier);
      expectedTuitionRevenue = expectedTuitionRevenue.add(childTuition);

      const dailyMealFee = new Decimal(400); 
      expectedMealsRevenue = expectedMealsRevenue.add(dailyMealFee.mul(WORK_DAYS_PER_MONTH));
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
    const {
      targetChildrenPerGroup = 12,
      tariffPriceChangePercent = 0,
      discountChangePercent = 0,
    } = scenarioParams;

    const groupsCount = await prisma.groups.count();
    const effectiveGroupsCount = groupsCount || 1;
    const simulatedChildrenCount = targetChildrenPerGroup * effectiveGroupsCount;

    const currentForecast = await this.getRevenueForecast();
    const currentSummary = await this.getFinancialSummary();

    const baseTuitionPerChild = new Decimal(15000).mul(new Decimal(1).add(new Decimal(tariffPriceChangePercent).div(100)));
    const avgDiscount = new Decimal(0.1).add(new Decimal(discountChangePercent).div(100));
    const effectiveDiscount = Decimal.max(0, avgDiscount);
    
    const simTuitionTotal = new Decimal(simulatedChildrenCount)
      .mul(baseTuitionPerChild)
      .mul(new Decimal(1).sub(effectiveDiscount));
      
    const simMealsTotal = new Decimal(simulatedChildrenCount).mul(400).mul(22);
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