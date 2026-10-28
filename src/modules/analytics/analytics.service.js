const prisma = require('../../config/prisma');
const Decimal = require('decimal.js');

function calculateAgeInYears(birthDate) {
  if (!birthDate) return 3;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

class AnalyticsService {
  async getMealRateByAge(age) {
    try {
      const rate = await prisma.meal_rates.findFirst({
        where: { age: { lte: age } },
        orderBy: [{ age: 'desc' }, { valid_from: 'desc' }],
      });
      if (rate) {
        return new Decimal(rate.daily_rate.toString());
      }
    } catch (err) {
      console.error('[AnalyticsService] Error getting meal rate:', err.message);
    }

    if (age <= 2) return new Decimal(300);
    if (age === 3) return new Decimal(400);
    if (age === 4) return new Decimal(500);
    return new Decimal(600);
  }

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
        const res = await prisma.charges.aggregate({
          _sum: { total_amount: true },
          where: dateFilter,
        });
        chargesTotal = new Decimal(res._sum?.total_amount?.toString() || 0);
      } catch (e) {
        console.error('[AnalyticsService] Error aggregating charges:', e.message);
      }

      let paymentsTotal = new Decimal(0);
      try {
        const res = await prisma.payments.aggregate({
          _sum: { paid_amount: true },
          where: dateFilter,
        });
        paymentsTotal = new Decimal(res._sum?.paid_amount?.toString() || 0);
      } catch (e) {
        console.error('[AnalyticsService] Error aggregating payments:', e.message);
      }

      let refundsTotal = new Decimal(0);
      try {
        const res = await prisma.refunds.aggregate({
          _sum: { amount: true },
          where: dateFilter,
        });
        refundsTotal = new Decimal(res._sum?.amount?.toString() || 0);
      } catch (e) {
        console.error('[AnalyticsService] Error aggregating refunds:', e.message);
      }

      const actualRevenue = paymentsTotal.sub(refundsTotal);
      const debtCalc = chargesTotal.sub(actualRevenue);
      const totalDebt = debtCalc.isNegative() ? new Decimal(0) : debtCalc;

      let groups = [];
      try {
        groups = await prisma.groups.findMany({
          include: {
            children: {
              include: {
                charges: { where: dateFilter },
                payments: { where: dateFilter },
              },
            },
          },
        });
      } catch (e) {
        console.error('[AnalyticsService] Error fetching groups:', e.message);
      }

      let activeTariff = null;
      try {
        activeTariff = await prisma.tariffs.findFirst({
          where: { code: 'TUITION_MONTHLY' },
          orderBy: { valid_from: 'desc' },
        });
      } catch (e) {
        console.error('[AnalyticsService] Error fetching active tariff:', e.message);
      }

      const baseTuitionPrice = new Decimal(activeTariff?.amount?.toString() || 15000);
      const baseDailyMealFee = new Decimal(400);
      const avgRevenuePerChild = baseTuitionPrice.mul(0.9).add(baseDailyMealFee.mul(21));

      const groupsProfitability = groups.map((group) => {
        let groupCharged = new Decimal(0);
        let groupPaid = new Decimal(0);

        for (const child of group.children || []) {
          for (const charge of child.charges || []) {
            groupCharged = groupCharged.add(new Decimal(charge.total_amount?.toString() || 0));
          }
          for (const payment of child.payments || []) {
            groupPaid = groupPaid.add(new Decimal(payment.paid_amount?.toString() || 0));
          }
        }

        const N = group.children ? group.children.length : 0;
        const teacherSalary = new Decimal(2000).mul(N).add(new Decimal(500).mul(Math.max(0, N - 12)));
        const assistantSalary = new Decimal(20000);
        const groupStaffExpenses = teacherSalary.add(assistantSalary);
        const groupRentExpenses = new Decimal(50000);
        const groupTotalExpenses = groupStaffExpenses.add(groupRentExpenses);

        const breakEvenChildrenCount = avgRevenuePerChild.gt(0)
          ? Math.ceil(groupTotalExpenses.div(avgRevenuePerChild).toNumber())
          : 0;

        return {
          groupId: group.id,
          groupName: group.name,
          childrenCount: N,
          revenue: {
            chargedTotal: groupCharged.toNumber(),
            paidTotal: groupPaid.toNumber(),
          },
          expenses: {
            staff: groupStaffExpenses.toNumber(),
            rent: groupRentExpenses.toNumber(),
            total: groupTotalExpenses.toNumber(),
          },
          profitability: {
            accrualProfit: groupCharged.sub(groupTotalExpenses).toNumber(),
            cashProfit: groupPaid.sub(groupTotalExpenses).toNumber(),
          },
          facilityPayback: {
            monthlyRent: groupRentExpenses.toNumber(),
            breakEvenChildrenCount,
            isPaybackReached: N >= breakEvenChildrenCount,
            occupancyRatio: breakEvenChildrenCount > 0 ? (N / breakEvenChildrenCount) : 0,
          },
        };
      });

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
        teachersCount = await prisma.employees.count({ where: { position: 'TEACHER' } });
      } catch (e) {
        console.error('[AnalyticsService] Error counting teachers:', e.message);
      }

      const teachersSalaries = new Decimal(teachersCount).mul(40000);
      const managerSalary = new Decimal(80000);

      const totalStaffSalaries = groupSalariesTotal.add(teachersSalaries).add(managerSalary);
      const rentExpenses = new Decimal(50000).mul(groupsCount);
      const totalExpenses = totalStaffSalaries.add(rentExpenses);

      const accrualProfit = chargesTotal.sub(totalExpenses);
      const cashProfit = actualRevenue.sub(totalExpenses);

      return {
        period: {
          startDate: startDate || 'всі дати',
          endDate: endDate || 'всі дати',
        },
        revenue: {
          chargesTotal: chargesTotal.toNumber(),
          actualRevenue: actualRevenue.toNumber(),
        },
        totalDebt: totalDebt.toNumber(),
        expenses: {
          isEstimated: true,
          staffSalaries: totalStaffSalaries.toNumber(),
          rentExpenses: rentExpenses.toNumber(),
          totalExpenses: totalExpenses.toNumber(),
        },
        financialResult: {
          accrualProfit: accrualProfit.toNumber(),
          cashProfit: cashProfit.toNumber(),
        },
        groupsProfitability,
      };
    } catch (err) {
      console.error('[AnalyticsService] Error in getFinancialSummary:', err);
      throw err;
    }
  }

  async getDebtsReport() {
    const children = await prisma.children.findMany({
      select: {
        id: true,
        first_name: true,
        last_name: true,
        charges: {
          select: {
            id: true,
            total_amount: true,
            period: true,
          },
        },
        payments: {
          select: {
            id: true,
            paid_amount: true,
            refunds: {
              select: {
                id: true,
                amount: true,
              },
            },
          },
        },
      },
    });

    const debtors = [];
    let totalDebtAmount = new Decimal(0);
    let totalOverdueAmount = new Decimal(0);
    const now = new Date();

    for (const child of children) {
      const totalCharged = child.charges.reduce(
        (acc, c) => acc.add(new Decimal(c.total_amount?.toString() || 0)),
        new Decimal(0)
      );

      const totalPaid = child.payments.reduce(
        (acc, p) => acc.add(new Decimal(p.paid_amount?.toString() || 0)),
        new Decimal(0)
      );

      const childRefunds = child.payments.flatMap((p) => p.refunds || []);
      const totalRefunded = childRefunds.reduce(
        (acc, r) => acc.add(new Decimal(r.amount?.toString() || 0)),
        new Decimal(0)
      );

      const netPaid = totalPaid.sub(totalRefunded);
      const debt = totalCharged.sub(netPaid);

      if (debt.isPositive() && !debt.isZero()) {
        const overdueCharged = child.charges.reduce((acc, c) => {
          const dueDate = c.period ? new Date(c.period) : null;
          if (dueDate && dueDate < now) {
            return acc.add(new Decimal(c.total_amount?.toString() || 0));
          }
          return acc;
        }, new Decimal(0));

        const rawOverdueDebt = overdueCharged.sub(netPaid);
        const overdueDebt = Decimal.max(0, Decimal.min(debt, rawOverdueDebt));

        debtors.push({
          childId: child.id,
          childName: `${child.first_name || ''} ${child.last_name || ''}`.trim(),
          debtAmount: debt.toNumber(),
          overdueDebtAmount: overdueDebt.toNumber(),
          chargesCount: child.charges.length,
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
    let activeTariff = null;
    try {
      activeTariff = await prisma.tariffs.findFirst({
        where: { code: 'TUITION_MONTHLY' },
        orderBy: { valid_from: 'desc' },
      });
    } catch (e) {
      console.error('[AnalyticsService] Error getting tariff for forecast:', e.message);
    }

    const baseTuitionPrice = new Decimal(activeTariff?.amount?.toString() || 15000);
    const WORK_DAYS_PER_MONTH = 21;

    const children = await prisma.children.findMany({
      select: {
        id: true,
        birth_date: true,
        discounts: true,
      },
    });

    let expectedTuitionRevenue = new Decimal(0);
    let expectedMealsRevenue = new Decimal(0);

    for (const child of children) {
      const discountPct = child.discounts
        ? new Decimal(child.discounts.percentage?.toString() || 0)
        : new Decimal(0);

      const discountMultiplier = new Decimal(1).sub(discountPct.div(100));
      const childTuition = baseTuitionPrice.mul(discountMultiplier);
      expectedTuitionRevenue = expectedTuitionRevenue.add(childTuition);

      const age = calculateAgeInYears(child.birth_date);
      const dailyMealRate = await this.getMealRateByAge(age);
      expectedMealsRevenue = expectedMealsRevenue.add(dailyMealRate.mul(WORK_DAYS_PER_MONTH));
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

    const rawGroups = parseInt(scenarioParams.targetGroupsCount, 10);
    let dbGroupsCount = 1;
    try {
      dbGroupsCount = await prisma.groups.count() || 1;
    } catch (e) {
      console.error('[AnalyticsService] Error counting groups:', e.message);
    }
    const targetGroupsCount = (!isNaN(rawGroups) && rawGroups > 0) ? rawGroups : dbGroupsCount;

    const rawTariffChange = parseFloat(scenarioParams.tariffPriceChangePercent);
    const tariffPriceChangePercent = !isNaN(rawTariffChange) ? rawTariffChange : 0;

    const rawDiscountChange = parseFloat(scenarioParams.discountChangePercent);
    const discountChangePercent = !isNaN(rawDiscountChange) ? rawDiscountChange : 0;

    let activeTariff = null;
    try {
      activeTariff = await prisma.tariffs.findFirst({
        where: { code: 'TUITION_MONTHLY' },
        orderBy: { valid_from: 'desc' },
      });
    } catch (e) {
      console.error('[AnalyticsService] Error getting tariff for scenario:', e.message);
    }

    const baseTuitionFromDb = new Decimal(activeTariff?.amount?.toString() || 15000);
    const baseMealFeeFromDb = new Decimal(400);

    const simulatedChildrenCount = targetChildrenPerGroup * targetGroupsCount;

    const currentForecast = await this.getRevenueForecast();
    const currentSummary = await this.getFinancialSummary();

    const baseTuitionPerChild = baseTuitionFromDb.mul(new Decimal(1).add(new Decimal(tariffPriceChangePercent).div(100)));
    const avgDiscount = new Decimal(0.1).add(new Decimal(discountChangePercent).div(100));
    const effectiveDiscount = Decimal.max(0, avgDiscount);

    const simTuitionTotal = new Decimal(simulatedChildrenCount)
      .mul(baseTuitionPerChild)
      .mul(new Decimal(1).sub(effectiveDiscount));

    const simMealsTotal = new Decimal(simulatedChildrenCount).mul(baseMealFeeFromDb).mul(21);
    const simulatedRevenue = simTuitionTotal.add(simMealsTotal);

    const N = targetChildrenPerGroup;
    const teacherSalaryPerGroup = new Decimal(2000).mul(N).add(new Decimal(500).mul(Math.max(0, N - 12)));
    const assistantSalaryPerGroup = new Decimal(20000);
    const simulatedGroupSalaries = teacherSalaryPerGroup.add(assistantSalaryPerGroup).mul(targetGroupsCount);

    const simulatedRent = new Decimal(50000).mul(targetGroupsCount);
    const adminFixedSalaries = new Decimal(120000);
    const simulatedExpenses = simulatedGroupSalaries.add(simulatedRent).add(adminFixedSalaries);

    const simulatedProfit = simulatedRevenue.sub(simulatedExpenses);
    const baselineRevenue = new Decimal(currentForecast.expectedTotalRevenue);
    const baselineExpenses = new Decimal(currentSummary.expenses.totalExpenses);
    const baselineProfit = baselineRevenue.sub(baselineExpenses);

    const alternativeScenarios = [targetGroupsCount - 1, targetGroupsCount + 1]
      .filter((g) => g > 0)
      .map((gCount) => {
        const totalKids = targetChildrenPerGroup * gCount;
        const tuition = new Decimal(totalKids).mul(baseTuitionPerChild).mul(new Decimal(1).sub(effectiveDiscount));
        const meals = new Decimal(totalKids).mul(baseMealFeeFromDb).mul(21);
        const rev = tuition.add(meals);
        const salaries = teacherSalaryPerGroup.add(assistantSalaryPerGroup).mul(gCount);
        const rent = new Decimal(50000).mul(gCount);
        const exp = salaries.add(rent).add(adminFixedSalaries);
        return {
          groupsCount: gCount,
          simulatedChildrenCount: totalKids,
          simulatedRevenue: rev.toNumber(),
          simulatedExpenses: exp.toNumber(),
          simulatedProfit: rev.sub(exp).toNumber(),
        };
      });

    return {
      baseline: {
        groupsCount: dbGroupsCount,
        childrenCount: currentForecast.activeChildrenCount,
        expectedRevenue: baselineRevenue.toNumber(),
        expectedExpenses: baselineExpenses.toNumber(),
        profit: baselineProfit.toNumber(),
      },
      scenario: {
        groupsCount: targetGroupsCount,
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
      groupComparisonScenarios: alternativeScenarios,
    };
  }

  async getStaffOptimizationRecommendations() {
    let groups = [];
    try {
      groups = await prisma.groups.findMany({
        include: { children: true },
      });
    } catch (e) {
      console.error('[AnalyticsService] Error getting groups for recommendations:', e.message);
    }

    const recommendations = groups.map((group) => {
      const N = group.children ? group.children.length : 0;
      let advice = '';
      let status = 'OPTIMAL';

      if (N === 0) {
        status = 'UNDERLOADED';
        advice = 'Група порожня.';
      } else if (N < 12) {
        status = 'UNDERLOADED';
        advice = `У групі ${N} дітей.`;
      } else if (N === 12) {
        status = 'OPTIMAL';
        advice = 'Оптимальне заповнення.';
      } else {
        status = 'HIGH_LOAD';
        advice = `У групі ${N} дітей.`;
      }

      return {
        groupId: group.id,
        groupName: group.name,
        childrenCount: N,
        status,
        recommendation: advice,
      };
    });

    return {
      totalGroupsCount: groups.length,
      recommendations,
    };
  }
}

module.exports = new AnalyticsService();