# Forecasts and Scenario Analysis

## 1. Overview

The Forecast API provides revenue forecasting and financial scenario comparison for the kindergarten management system.

The API supports:

- Forecasting expected monthly revenue.
- Comparing alternative group-count scenarios.
- Checking schedule feasibility for each scenario.
- Recommending the most profitable feasible scenario.

All analytics endpoints described in this document require authentication and the `ADMIN` role.

Base path: `/api/analytics`

## 2. Endpoints

| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/api/analytics/revenue-forecast` | Returns the revenue forecast | ADMIN |
| POST | `/api/analytics/scenarios` | Compares financial scenarios and checks schedule feasibility | ADMIN |
| POST | `/api/schedules/generate-draft` | Generates or rechecks a draft schedule independently | ADMIN, MANAGER |

The existing endpoints must be extended rather than duplicated.

## 3. Revenue Forecast

### Request

`GET /api/analytics/revenue-forecast?period=YYYY-MM`

The `period` query parameter is optional.

- If omitted, the API uses the current month.
- If provided, it must match the `YYYY-MM` format.
- Invalid values return HTTP 400.

### Response

The forecast contains:

| Field | Description |
|---|---|
| `activeChildrenCount` | Number of children included in the forecast |
| `expectedTuitionRevenue` | Expected tuition revenue |
| `expectedMealsRevenue` | Expected meal revenue |
| `expectedTotalRevenue` | Total expected revenue |

Monetary values are returned as JSON numbers.

Example:

```json
{
  "activeChildrenCount": 24,
  "expectedTuitionRevenue": 324000,
  "expectedMealsRevenue": 252000,
  "expectedTotalRevenue": 576000
}
```

The values above are illustrative and do not represent actual database results.

## 4. Scenario Comparison

### Request

`POST /api/analytics/scenarios`

The endpoint accepts one comparison request and evaluates several possible group-count variants.

Example:

```json
{
  "scenarioId": "scenario-2026-11-a",
  "period": "2026-11",
  "childrenCount": 36,
  "candidateGroupCounts": [2, 3, 4],
  "tariffPriceChangePercent": 5,
  "discountChangePercent": 0,
  "paymentPlan": "MONTHLY"
}
```

### Request parameters

| Parameter | Required | Description |
|---|---|---|
| `scenarioId` | Yes | Non-empty client-provided string identifying the comparison request. It does not have to be a UUID. Maximum length: 128 characters. |
| `period` | Yes | Forecast month in `YYYY-MM` format. |
| `childrenCount` | Yes | Positive integer representing the number of children in the scenario. |
| `candidateGroupCounts` | Yes | Array of unique candidate group counts. |
| `tariffPriceChangePercent` | No | Simulated tuition tariff change, from -100 to 100. Defaults to 0. |
| `discountChangePercent` | No | Change in discount, expressed in percentage points. Defaults to 0. |
| `paymentPlan` | No | `MONTHLY` or `ANNUAL`. Defaults to `MONTHLY`. |
| `manualGroupDistributions` | No | Explicit distribution of children between groups. |
| `weeklySchedule` | No | Proposed weekly schedule used for feasibility checking. |
| `includedChildIds` | No | Unique IDs of active children included in the scenario. |

### Candidate group counts

- `candidateGroupCounts` must contain between 1 and 20 variants.
- Every group count must be a positive integer.
- Group counts must be unique.
- A group count cannot exceed `childrenCount`.
- No group may contain more than 20 children.
- If no manual distribution is supplied, children are distributed as evenly as possible between groups.

### Manual group distribution

Example:

```json
{
  "manualGroupDistributions": {
    "groupCount": 2,
    "groups": [
      {
        "scenarioGroupKey": "group-a",
        "childIds": ["1", "2", "3"],
        "additionalChildrenCount": 1
      },
      {
        "scenarioGroupKey": "group-b",
        "childIds": ["4", "5", "6"]
      }
    ]
  }
}
```

Rules:

- `groupCount` must be an integer from 1 to 20.
- The number of elements in `groups` must equal `groupCount`.
- Every group must have a unique, non-empty `scenarioGroupKey`.
- `childIds` must contain unique, non-empty strings.
- `additionalChildrenCount` is optional and defaults to 0.
- The total number of children, including additional children, must equal `childrenCount`.
- A group cannot contain more than 20 children.

### Weekly schedule

Each proposed lesson must contain:

- `scenarioGroupKey` — the key of the group from the manual distribution.
- `activityId` — activity identifier.
- `teacherId` — teacher identifier.
- `roomId` — room identifier.
- `day_of_week` — integer from 1 to 7.
- `duration` — positive integer.

The schedule is used for feasibility checking. The scenario API must use the existing schedule service rather than implementing a separate scheduling algorithm.

### Included children

When `includedChildIds` is supplied:

- It must contain unique, non-empty IDs.
- The number of IDs must equal `childrenCount`.
- Only active children may be included.

### Percentage validation

`tariffPriceChangePercent`:

- Must be a finite number.
- Allowed range: -100 to 100.
- Defaults to 0.

`discountChangePercent`:

- Must be a finite number.
- Is expressed in percentage points.
- The resulting personal discount must be between 0% and 30%.
- The discount must not be silently clamped to the allowed range.
- If the resulting discount is invalid for one variant, that variant must be rejected while other variants continue to be evaluated.
- A non-numeric or infinite global parameter rejects the entire request.

### Payment plan

Supported values:

- `MONTHLY` — monthly tuition calculation.
- `ANNUAL` — annual tuition calculation.

For annual payment:

- Apply the 12% annual payment discount after the personal discount.
- The 12% annual discount is not included in the 30% personal discount limit.
- Monthly forecast values are calculated as the annual amount divided by 12.

## 5. Scenario Response

The response contains:

- `scenarioId` — the client-provided comparison identifier.
- `variants` — evaluated scenario variants.
- `recommendedVariantId` — the ID of the recommended variant, or `null`.

Each variant contains:

| Field | Description |
|---|---|
| `variantId` | Unique server-generated identifier of the variant |
| `groupCount` | Number of groups |
| `groupDistribution` | Distribution of children between groups |
| `revenue.tuition` | Tuition revenue |
| `revenue.meals` | Meal revenue |
| `expenses.payroll` | Payroll expenses |
| `expenses.rent` | Rent expenses |
| `expenses.meals` | Meal expenses |
| `accrualProfit` | Revenue minus expenses |
| `schedule.feasible` | Whether the proposed schedule is feasible |
| `schedule.draft` | Generated draft schedule |
| `schedule.unassigned` | Lessons that could not be assigned |

Meal revenue must equal meal expenses.

Monetary values are returned as JSON numbers.

### Recommendation rules

1. Only feasible variants are considered.
2. If feasible variants have positive profit, recommend the one with the highest profit.
3. If all feasible variants are loss-making, recommend the variant with the smallest loss.
4. If no variant is feasible, return `recommendedVariantId: null`.

Scenario calculations must not create persistent scenario records in the database.

## 6. Schedule Draft Generation

### Request

`POST /api/schedules/generate-draft`

Access: `ADMIN`, `MANAGER`.

This endpoint remains available for standalone draft generation and manual schedule recalculation.

Example:

```json
{
  "day_of_week": 1,
  "items": [
    {
      "group_id": 1,
      "activity_id": 1,
      "teacher_id": 1,
      "room_id": 1,
      "duration": 45
    }
  ]
}
```

Validation requirements:

- `day_of_week` must be an integer from 1 to 7.
- `items` must be an array.
- Each item must contain valid identifiers and a positive integer duration.
- Invalid input returns HTTP 400.

The route must use the existing schedule service. It must not implement a second schedule-generation algorithm.

## 7. Financial Calculation Assumptions

Financial calculations must follow the financial rules documented in `docs/FINANCE.md`.

Main assumptions:

- Monthly tuition is based on the applicable `TUITION_MONTHLY` tariff.
- Personal discounts are applied to tuition.
- Meal revenue is calculated using the applicable meal rate for the child's age.
- The standard meal period is 21 working days per month.
- Meal discounts are not applied.
- Group expenses include staff salaries and rent.
- Administrative fixed salaries are included in scenario calculations.
- Annual payment receives an additional 12% discount after the personal discount.

Fallback assumptions must be explicitly documented in the implementation and API response where applicable. This includes missing tariff data, missing meal-rate data, missing age information, empty database results, and assumed additional children.

The API must not silently substitute arbitrary financial values when required data is missing. Any permitted fallback must be visible and clearly identified.

## 8. Access Control

| Endpoint | ADMIN | MANAGER | TEACHER | PARENT |
|---|---|---|---|---|
| GET `/api/analytics/revenue-forecast` | Allow | Deny | Deny | Deny |
| POST `/api/analytics/scenarios` | Allow | Deny | Deny | Deny |
| POST `/api/schedules/generate-draft` | Allow | Allow | Deny | Deny |

Authentication is required for all listed endpoints.

Unauthorized requests return HTTP 401. Authenticated users without the required role receive HTTP 403.

Access permissions must be enforced on the server.

## 9. Error Handling

Validation errors return HTTP 400.

Missing required financial data must produce a controlled error response.

Unexpected errors must be handled by the central error handler.

Responses must not expose:

- Stack traces.
- SQL queries or database error messages.
- Internal database structure.
- Sensitive implementation details.

Standard error format:

```json
{
  "error": {
    "status": 400,
    "message": "Invalid request parameters"
  }
}
```

## 10. Implementation Status and Integration Dependencies

The API route contains validation for the new scenario request structure.

The scenario calculation service must also implement the new contract. The legacy calculation based on `targetGroupsCount` and `targetChildrenPerGroup` is not compatible with the request and response structure described in this document.

Integration depends on:

- Dev 1: financial and payroll calculation logic.
- Dev 3: weekly schedule generation and feasibility checking.
- Dev 4: API validation, request orchestration, response structure, access control, documentation and tests.
- Team Lead: approval of the shared integration contract.

Do not treat the new scenario API as fully integrated until the service implementation and integration tests match this document.

## 11. Related Documentation

- `docs/FINANCE.md` — financial operations, tariffs, discounts and calculation rules.
- `tests/test-cases.md` — API, forecast, scenario and audit test cases.
- `tests/forecast-api.test.js` — automated validation and access-control tests.
- `tests/schedule-draft-api.test.js` — schedule draft validation and access tests.