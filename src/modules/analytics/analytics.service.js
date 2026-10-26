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
        if (prisma.charge) {
          const res = await prisma.charge.aggregate({
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
        if (prisma.payment) {
          const res = await prisma.payment.aggregate({
            _sum: { amount: true },
            where: dateFilter,
          });
          paymentsTotal = new Decimal(res?._sum?.amount?.toString() || 0);
        }
      } catch (e) {
        paymentsTotal = new Decimal(0);
      }

      let refundsTotal = new Decimal(0);
      try {
        if (prisma.refund) {
          const res = await prisma.refund.aggregate({
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
        if (prisma.group) {
          groups = await prisma.group.findMany({
            include: {
              children: {
                include: {
                  charges: { where: dateFilter },
                  payments: { where: dateFilter },
                },
              },
            },
          });
        }
      } catch (e) {
        groups = [];
      }

      const activeTariff = await prisma.tariff?.findFirst({
        where: { code: 'TUITION_MONTHLY' },
        orderBy: { valid_from: 'desc' },
      }).catch(() => null);

      const activeMealRate = await prisma.mealRate?.findFirst({
        orderBy: { daily_rate: 'desc' },
      }).catch(() => null);

      const baseTuitionPrice = new Decimal(activeTariff?.amount?.toString() || 15000);
      const baseDailyMealFee = new Decimal(activeMealRate?.daily_rate?.toString() || 400);
      const avgRevenuePerChild = baseTuitionPrice.mul(0.9).add(baseDailyMealFee.mul(22));

      const groupsProfitability = groups.map((group) => {
        let groupCharged = new Decimal(0);
        let groupPaid = new Decimal(0);

        for (const child of group.children || []) {
          for (const charge of child.charges || []) {
            groupCharged = groupCharged.add(new Decimal(charge.total_amount?.toString() || 0));
          }
          for (const payment of child.payments || []) {
            groupPaid = groupPaid.add(new Decimal(payment.amount?.toString() || 0));
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
        if (prisma.employee) {
          teachersCount = await prisma.employee.count({ where: { position: 'TEACHER' } });
        }
      } catch (e) {
        teachersCount = 0;
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
      console.error("Error in getFinancialSummary:", err);
      throw err;
    }
  }

  async getDebtsReport() {
    const children = await prisma.child.findMany({
      include: {
        charges: true,
        payments: true,
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
        (acc, p) => acc.add(new Decimal(p.amount?.toString() || 0)),
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
    const activeTariff = await prisma.tariff?.findFirst({
      where: { code: 'TUITION_MONTHLY' },
      orderBy: { valid_from: 'desc' },
    }).catch(() => null);

    const activeMealRate = await prisma.mealRate?.findFirst({
      orderBy: { daily_rate: 'desc' },
    }).catch(() => null);

    const baseTuitionPrice = new Decimal(activeTariff?.amount?.toString() || 15000);
    const baseDailyMealFee = new Decimal(activeMealRate?.daily_rate?.toString() || 400);

    const children = await prisma.child.findMany({
      include: {
        discount: true,
      },
    });

    let expectedTuitionRevenue = new Decimal(0);
    let expectedMealsRevenue = new Decimal(0);

    const WORK_DAYS_PER_MONTH = 22;

    for (const child of children) {
      const discountPct = child.discount ? new Decimal(child.discount.percent?.toString() || 0) : new Decimal(0);
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

    const rawGroups = parseInt(scenarioParams.targetGroupsCount, 10);
    const dbGroupsCount = await prisma.group.count().catch(() => 1);
    const targetGroupsCount = (!isNaN(rawGroups) && rawGroups > 0) ? rawGroups : (dbGroupsCount || 1);

    const rawTariffChange = parseFloat(scenarioParams.tariffPriceChangePercent);
    const tariffPriceChangePercent = !isNaN(rawTariffChange) ? rawTariffChange : 0;

    const rawDiscountChange = parseFloat(scenarioParams.discountChangePercent);
    const discountChangePercent = !isNaN(rawDiscountChange) ? rawDiscountChange : 0;

    const activeTariff = await prisma.tariff?.findFirst({
      where: { code: 'TUITION_MONTHLY' },
      orderBy: { valid_from: 'desc' },
    }).catch(() => null);

    const activeMealRate = await prisma.mealRate?.findFirst({
      orderBy: { daily_rate: 'desc' },
    }).catch(() => null);

    const baseTuitionFromDb = new Decimal(activeTariff?.amount?.toString() || 15000);
    const baseMealFeeFromDb = new Decimal(activeMealRate?.daily_rate?.toString() || 400);

    const simulatedChildrenCount = targetChildrenPerGroup * targetGroupsCount;

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
        const meals = new Decimal(totalKids).mul(baseMealFeeFromDb).mul(22);
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
      if (prisma.group) {
        groups = await prisma.group.findMany({
          include: { children: true },
        });
      }
    } catch (e) {
      groups = [];
    }

    const recommendations = groups.map((group) => {
      const N = group.children ? group.children.length : 0;
      let advice = '';
      let status = 'OPTIMAL';

      if (N === 0) {
        status = 'UNDERLOADED';
        advice = 'Група порожня. Рекомендується об’єднати або призупинити утримання штатних одиниць.';
      } else if (N < 12) {
        status = 'UNDERLOADED';
        advice = `У групі ${N} дітей. Рекомендується докомплектувати групу до 12 дітей — це збільшить дохід без підвищеної надбавки вихователю за понаднормових дітей.`;
      } else if (N === 12) {
        status = 'OPTIMAL';
        advice = 'Група має оптимальне заповнення (12 дітей). Зарплатне навантаження вихователя найбільш збалансоване.';
      } else {
        status = 'HIGH_LOAD';
        advice = `У групі ${N} дітей (понаднормово). Додано змінні виплати вихователю. Якщо кількість дітей досягне 20+, рекомендовано сформувати додаткову групу.`;
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