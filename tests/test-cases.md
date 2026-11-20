# QA Test Cases — Kindergarten Management System

## 1. General Information

- **Testing type:** Manual and automated functional testing
- **Environment:** Local Node.js server, PostgreSQL test database
- **Date:** 18.11.2026

## 2. Test Results

| ID | Scenario | Preconditions | Steps | Expected Result | Actual Result | Status | Owner | Retest Result |
|---|---|---|---|---|---|---|---|---|
| TC-001 | GET `/health` | Server is running | Send GET `/health` | JSON response with status `ok` | Received status `ok` and message `Kindergarten server is working` | Passed | QA | Not required |
| TC-002 | GET `/children` | Server is running | Send GET `/children` | Returns a JSON array of children | Received an array with two test records | Passed | QA | Not required |
| TC-003 | `/children` response structure | Children endpoint is available | Inspect returned records | Each record contains an ID, name, and age | These fields are present in both records | Passed | QA | Not required |
| TC-004 | Repeated requests | Server is running | Send multiple requests | Server continues responding | Repeated requests were successful | Passed | QA | Not required |
| TC-005 | Unknown route | Server is running | Send request to an unknown route | Returns HTTP 404 | Received HTTP 404 | Passed | QA | Not required |
| TC-006 | `npm run db:validate` | Dependencies installed | Run `npm run db:validate` | Prisma schema passes validation | Command completed successfully; schema is valid | Passed | QA | Not required |

## 3. Forecast API Test Cases

**Environment:** Local Node.js server and test database.

| ID | Scenario | Preconditions | Steps | Expected Result | Actual Result | Status | Owner | Retest Result |
|---|---|---|---|---|---|---|---|---|
| FC-001 | Revenue forecast with valid period | ADMIN token; forecast data available | GET `/api/analytics/revenue-forecast?period=2026-11` | Returns forecast for the requested month | Not tested | Not run | Dev4 / QA | Pending |
| FC-002 | Revenue forecast without period | ADMIN token | GET `/api/analytics/revenue-forecast` | Uses the current month by default | Not tested | Not run | Dev4 / QA | Pending |
| FC-003 | Invalid forecast period | ADMIN token | Send invalid period, e.g. `2026-13` | Returns HTTP 400 | Not tested | Not run | Dev4 / QA | Pending |
| FC-004 | Scenario without period | ADMIN token; valid scenario data | POST `/api/analytics/scenarios` without `period` | Uses the current month by default | Not tested | Not run | Dev4 / QA | Pending |
| FC-005 | Invalid scenario period | ADMIN token | POST scenario with invalid `period` | Returns HTTP 400 | Not tested | Not run | Dev4 / QA | Pending |
| FC-006 | Invalid target group count | ADMIN token | Submit a group count outside the allowed limits | Returns a validation error | Not tested | Not run | Dev4 / QA | Pending |
| FC-007 | Invalid child distribution | ADMIN token | Submit invalid child distribution | Returns a validation error | Not tested | Not run | Dev4 / QA | Pending |
| FC-008 | Invalid scenario ID | ADMIN token | Submit an invalid scenario identifier | Returns a validation error | Not tested | Not run | Dev4 / QA | Pending |
| FC-009 | Invalid percentage values | ADMIN token | Submit non-finite or out-of-range percentage values | Returns a validation error | Not tested | Not run | Dev4 / QA | Pending |
| FC-010 | Forecast access control | MANAGER, TEACHER and PARENT tokens | Request revenue forecast | Only ADMIN receives access | Not tested | Not run | Dev4 / QA | Pending |
| FC-011 | Scenario access control | MANAGER, TEACHER and PARENT tokens | Submit scenario request | Only ADMIN receives access | Not tested | Not run | Dev4 / QA | Pending |
| FC-012 | Monetary values format | ADMIN token; valid forecast data | Request forecast and scenario | Monetary values are returned as JSON numbers | Not tested | Not run | Dev4 / QA | Pending |
| FC-013 | Missing tariff | Test data without applicable tariff | Request forecast or scenario | Returns a controlled error; no internal database details are exposed | Not tested | Not run | Dev4 / QA | Pending |
| FC-014 | Draft feasibility recalculation | Valid scenario and schedule data | Submit scenario request | Each variant is checked using the schedule service | Not tested | Not run | Dev4 / QA | Pending |
| FC-015 | Scenario ranking | Several feasible variants with different financial results | Submit comparison request | Recommends the highest-profit feasible variant; if all feasible variants are loss-making, recommends the least loss-making one | Not tested | Not run | Dev4 / QA | Pending |
| FC-016 | Scenario persistence | Test database available | Submit scenario request and inspect database | Scenario calculation does not create scenario records in the database | Not tested | Not run | Dev4 / QA | Pending |

## 4. Audit Test Cases

**Environment:** Local Node.js server and separate test database.

| ID | Scenario | Preconditions | Steps | Expected Result | Actual Result | Status | Owner | Retest Result |
|---|---|---|---|---|---|---|---|---|
| AC-001 | Audit event creation | Audit functionality configured | Perform an audited operation | Corresponding audit event is recorded | Not tested | Not run | Dev4 / QA | Pending |
| AC-002 | Audit event data | Audit event exists | Inspect the recorded event | Event contains the required operation information | Not tested | Not run | Dev4 / QA | Pending |
| AC-003 | Audit access control | User without audit permissions | Attempt to access audit data | Access is denied | Not tested | Not run | Dev4 / QA | Pending |
| AC-004 | Audit database integration | Separate test database configured | Execute audit integration test | Audit operation works against the test database | Not tested | Not run | Dev4 / QA | Pending |

## 5. Limitations

- `/children` returns sample data from an in-memory array; integration with the database has not been verified.
- `db:validate` confirms the validity of the Prisma schema but does not verify database connectivity.
- Forecast API test cases are documented but have not yet been executed.
- Audit test cases are documented but have not yet been executed.
- Creating, editing, and deleting records through the general API have not been fully tested.

## 6. Conclusion

The initial manual checks of available routes and Prisma schema validation were successful.

Forecast API and Audit test cases are documented for subsequent implementation and verification. Their results must be updated after the corresponding tests have been executed.