## 3. Forecast API Test Cases

**Environment:** Local Node.js server and test database.

| ID | Scenario | Preconditions | Steps | Expected Result | Actual Result | Status | Owner | Retest Result |
|---|---|---|---|---|---|---|---|---|
| FC-001 | Revenue forecast with valid period | ADMIN token; forecast data available | GET `/api/analytics/revenue-forecast?period=2026-11` | Returns forecast for the requested period | Not tested | Not run | Dev4 / QA | Pending |
| FC-002 | Revenue forecast without period | ADMIN token | GET `/api/analytics/revenue-forecast` | Uses the current month by default | Not tested | Not run | Dev4 / QA | Pending |
| FC-003 | Invalid forecast period | ADMIN token | Send invalid period, e.g. `2026-13` | Returns HTTP 400 | Not tested | Not run | Dev4 / QA | Pending |
| FC-004 | Scenario with valid request | ADMIN token | POST `/api/analytics/scenarios` with valid `scenarioId`, `period`, `childrenCount` and `candidateGroupCounts` | Request is accepted | Not tested | Not run | Dev4 / QA | Pending |
| FC-005 | Scenario ID is an ordinary string | ADMIN token | Submit a non-empty string that is not a UUID | Request is accepted | Not tested | Not run | Dev4 / QA | Pending |
| FC-006 | Missing scenario period | ADMIN token | Submit scenario without `period` | Returns HTTP 400 | Not tested | Not run | Dev4 / QA | Pending |
| FC-007 | Invalid scenario period | ADMIN token | Submit invalid `period` | Returns HTTP 400 | Not tested | Not run | Dev4 / QA | Pending |
| FC-008 | Invalid children count | ADMIN token | Submit zero, negative, fractional or string `childrenCount` | Returns HTTP 400 | Not tested | Not run | Dev4 / QA | Pending |
| FC-009 | Invalid candidate group counts | ADMIN token | Submit empty, duplicated, non-integer or out-of-range group counts | Returns HTTP 400 | Not tested | Not run | Dev4 / QA | Pending |
| FC-010 | Group capacity limit | ADMIN token | Submit a variant that would require more than 20 children in a group | Returns HTTP 400 | Not tested | Not run | Dev4 / QA | Pending |
| FC-011 | Too many variants | ADMIN token | Submit more than 20 candidate group counts | Returns HTTP 400 | Not tested | Not run | Dev4 / QA | Pending |
| FC-012 | Tariff change validation | ADMIN token | Submit non-finite or out-of-range `tariffPriceChangePercent` | Returns HTTP 400 | Not tested | Not run | Dev4 / QA | Pending |
| FC-013 | Discount change validation | ADMIN token | Submit non-finite `discountChangePercent` | Returns HTTP 400 | Not tested | Not run | Dev4 / QA | Pending |
| FC-014 | Payment plan validation | ADMIN token | Submit an unsupported `paymentPlan` | Returns HTTP 400 | Not tested | Not run | Dev4 / QA | Pending |
| FC-015 | Manual group distribution validation | ADMIN token | Submit duplicate group keys, invalid child IDs or inconsistent child counts | Returns HTTP 400 | Not tested | Not run | Dev4 / QA | Pending |
| FC-016 | Weekly schedule validation | ADMIN token | Submit invalid day, duration or missing schedule fields | Returns HTTP 400 | Not tested | Not run | Dev4 / QA | Pending |
| FC-017 | Included child IDs validation | ADMIN token | Submit duplicated IDs or a count different from `childrenCount` | Returns HTTP 400 | Not tested | Not run | Dev4 / QA | Pending |
| FC-018 | Scenario access control | MANAGER, TEACHER and PARENT tokens | Submit scenario request | Only ADMIN receives access | Not tested | Not run | Dev4 / QA | Pending |
| FC-019 | Forecast access control | MANAGER, TEACHER and PARENT tokens | Request revenue forecast | Only ADMIN receives access | Not tested | Not run | Dev4 / QA | Pending |
| FC-020 | Scenario response structure | ADMIN token; integrated scenario service | Submit a valid scenario | Response contains `scenarioId`, `variants` and `recommendedVariantId` | Not tested | Not run | Dev4 / QA | Pending |
| FC-021 | Variant financial results | ADMIN token; integrated scenario service | Submit a valid scenario | Each variant contains revenue, expenses and `accrualProfit` | Not tested | Not run | Dev4 / QA | Pending |
| FC-022 | Schedule feasibility | ADMIN token; Dev3 schedule service integrated | Submit a scenario with weekly schedule | Each variant contains feasibility, draft and unassigned results | Not tested | Not run | Dev4 / QA | Pending |
| FC-023 | Scenario recommendation | ADMIN token; several variants available | Submit a scenario with feasible and infeasible variants | Recommends the highest-profit feasible variant, or the least loss-making feasible variant | Not tested | Not run | Dev4 / QA | Pending |
| FC-024 | No feasible variants | ADMIN token; all variants infeasible | Submit a scenario | `recommendedVariantId` is null | Not tested | Not run | Dev4 / QA | Pending |
| FC-025 | Scenario persistence | Test database available | Submit scenario and inspect database | Scenario calculation does not create persistent scenario records | Not tested | Not run | Dev4 / QA | Pending |
| FC-026 | Annual payment calculation | ADMIN token; integrated financial service | Submit scenario with `paymentPlan: "ANNUAL"` | Annual discount is applied after personal discount; monthly forecast equals annual amount divided by 12 | Not tested | Not run | Dev1 / Dev4 | Pending |
| FC-027 | Invalid discount for one variant | ADMIN token; integrated financial service | Submit a request where one variant exceeds the personal discount limit | Invalid variant is rejected while other variants are evaluated | Not tested | Not run | Dev1 / Dev4 | Pending |
| FC-028 | Meal revenue and expenses | ADMIN token; integrated financial service | Submit a valid scenario | Meal revenue equals meal expenses | Not tested | Not run | Dev1 / Dev4 | Pending |
| FC-029 | Draft feasibility recalculation | ADMIN or MANAGER token | POST `/api/schedules/generate-draft` with valid data | Existing schedule service is used for draft generation | Not tested | Not run | Dev3 / Dev4 | Pending |

Forecast and scenario tests must be marked as passed only after the corresponding implementation and integration have been tested.