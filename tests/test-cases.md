\# QA Test Cases — Kindergarten Management System



\## 1. General Information



\- \*\*Testing type:\*\* Manual functional testing

\- \*\*Environment:\*\* Local Node.js server

\- \*\*Date:\*\* 13.10.2026



\## 2. Test Results



| ID | Scenario | Expected Result | Actual Result | Status |

|---|---|---|---|---|

| TC-001 | GET `/health` | Server returns JSON with status `ok` | Received status `ok` and message `Kindergarten server is working` | Passed |

| TC-002 | GET `/children` | Returns a JSON array of children | Received an array with two test records | Passed |

| TC-003 | `/children` response structure | Each record contains an ID, name, and age | These fields are present in both records | Passed |

| TC-004 | Repeated requests | Server continues responding after multiple requests | Repeated requests were successful | Passed |

| TC-005 | Unknown route | Returns HTTP 404 | Received HTTP 404 and message `Cannot GET /route-that-does-not-exist` | Passed |

| TC-006 | `npm run db:validate` | Prisma schema passes validation | Command completed successfully; schema is valid | Passed |

| TC-007 | `npm test` | Automated tests run | The `test` script is not configured in `package.json` | Not configured |



\## 3. Limitations



\- `/children` returns sample data from an in-memory array; integration with the database has not been verified.

\- `db:validate` confirms the validity of the Prisma schema but does not verify database connectivity.

\- Automated tests are not currently configured; the `npm test` command is unavailable.

\- Creating, editing, and deleting records have not been tested.



\## 4. Conclusion



The primary manual checks of available routes, repeated requests, and Prisma schema validity were successful. Automated testing requires separate configuration. The results pertain to checks performed in a local environment.

