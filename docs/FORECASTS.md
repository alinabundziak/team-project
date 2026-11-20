# Forecasts and Scenario Analysis

## 1. Overview

The Forecast API provides revenue forecasting and financial scenario comparison for the kindergarten management system.

The API supports:

- Forecasting expected monthly revenue.
- Comparing alternative group-count scenarios.
- Checking schedule feasibility for each scenario.
- Recommending the most profitable feasible scenario.

All forecast and scenario endpoints are available only to users with the `ADMIN` role.

Base path: `/api/analytics`

## 2. Endpoints

| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/api/analytics/revenue-forecast` | Returns the revenue forecast for a month | ADMIN |
| POST | `/api/analytics/scenarios` | Compares financial scenarios and checks schedule feasibility | ADMIN |
| POST | `/api/schedules/generate-draft` | Generates or rechecks a draft schedule independently | ADMIN, MANAGER |

The existing endpoints must be extended rather than duplicated.

## 3. Revenue Forecast

### Request

`GET /api/analytics/revenue-forecast?period=YYYY-MM`

The `period` query parameter is optional.

- If omitted, the API uses the current month.
- If provided, it must match the `YYYY-MM` format and represent a valid calendar month.
- Invalid values return HTTP 400.

### Response

The response contains:

| Field | Description |
|---|---|
| `period` | Requested forecast month |
| `registeredChildrenCount` | Number of registered children included in the forecast |
| `expectedTuitionRevenue` | Expected tuition revenue |
| `expectedMealsRevenue` | Expected meal revenue |
| `expectedTotalRevenue` | Total expected revenue |

Monetary values are returned as JSON numbers.

### Example

Request:

`GET /api/analytics/revenue-forecast?period=2026-11`

Example response:

```json
{
  "activeChildrenCount": 24,
  "expectedTuitionRevenue": 324000.00,
  "expectedMealsRevenue": 252000.00,
  "expectedTotalRevenue": 576000.00
}
```

The values above are illustrative and do not represent actual database results.

## 4. Scenario Comparison

### Request

`POST /api/analytics/scenarios`

The endpoint accepts one comparison request and returns multiple group-count variants.

Example request:

```json
{
  "scenarioId": "550e8400-e29b-41d4-a716-446655440000",
  "period": "2026-11",
  "targetGroupsCount": 3,
  "targetChildrenPerGroup": 12,
  "tariffPriceChangePercent": 0,
  "discountChangePercent": 0
}
```

Parameters:

| Parameter | Required | Description |
|---|---|---|
| `period` | No | Forecast month in `YYYY-MM` format; defaults to the current month |
| `targetGroupsCount` | Yes for an explicit comparison | Requested number of groups |
| `targetChildrenPerGroup` | No | Target number of children per group; when provided, must be a positive integer |
| `tariffPriceChangePercent` | No | Simulated percentage change in tuition price |
| `discountChangePercent` | No | Simulated percentage change in the discount |

Validation requirements:

- `period` must be a valid calendar month in `YYYY-MM` format.
- `scenarioId` is required and must be a UUID v4.
- `targetGroupsCount` must be an integer from 1 to 20.
- Each group must contain no more than 20 children.
- `targetChildrenPerGroup`, when provided, must be a positive integer not exceeding 20.
- Percentage values must be finite numbers and must satisfy the approved validation rules.
- The same `scenarioId` identifies all variants within one comparison request.

The validation limits documented above represent the approved API requirements for version 1.

### Scenario response

Each comparison response contains:

- A shared `scenarioId` identifying the comparison request.
- A list of variants.
- A unique variant identifier for each variant.
- Financial results for each variant.
- Schedule feasibility information.
- A recommended variant, when at least one feasible variant exists.

Each variant should include:

| Field | Description |
|---|---|
| `variantId` | Unique identifier of the variant |
| `groupsCount` | Number of groups |
| `childrenCount` | Total simulated children |
| `revenue` | Expected revenue |
| `expenses` | Expected expenses |
| `profit` | Expected financial result |
| `feasibility` | Schedule feasibility result |

Monetary values must be returned as JSON numbers.

Each variant must also include its schedule feasibility status (`isFeasible`).

The response must contain the shared `scenarioId`, all evaluated variants and `recommendedVariantId`.

### Recommendation rules

1. Only feasible variants are considered for recommendation.
2. If at least one feasible variant has a positive profit, recommend the feasible variant with the highest profit.
3. If all feasible variants are loss-making or break even, recommend the feasible variant with the smallest loss (or highest profit).
4. If no variant is feasible, return no recommendation and include feasibility information for each variant.

The API must use the existing schedule service to check each variant. It must not duplicate the schedule generator's business logic.

Scenario calculations are performed without creating persistent scenario records in the database.

## 5. Schedule Draft Generation

### Request

`POST /api/schedules/generate-draft`

Access: `ADMIN`, `MANAGER`.

This endpoint remains available for standalone schedule generation and for rechecking a manually modified scenario variant.

The existing request structure includes:

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

The route must pass the requested group composition to the existing draft-generation service when used for scenario feasibility checks.

The route must not implement a second schedule-generation algorithm.

## 6. Financial Calculation Assumptions

Financial calculations must follow the financial rules documented in `docs/FINANCE.md`.

Main assumptions:

- Monthly tuition is based on the active `TUITION_MONTHLY` tariff.
- Child discounts are applied to tuition.
- Meal revenue is calculated using the applicable meal rate for the child's age.
- The standard meal period is 21 working days per month (`MEAL_DAYS_PER_MONTH = 21`).
- Meal discounts are not applied.
- Group expenses include staff salaries and rent.
- Administrative fixed salaries are included in scenario calculations.

The API must not silently substitute a hardcoded tuition tariff when the applicable tariff is missing.

If the required tariff is unavailable, return a controlled error without exposing database details.

Meal rates must follow the configured rates and the financial rules in `docs/FINANCE.md`.

## 7. Access Control

| Endpoint | ADMIN | MANAGER | TEACHER | PARENT |
|---|---|---|---|---|
| GET `/api/analytics/revenue-forecast` | Allow | Deny | Deny | Deny |
| POST `/api/analytics/scenarios` | Allow | Deny | Deny | Deny |
| POST `/api/schedules/generate-draft` | Allow | Allow | Deny | Deny |

Authentication is required for all listed endpoints.

Unauthorized requests return HTTP 401. Authenticated users without the required role receive HTTP 403.

Access permissions must be enforced on the server.

## 8. Error Handling

Validation errors return HTTP 400.

Missing required financial data must produce a controlled error response.

Unexpected errors must be handled by the central error handler.

Responses must not expose:

- Stack traces.
- SQL queries or database error messages.
- Internal database structure.
- Sensitive implementation details.

The standard error response format is:

```json
{
  "error": {
    "status": 400,
    "message": "Invalid request parameters"
  }
}
```

## 9. Version 1 Limitations

- Forecasts are estimates based on the available financial and child data.
- Scenario comparisons do not create persistent scenario records.
- Schedule feasibility depends on the existing schedule service and its current validation rules.
- Scenario parameter limits must be confirmed by the Team Lead.
- The API does not replace the financial operations API or the schedule management API.
- Financial formulas and schedule-generation logic remain in their respective services.

## 10. Related Documentation

- `docs/FINANCE.md` — financial operations, tariffs, discounts and calculation rules.
- `tests/test-cases.md` — forecast and audit test cases.
- `tests/forecast-api.test.js` — automated API tests for forecast and scenario endpoint validation.
