
const express = require("express");
const router = express.Router();

const analyticsController = require("./analytics.controller");
const authenticate = require("../../middleware/authenticate");
const authorizeRoles = require("../../middleware/authorizeRoles");
const { ROLES } = require("../../config/roles");
const { validateDateQuery } = require("../../middleware/validate");
const AppError = require("../../utils/AppError");

const adminOnly = [authenticate, authorizeRoles(ROLES.ADMIN)];

function getCurrentPeriod() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `${now.getFullYear()}-${month}`;
}

function isValidPeriod(period) {
  return (
    typeof period === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(period)
  );
}

function isObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasUniqueStrings(values) {
  return (
    Array.isArray(values) &&
    values.every(isNonEmptyString) &&
    new Set(values).size === values.length
  );
}

function validateForecastPeriod(req, res, next) {
  try {
    const period =
      req.query.period === undefined
        ? getCurrentPeriod()
        : req.query.period;

    if (!isValidPeriod(period)) {
      throw new AppError(400, "period має бути у форматі YYYY-MM");
    }

    req.forecastPeriod = period;
    next();
  } catch (error) {
    next(error);
  }
}

function validateManualGroupDistributions(distributions, childrenCount) {
  if (!isObject(distributions)) {
    throw new AppError(
      400,
      "manualGroupDistributions має бути JSON-об'єктом"
    );
  }

  const { groupCount, groups } = distributions;

  if (
    !Number.isInteger(groupCount) ||
    groupCount < 1 ||
    groupCount > 20
  ) {
    throw new AppError(
      400,
      "manualGroupDistributions.groupCount має бути цілим числом від 1 до 20"
    );
  }

  if (!Array.isArray(groups) || groups.length !== groupCount) {
    throw new AppError(
      400,
      "Кількість груп у manualGroupDistributions має відповідати groupCount"
    );
  }

  const groupKeys = new Set();
  let distributedChildrenCount = 0;

  for (const group of groups) {
    if (!isObject(group)) {
      throw new AppError(400, "Кожна група має бути JSON-об'єктом");
    }

    if (!isNonEmptyString(group.scenarioGroupKey)) {
      throw new AppError(
        400,
        "Кожна група повинна мати непорожній scenarioGroupKey"
      );
    }

    if (groupKeys.has(group.scenarioGroupKey)) {
      throw new AppError(
        400,
        "scenarioGroupKey не повинні повторюватися"
      );
    }

    groupKeys.add(group.scenarioGroupKey);

    if (!hasUniqueStrings(group.childIds)) {
      throw new AppError(
        400,
        "childIds має бути масивом унікальних непорожніх рядків"
      );
    }

    const additionalChildrenCount =
      group.additionalChildrenCount === undefined
        ? 0
        : group.additionalChildrenCount;

    if (
      !Number.isInteger(additionalChildrenCount) ||
      additionalChildrenCount < 0
    ) {
      throw new AppError(
        400,
        "additionalChildrenCount має бути невід'ємним цілим числом"
      );
    }

    const groupChildrenCount =
      group.childIds.length + additionalChildrenCount;

    if (groupChildrenCount > 20) {
      throw new AppError(
        400,
        "Кількість дітей у групі не може перевищувати 20"
      );
    }

    distributedChildrenCount += groupChildrenCount;
  }

  if (distributedChildrenCount !== childrenCount) {
    throw new AppError(
      400,
      "Загальна кількість дітей у ручному розподілі має відповідати childrenCount"
    );
  }
}

function validateWeeklySchedule(weeklySchedule) {
  if (!Array.isArray(weeklySchedule)) {
    throw new AppError(400, "weeklySchedule має бути масивом");
  }

  for (const lesson of weeklySchedule) {
    if (!isObject(lesson)) {
      throw new AppError(
        400,
        "Кожне заняття у weeklySchedule має бути JSON-об'єктом"
      );
    }

    if (!isNonEmptyString(lesson.scenarioGroupKey)) {
      throw new AppError(
        400,
        "Заняття повинно мати непорожній scenarioGroupKey"
      );
    }

    if (
      !isNonEmptyString(lesson.activityId) ||
      !isNonEmptyString(lesson.teacherId) ||
      !isNonEmptyString(lesson.roomId)
    ) {
      throw new AppError(
        400,
        "Заняття повинно містити activityId, teacherId та roomId"
      );
    }

    if (
      !Number.isInteger(lesson.day_of_week) ||
      lesson.day_of_week < 1 ||
      lesson.day_of_week > 7
    ) {
      throw new AppError(
        400,
        "day_of_week має бути цілим числом від 1 до 7"
      );
    }

    if (
      !Number.isInteger(lesson.duration) ||
      lesson.duration <= 0
    ) {
      throw new AppError(
        400,
        "duration має бути додатним цілим числом"
      );
    }
  }
}

