const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class AnalyticsService {
  async getFinancialSummary(startDate, endDate) {
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const chargesAggregate = await prisma.charge.aggregate({
      _sum: { amount: true },
      where: dateFilter,
    });
    const chargesTotal = chargesAggregate._sum.amount || 0;

    const paymentsAggregate = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: dateFilter,
    });
    const paymentsTotal = paymentsAggregate._sum.amount || 0;

    let refundsTotal = 0;
    if (prisma.refund) {
      const refundsAggregate = await prisma.refund.aggregate({
        _sum: { amount: true },
        where: dateFilter,
      });
      refundsTotal = refundsAggregate._sum.amount || 0;
    }

    const actualRevenue = paymentsTotal - refundsTotal;
    const totalDebt = Math.max(0, chargesTotal - actualRevenue);

    const groups = await prisma.group.findMany({
      include: { children: true },
    });
    const groupsCount = groups.length;

    let groupSalariesTotal = 0;
    for (const group of groups) {
      const N = group.children ? group.children.length : 0;
      const teacherSalary = 2000 * N + 500 * Math.max(0, N - 12);
      const assistantSalary = 20000;
      groupSalariesTotal += (teacherSalary + assistantSalary);
    }

    const teachersCount = await prisma.employee.count({
      where: { role: 'TEACHER' },
    });
    const teachersSalaries = teachersCount * 40000;
    const managerSalary = 80000;
    const totalStaffSalaries = groupSalariesTotal + teachersSalaries + managerSalary;
    const rentExpenses = 50000 * groupsCount;
    const totalExpenses = totalStaffSalaries + rentExpenses;
    const financialResult = actualRevenue - totalExpenses;

    return {
      period: {
        startDate: startDate || 'всі дати',
        endDate: endDate || 'всі дати',
      },
      chargesTotal: Number(chargesTotal.toFixed(2)),
      actualRevenue: Number(actualRevenue.toFixed(2)),
      totalDebt: Number(totalDebt.toFixed(2)),
      expenses: {
        isEstimated: false, // Явне маркування витрат
        staffSalaries: Number(totalStaffSalaries.toFixed(2)),
        rentExpenses: Number(rentExpenses.toFixed(2)),
        totalExpenses: Number(totalExpenses.toFixed(2)),
      },
      financialResult: Number(financialResult.toFixed(2)),
    };
  }

  async getDebtsReport() {
    const children = await prisma.child.findMany({
      include: {
        charges: true,
        payments: true,
      },
    });

    const debtors = [];
    let totalOverdueAmount = 0;

    for (const child of children) {
      const totalCharged = child.charges.reduce((acc, c) => acc + c.amount, 0);
      const totalPaid = child.payments.reduce((acc, p) => acc + p.amount, 0);
      const debt = totalCharged - totalPaid;

      if (debt > 0) {
        debtors.push({
          childId: child.id,
          childName: `${child.firstName} ${child.lastName}`,
          debtAmount: Number(debt.toFixed(2)),
          chargesCount: child.charges.length,
          lastPaymentDate: child.payments.length
            ? child.payments[child.payments.length - 1].createdAt
            : null,
        });
        totalOverdueAmount += debt;
      }
    }

    return {
      totalDebtorsCount: debtors.length,
      totalOverdueAmount: Number(totalOverdueAmount.toFixed(2)),
      debtors,
    };
  }

  async getRevenueForecast() {
    const children = await prisma.child.findMany({
      include: {
        discount: true,
      },
    });

    let expectedTuitionRevenue = 0;
    let expectedMealsRevenue = 0;

    const WORK_DAYS_PER_MONTH = 22; 

    for (const child of children) {
      const discountVal = child.discount ? child.discount.percentage / 100 : 0;
      const childTuition = 15000 * (1 - discountVal);
      expectedTuitionRevenue += childTuition;
      const age = child.age || 3;
      const dailyMealFee = 300 + 100 * Math.min(Math.max(age - 2, 0), 3);
      expectedMealsRevenue += dailyMealFee * WORK_DAYS_PER_MONTH;
    }

    const expectedTotalRevenue = expectedTuitionRevenue + expectedMealsRevenue;

    return {
      activeChildrenCount: children.length,
      expectedTuitionRevenue: Number(expectedTuitionRevenue.toFixed(2)),
      expectedMealsRevenue: Number(expectedMealsRevenue.toFixed(2)),
      expectedTotalRevenue: Number(expectedTotalRevenue.toFixed(2)),
    };
  }

  async calculateScenario(scenarioParams) {
    const {
      targetChildrenPerGroup = 12,
      tariffPriceChangePercent = 0, 
      discountChangePercent = 0,
    } = scenarioParams;

    const groupsCount = await prisma.group.count();
    const effectiveGroupsCount = groupsCount || 1;
    const simulatedChildrenCount = targetChildrenPerGroup * effectiveGroupsCount;
    const currentForecast = await this.getRevenueForecast();
    const currentSummary = await this.getFinancialSummary();
    const baseTuitionPerChild = 15000 * (1 + tariffPriceChangePercent / 100);
    const avgDiscount = (0.1 + discountChangePercent / 100); 
    const simTuitionTotal = simulatedChildrenCount * baseTuitionPerChild * (1 - Math.max(0, avgDiscount));
    const simMealsTotal = simulatedChildrenCount * 400 * 22; 
    const simulatedRevenue = simTuitionTotal + simMealsTotal;
    const N = targetChildrenPerGroup;
    const teacherSalaryPerGroup = 2000 * N + 500 * Math.max(0, N - 12);
    const assistantSalaryPerGroup = 20000;
    const simulatedGroupSalaries = (teacherSalaryPerGroup + assistantSalaryPerGroup) * effectiveGroupsCount;
    const simulatedRent = 50000 * effectiveGroupsCount;
    const simulatedOtherSalaries = (currentSummary.expenses.staffSalaries - (currentSummary.expenses.staffSalaries > 0 ? currentSummary.expenses.staffSalaries * 0.5 : 0));
    const simulatedExpenses = simulatedGroupSalaries + simulatedRent + 120000;
    const simulatedProfit = simulatedRevenue - simulatedExpenses;

    return {
      baseline: {
        childrenCount: currentForecast.activeChildrenCount,
        expectedRevenue: currentForecast.expectedTotalRevenue,
        expectedExpenses: currentSummary.expenses.totalExpenses,
        profit: Number((currentForecast.expectedTotalRevenue - currentSummary.expenses.totalExpenses).toFixed(2)),
      },
      scenario: {
        simulatedChildrenCount,
        targetChildrenPerGroup,
        simulatedRevenue: Number(simulatedRevenue.toFixed(2)),
        simulatedExpenses: Number(simulatedExpenses.toFixed(2)),
        simulatedProfit: Number(simulatedProfit.toFixed(2)),
      },
      diff: {
        revenueDelta: Number((simulatedRevenue - currentForecast.expectedTotalRevenue).toFixed(2)),
        expensesDelta: Number((simulatedExpenses - currentSummary.expenses.totalExpenses).toFixed(2)),
        profitDelta: Number((simulatedProfit - (currentForecast.expectedTotalRevenue - currentSummary.expenses.totalExpenses)).toFixed(2)),
      },
    };
  }
}
module.exports = new AnalyticsService();