const prisma = require("../../config/prisma");
const Decimal = require("decimal.js");
const AppError = require("../../utils/AppError");
const { MEAL_DAYS_PER_MONTH } = require("../../config/pricing");
const { getTariffAmount } = require("../tariffs/tariffs.service");
const {
  getKindergartenSalaryEstimate,
  calculateSalary,
} = require("../payroll/payroll.service");

class AnalyticsService {
  async getMealRateByAge(age) {
    try {
      const rate = await prisma.meal_rates.findFirst({
        where: { age: { lte: age } },
        orderBy: [{ age: "desc" }, { valid_from: "desc" }],
      });
      if (rate) {
        return new Decimal(rate.daily_rate.toString());
      }
    } catch (err) {
      console.error("[AnalyticsService] Error getting meal rate:", err.message);
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
        console.error(
          "[AnalyticsService] Error aggregating charges:",
          e.message,
        );
      }

      let paymentsTotal = new Decimal(0);
      try {
        const res = await prisma.payments.aggregate({
          _sum: { paid_amount: true },
          where: dateFilter,
        });
        paymentsTotal = new Decimal(res._sum?.paid_amount?.toString() || 0);
      } catch (e) {
        console.error(
          "[AnalyticsService] Error aggregating payments:",
          e.message,
        );
      }

      let refundsTotal = new Decimal(0);
      try {
        const res = await prisma.refunds.aggregate({
          _sum: { amount: true },
          where: dateFilter,
        });
        refundsTotal = new Decimal(res._sum?.amount?.toString() || 0);
      } catch (e) {
        console.error(
          "[AnalyticsService] Error aggregating refunds:",
          e.message,
        );
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
        console.error("[AnalyticsService] Error fetching groups:", e.message);
      }

      let activeTariff = null;
      try {
        activeTariff = await prisma.tariffs.findFirst({
          where: { code: "TUITION_MONTHLY" },
          orderBy: { valid_from: "desc" },
        });
      } catch (e) {
        console.error(
          "[AnalyticsService] Error fetching active tariff:",
          e.message,
        );
      }

      const baseTuitionPrice = new Decimal(
        activeTariff?.amount?.toString() || 15000,
      );
      const baseDailyMealFee = new Decimal(400);
      const avgRevenuePerChild = baseTuitionPrice
        .mul(0.9)
        .add(baseDailyMealFee.mul(MEAL_DAYS_PER_MONTH));

      const groupsProfitability = groups.map((group) => {
        let groupCharged = new Decimal(0);
        let groupPaid = new Decimal(0);

        for (const child of group.children || []) {
          for (const charge of child.charges || []) {
            groupCharged = groupCharged.add(
              new Decimal(charge.total_amount?.toString() || 0),
            );
          }
          for (const payment of child.payments || []) {
            groupPaid = groupPaid.add(
              new Decimal(payment.paid_amount?.toString() || 0),
            );
          }
        }

        const N = group.children ? group.children.length : 0;
        const teacherSalary = new Decimal(2000)
          .mul(N)
          .add(new Decimal(500).mul(Math.max(0, N - 12)));
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
            occupancyRatio:
              breakEvenChildrenCount > 0 ? N / breakEvenChildrenCount : 0,
          },
        };
      });

      const groupsCount = groups.length;
      let groupSalariesTotal = new Decimal(0);
      for (const group of groups) {
        const N = group.children ? group.children.length : 0;
        const teacherSalary = new Decimal(2000)
          .mul(N)
          .add(new Decimal(500).mul(Math.max(0, N - 12)));
        const assistantSalary = new Decimal(20000);
        groupSalariesTotal = groupSalariesTotal
          .add(teacherSalary)
          .add(assistantSalary);
      }

      let teachersCount = 0;
      try {
        teachersCount = await prisma.employees.count({
          where: { position: "TEACHER" },
        });
      } catch (e) {
        console.error("[AnalyticsService] Error counting teachers:", e.message);
      }

      const teachersSalaries = new Decimal(teachersCount).mul(40000);
      const managerSalary = new Decimal(80000);

      const totalStaffSalaries = groupSalariesTotal
        .add(teachersSalaries)
        .add(managerSalary);
      const rentExpenses = new Decimal(50000).mul(groupsCount);
      const totalExpenses = totalStaffSalaries.add(rentExpenses);

      const accrualProfit = chargesTotal.sub(totalExpenses);
      const cashProfit = actualRevenue.sub(totalExpenses);

      return {
        period: {
          startDate: startDate || "всі дати",
          endDate: endDate || "всі дати",
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
      console.error("[AnalyticsService] Error in getFinancialSummary:", err);
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
        new Decimal(0),
      );

      const totalPaid = child.payments.reduce(
        (acc, p) => acc.add(new Decimal(p.paid_amount?.toString() || 0)),
        new Decimal(0),
      );

      const childRefunds = child.payments.flatMap((p) => p.refunds || []);
      const totalRefunded = childRefunds.reduce(
        (acc, r) => acc.add(new Decimal(r.amount?.toString() || 0)),
        new Decimal(0),
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
          childName:
            `${child.first_name || ""} ${child.last_name || ""}`.trim(),
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
  async getRevenueForecast(period) {
    const now = new Date();
    const forecastPeriod =
      period === undefined || period === null || period === ""
        ? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
        : period;

    if (
      typeof forecastPeriod !== "string" ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(forecastPeriod)
    ) {
      throw new AppError(400, "period має бути у форматі YYYY-MM");
    }

    const periodStart = new Date(`${forecastPeriod}-01T00:00:00.000Z`);

    const tariffAmount = await getTariffAmount("TUITION_MONTHLY", periodStart);

    const baseTuitionPrice = new Decimal(tariffAmount.toString());

    const children = await prisma.children.findMany({
      select: {
        id: true,
        birth_date: true,
        discount_id: true,
        discounts: {
          select: {
            percentage: true,
          },
        },
      },
    });

    let expectedTuitionRevenue = new Decimal(0);
    let expectedMealsRevenue = new Decimal(0);

    for (const child of children) {
      const discountPct = child.discounts
        ? new Decimal(child.discounts.percentage.toString())
        : new Decimal(0);

      const discountMultiplier = new Decimal(1).sub(discountPct.div(100));

      const childTuition = baseTuitionPrice.mul(discountMultiplier);

      expectedTuitionRevenue = expectedTuitionRevenue.add(childTuition);

      const birthDate = new Date(child.birth_date);

      let age = periodStart.getUTCFullYear() - birthDate.getUTCFullYear();

      const monthDifference =
        periodStart.getUTCMonth() - birthDate.getUTCMonth();

      if (
        monthDifference < 0 ||
        (monthDifference === 0 &&
          periodStart.getUTCDate() < birthDate.getUTCDate())
      ) {
        age--;
      }

      const mealRate = await prisma.meal_rates.findFirst({
        where: {
          age: { lte: age },
          OR: [{ valid_from: null }, { valid_from: { lte: periodStart } }],
        },
        orderBy: [{ age: "desc" }, { valid_from: "desc" }],
      });
      if (!mealRate) {
        throw new Error(
          `Не знайдено тариф харчування для дитини ${child.id} (вік: ${age})`,
        );
      }

      const dailyMealRate = new Decimal(mealRate.daily_rate.toString());

      expectedMealsRevenue = expectedMealsRevenue.add(
        dailyMealRate.mul(MEAL_DAYS_PER_MONTH),
      );
    }

    const expectedTotalRevenue =
      expectedTuitionRevenue.add(expectedMealsRevenue);

    return {
      period: forecastPeriod,
      registeredChildrenCount: children.length,

      expectedTuitionRevenue: expectedTuitionRevenue.toFixed(2),

      expectedMealsRevenue: expectedMealsRevenue.toFixed(2),

      expectedTotalRevenue: expectedTotalRevenue.toFixed(2),
    };
  }
  async calculateScenario(scenarioParams = {}) {
    const period = scenarioParams.period;
    const forecast = await this.getRevenueForecast(period);

    const periodValue = forecast.period;
    const periodStart = new Date(`${periodValue}-01T00:00:00.000Z`);

    const children = await prisma.children.findMany({
      select: {
        id: true,
        birth_date: true,
        discount_id: true,
        discounts: {
          select: { percentage: true },
        },
      },
      orderBy: { id: "asc" },
    });

    const currentGroups = await prisma.groups.findMany({
      select: {
        id: true,
        name: true,
        children: { select: { id: true } },
      },
      orderBy: { id: "asc" },
    });

    const toCount = (value, name, allowZero = false) => {
      const number = Number(value);

      if (!Number.isSafeInteger(number) || number < (allowZero ? 0 : 1)) {
        throw new AppError(400, `${name} має бути коректним цілим числом`);
      }

      return number;
    };

    const registeredCount = children.length;

    const groupsCount =
      scenarioParams.targetGroupsCount == null
        ? Math.max(1, currentGroups.length)
        : toCount(scenarioParams.targetGroupsCount, "targetGroupsCount");

    const requestedCount =
      scenarioParams.childrenCount != null
        ? toCount(scenarioParams.childrenCount, "childrenCount", true)
        : scenarioParams.targetChildrenPerGroup != null
          ? toCount(
              scenarioParams.targetChildrenPerGroup,
              "targetChildrenPerGroup",
            ) * groupsCount
          : registeredCount;

    const parsePercent = (value) => {
      try {
        const number = new Decimal(value ?? 0);

        if (!number.isFinite()) {
          throw new Error("Invalid percentage");
        }

        return number;
      } catch {
        throw new AppError(400, "Відсотки змін мають бути числами");
      }
    };

    const tariffChange = parsePercent(scenarioParams.tariffPriceChangePercent);

    const discountChange = parsePercent(scenarioParams.discountChangePercent);
    const paymentPlan = scenarioParams.paymentPlan ?? "MONTHLY";

    if (!["MONTHLY", "ANNUAL"].includes(paymentPlan)) {
      throw new AppError(400, "paymentPlan має бути MONTHLY або ANNUAL");
    }

    const paymentPlanMultiplier =
      paymentPlan === "ANNUAL" ? new Decimal("0.88") : new Decimal(1);

    const baseTariff = new Decimal(
      (await getTariffAmount("TUITION_MONTHLY", periodStart)).toString(),
    );

    const scenarioTariff = baseTariff.mul(
      new Decimal(1).add(tariffChange.div(100)),
    );

    if (scenarioTariff.isNegative()) {
      throw new AppError(400, "Тариф не може бути від’ємним");
    }

    const discountOf = (child) =>
      new Decimal(child.discounts?.percentage?.toString() ?? 0);

    const averageDiscount = registeredCount
      ? children
          .reduce((sum, child) => sum.add(discountOf(child)), new Decimal(0))
          .div(registeredCount)
      : new Decimal(0);

    const validateDiscount = (value) => {
      if (!value.isFinite() || value.lt(0) || value.gt(30)) {
        throw new AppError(
          400,
          "Персональна знижка після зміни має бути в межах 0–30%",
        );
      }

      return value;
    };

    const retainedCount = Math.min(registeredCount, requestedCount);

    const includedChildIds = scenarioParams.includedChildIds;

    if (includedChildIds != null && !Array.isArray(includedChildIds)) {
      throw new AppError(400, "includedChildIds має бути масивом");
    }

    const useAverageForReducedCount =
      requestedCount < registeredCount && includedChildIds == null;

    const selectedChildren =
      includedChildIds == null
        ? null
        : children.filter((child) =>
            includedChildIds.some((id) => String(id) === String(child.id)),
          );

    if (selectedChildren) {
      const uniqueIds = new Set(includedChildIds.map(String));

      if (uniqueIds.size !== includedChildIds.length) {
        throw new AppError(400, "includedChildIds не може містити повторення");
      }

      if (selectedChildren.length !== includedChildIds.length) {
        throw new AppError(400, "Деякі includedChildIds не знайдено");
      }

      if (selectedChildren.length !== requestedCount) {
        throw new AppError(
          400,
          "Кількість includedChildIds має дорівнювати childrenCount",
        );
      }
    }

    const retainedChildren =
      selectedChildren ??
      (useAverageForReducedCount ? [] : children.slice(0, retainedCount));

    const additionalCount = useAverageForReducedCount
      ? requestedCount
      : requestedCount - retainedCount;

    let tuitionRevenue = new Decimal(0);
    let mealRevenue = new Decimal(0);
    let allMealRates = new Decimal(0);

    for (const child of children) {
      const birth = new Date(child.birth_date);
      let age = periodStart.getUTCFullYear() - birth.getUTCFullYear();

      if (
        periodStart.getUTCMonth() < birth.getUTCMonth() ||
        (periodStart.getUTCMonth() === birth.getUTCMonth() &&
          periodStart.getUTCDate() < birth.getUTCDate())
      ) {
        age--;
      }

      const rate = await prisma.meal_rates.findFirst({
        where: {
          age: { lte: age },
          OR: [{ valid_from: null }, { valid_from: { lte: periodStart } }],
        },
        orderBy: [{ age: "desc" }, { valid_from: "desc" }],
      });

      if (!rate) {
        throw new Error(
          `Не знайдено тариф харчування для дитини ${child.id} (вік: ${age})`,
        );
      }

      const dailyRate = new Decimal(rate.daily_rate.toString());
      allMealRates = allMealRates.add(dailyRate);

      if (retainedChildren.includes(child)) {
        const discount = validateDiscount(
          discountOf(child).add(discountChange),
        );

        tuitionRevenue = tuitionRevenue.add(
          scenarioTariff
            .mul(new Decimal(1).sub(discount.div(100)))
            .mul(paymentPlanMultiplier),
        );

        mealRevenue = mealRevenue.add(dailyRate.mul(MEAL_DAYS_PER_MONTH));
      }
    }

    const averageMealRate = registeredCount
      ? allMealRates.div(registeredCount)
      : new Decimal(0);

    if (additionalCount > 0 && registeredCount === 0) {
      throw new AppError(
        400,
        "Для нових дітей потрібно визначити вікову структуру для розрахунку харчування",
      );
    }

    const newChildrenDiscount = validateDiscount(
      averageDiscount.add(discountChange),
    );

    tuitionRevenue = tuitionRevenue.add(
      scenarioTariff
        .mul(additionalCount)
        .mul(new Decimal(1).sub(newChildrenDiscount.div(100)))
        .mul(paymentPlanMultiplier),
    );

    mealRevenue = mealRevenue.add(
      averageMealRate.mul(MEAL_DAYS_PER_MONTH).mul(additionalCount),
    );

    const revenue = tuitionRevenue.add(mealRevenue);

    const baselinePayroll = await getKindergartenSalaryEstimate(currentGroups);

    const baselineSalary = new Decimal(
      baselinePayroll.totalMonthlySalary.toString(),
    );

    const baselineRent = new Decimal(
      baselinePayroll.rentPerGroup.toString(),
    ).mul(currentGroups.length);

    const baselineMeals = new Decimal(forecast.expectedMealsRevenue);

    const baselineExpenses = baselineSalary
      .add(baselineRent)
      .add(baselineMeals);

    const baselineRevenue = new Decimal(forecast.expectedTotalRevenue);
    const baselineProfit = baselineRevenue.sub(baselineExpenses);

    const candidateCounts = scenarioParams.candidateGroupCounts ?? [
      groupsCount,
    ];

    if (!Array.isArray(candidateCounts) || !candidateCounts.length) {
      throw new AppError(
        400,
        "candidateGroupCounts має бути непорожнім масивом",
      );
    }

    const uniqueCounts = [
      ...new Set(
        candidateCounts.map((count) => toCount(count, "candidateGroupCounts")),
      ),
    ];
    if (candidateCounts.length > 20) {
      throw new AppError(400, "Можна передати не більше 20 варіантів груп");
    }

    if (uniqueCounts.length !== candidateCounts.length) {
      throw new AppError(
        400,
        "candidateGroupCounts не може містити повторення",
      );
    }

    for (const count of uniqueCounts) {
      if (count > requestedCount) {
        throw new AppError(
          400,
          `Кількість груп (${count}) не може перевищувати кількість дітей (${requestedCount})`,
        );
      }

      if (requestedCount > count * 20) {
        throw new AppError(
          400,
          `Для ${requestedCount} дітей недостатньо ${count} груп (максимум 20 дітей у групі)`,
        );
      }
    }
    const maxCapacity =
      scenarioParams.maxChildrenPerGroup == null
        ? null
        : toCount(scenarioParams.maxChildrenPerGroup, "maxChildrenPerGroup");

    const feasibility = scenarioParams.feasibilityByGroupCount ?? {};
    const candidates = [];

    for (const count of uniqueCounts) {
      const defaultDistribution = Array.from(
        { length: count },
        (_, index) =>
          Math.floor(requestedCount / count) +
          (index < requestedCount % count ? 1 : 0),
      );

      const manualDistributions = scenarioParams.manualGroupDistributions ?? {};

      const scenarioGroupKey = String(count);

      const customDistribution = manualDistributions[scenarioGroupKey];

      const distribution = customDistribution ?? defaultDistribution;

      if (
        !Array.isArray(distribution) ||
        distribution.length !== count ||
        distribution.some(
          (value) =>
            !Number.isSafeInteger(Number(value)) ||
            Number(value) < 1 ||
            Number(value) > 20,
        )
      ) {
        throw new AppError(400, `Некоректний розподіл дітей для ${count} груп`);
      }

      const counts = distribution.map(Number);

      if (counts.reduce((sum, value) => sum + value, 0) !== requestedCount) {
        throw new AppError(
          400,
          "Сума дітей у групах має дорівнювати childrenCount",
        );
      }
      const salaryExpense = counts.reduce((total, childrenCount) => {
        const educatorSalary = calculateSalary("EDUCATOR", childrenCount);

        const assistantSalary = calculateSalary("ASSISTANT", childrenCount);

        return total.add(educatorSalary).add(assistantSalary);
      }, new Decimal(0));

      const rentExpense = new Decimal(50000).mul(count);

      const mealsExpense = mealRevenue;

      const expenses = salaryExpense.add(rentExpense).add(mealsExpense);

      const profit = revenue.sub(expenses);

      const capacityFeasible =
        maxCapacity == null || counts.every((value) => value <= maxCapacity);

      const scheduleFeasible = Object.prototype.hasOwnProperty.call(
        feasibility,
        count,
      )
        ? feasibility[count] === true
        : null;

      const feasible = capacityFeasible && scheduleFeasible === true;

      candidates.push({
        variantId: `${scenarioParams.scenarioId ?? periodValue}-groups-${count}`,
        groupsCount: count,
        groupDistribution: counts,
        simulatedChildrenCount: requestedCount,
        revenue: {
          tuition: tuitionRevenue.toFixed(2),
          meals: mealRevenue.toFixed(2),
        },
        expenses: {
          payroll: salaryExpense.toFixed(2),
          rent: rentExpense.toFixed(2),
          meals: mealsExpense.toFixed(2),
        },
        expectedRevenue: revenue.toFixed(2),
        payrollExpense: salaryExpense.toFixed(2),
        rentExpense: rentExpense.toFixed(2),
        forecastExpenses: expenses.toFixed(2),
        accrualProfit: profit.toFixed(2),
        status: profit.isNegative() ? "LOSS" : "PROFIT",
        revenueDelta: revenue.sub(baselineRevenue).toFixed(2),
        expensesDelta: expenses.sub(baselineExpenses).toFixed(2),
        profitDelta: profit.sub(baselineProfit).toFixed(2),
        capacityFeasible,
        scheduleFeasible,
        feasible,
      });
    }

    const ranked = candidates
      .filter((candidate) => candidate.feasible)
      .sort((a, b) =>
        new Decimal(b.accrualProfit).comparedTo(new Decimal(a.accrualProfit)),
      );

    const selected = ranked[0] ?? null;

    return {
      scenarioId: scenarioParams.scenarioId ?? null,
      period: periodValue,
      variants: candidates.map((candidate) => ({
        variantId: candidate.variantId,
        groupCount: candidate.groupsCount,
        groupDistribution: candidate.groupDistribution,
        revenue: candidate.revenue,
        expenses: candidate.expenses,
        accrualProfit: candidate.accrualProfit,
        schedule: {
          feasible: null,
          draft: null,
          unassigned: [],
        },
      })),
      assumptions: {
        mealDaysPerMonth: MEAL_DAYS_PER_MONTH,
        hypotheticalChildrenMealRate: "average of registered children",
        hypotheticalChildrenDiscount: newChildrenDiscount.toFixed(2),
        scheduleFeasibilityProvided: candidates.every(
          (candidate) => candidate.scheduleFeasible !== null,
        ),
      },
      baseline: {
        groupsCount: currentGroups.length,
        childrenCount: registeredCount,
        registeredChildrenCount: registeredCount,
        expectedRevenue: baselineRevenue.toFixed(2),
        expectedExpenses: baselineExpenses.toFixed(2),
        profit: baselineProfit.toFixed(2),
      },
      scenario: selected
        ? {
            groupsCount: selected.groupsCount,
            simulatedChildrenCount: selected.simulatedChildrenCount,
            groupDistribution: selected.groupDistribution,
            simulatedRevenue: selected.expectedRevenue,
            simulatedExpenses: selected.forecastExpenses,
            simulatedProfit: selected.accrualProfit,
            payrollExpense: selected.payrollExpense,
            rentExpense: selected.rentExpense,
            accrualProfit: selected.accrualProfit,
            status: selected.status,
          }
        : null,
      diff: selected
        ? {
            revenueDelta: selected.revenueDelta,
            expensesDelta: selected.expensesDelta,
            profitDelta: selected.profitDelta,
          }
        : null,
      groupComparisonScenarios: candidates,
      rankedFeasibleScenarios: ranked,
      recommendedVariantId: selected?.variantId ?? null,
    };
  }

  async getStaffOptimizationRecommendations() {
    let groups = [];
    try {
      groups = await prisma.groups.findMany({
        include: { children: true },
      });
    } catch (e) {
      console.error(
        "[AnalyticsService] Error getting groups for recommendations:",
        e.message,
      );
    }

    const recommendations = groups.map((group) => {
      const N = group.children ? group.children.length : 0;
      let advice;
      let status;

      if (N === 0) {
        status = "UNDERLOADED";
        advice = "Група порожня.";
      } else if (N < 12) {
        status = "UNDERLOADED";
        advice = `У групі ${N} дітей.`;
      } else if (N === 12) {
        status = "OPTIMAL";
        advice = "Оптимальне заповнення.";
      } else {
        status = "HIGH_LOAD";
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