function validateScenarioPeriod(req, res, next) {
  try {
    if (!isObject(req.body)) {
      throw new AppError(400, "Тіло запиту має бути JSON-об'єктом");
    }

    const {
      scenarioId,
      period,
      childrenCount,
      candidateGroupCounts,
    } = req.body;

    if (!isNonEmptyString(scenarioId)) {
      throw new AppError(
        400,
        "scenarioId має бути непорожнім рядком"
      );
    }

    if (scenarioId.length > 128) {
      throw new AppError(
        400,
        "scenarioId не може перевищувати 128 символів"
      );
    }

    if (!isValidPeriod(period)) {
      throw new AppError(
        400,
        "period є обов'язковим і має бути у форматі YYYY-MM"
      );
    }

    if (!Number.isInteger(childrenCount) || childrenCount < 1) {
      throw new AppError(
        400,
        "childrenCount має бути додатним цілим числом"
      );
    }

    if (
      !Array.isArray(candidateGroupCounts) ||
      candidateGroupCounts.length < 1 ||
      candidateGroupCounts.length > 20
    ) {
      throw new AppError(
        400,
        "candidateGroupCounts має містити від 1 до 20 варіантів"
      );
    }

    if (
      !candidateGroupCounts.every(
        (count) =>
          Number.isInteger(count) &&
          count >= 1 &&
          count <= 20 &&
          count <= childrenCount &&
          Math.ceil(childrenCount / count) <= 20
      )
    ) {
      throw new AppError(
        400,
        "Кожна кількість груп має бути цілим числом від 1 до 20, не перевищувати childrenCount та забезпечувати не більше 20 дітей у групі"
      );
    }

    if (new Set(candidateGroupCounts).size !== candidateGroupCounts.length) {
      throw new AppError(
        400,
        "candidateGroupCounts не повинен містити повторень"
      );
    }

    const tariffPriceChangePercent =
      req.body.tariffPriceChangePercent === undefined
        ? 0
        : req.body.tariffPriceChangePercent;

    if (
      typeof tariffPriceChangePercent !== "number" ||
      !Number.isFinite(tariffPriceChangePercent) ||
      tariffPriceChangePercent < -100 ||
      tariffPriceChangePercent > 100
    ) {
      throw new AppError(
        400,
        "tariffPriceChangePercent має бути скінченним числом від -100 до 100"
      );
    }

    const discountChangePercent =
      req.body.discountChangePercent === undefined
        ? 0
        : req.body.discountChangePercent;

    if (
      typeof discountChangePercent !== "number" ||
      !Number.isFinite(discountChangePercent)
    ) {
      throw new AppError(
        400,
        "discountChangePercent має бути скінченним числом"
      );
    }

    const paymentPlan =
      req.body.paymentPlan === undefined
        ? "MONTHLY"
        : req.body.paymentPlan;

    if (!["MONTHLY", "ANNUAL"].includes(paymentPlan)) {
      throw new AppError(
        400,
        "paymentPlan має бути MONTHLY або ANNUAL"
      );
    }

    if (req.body.includedChildIds !== undefined) {
      if (
        !hasUniqueStrings(req.body.includedChildIds) ||
        req.body.includedChildIds.length !== childrenCount
      ) {
        throw new AppError(
          400,
          "includedChildIds має містити унікальні ID дітей у кількості, що відповідає childrenCount"
        );
      }
    }

    if (req.body.manualGroupDistributions !== undefined) {
      validateManualGroupDistributions(
        req.body.manualGroupDistributions,
        childrenCount
      );
    }

    if (req.body.weeklySchedule !== undefined) {
      validateWeeklySchedule(req.body.weeklySchedule);
    }

    req.body.tariffPriceChangePercent = tariffPriceChangePercent;
    req.body.discountChangePercent = discountChangePercent;
    req.body.paymentPlan = paymentPlan;

    next();
  } catch (error) {
    next(error);
  }
}

router.get(
  "/financial-summary",
  validateDateQuery,
  ...adminOnly,
  analyticsController.getFinancialSummary
);

router.get("/debts", ...adminOnly, analyticsController.getDebts);

router.get(
  "/revenue-forecast",
  ...adminOnly,
  validateForecastPeriod,
  analyticsController.getRevenueForecast
);

router.post(
  "/scenarios",
  ...adminOnly,
  validateScenarioPeriod,
  analyticsController.runScenario
);

router.get(
  "/staff-optimization",
  ...adminOnly,
  analyticsController.getStaffOptimization
);

module.exports = router;
