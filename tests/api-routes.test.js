const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appSource = fs.readFileSync(
    path.join(__dirname, "../src/app.js"),
    "utf8"
);

function countMounts(prefix, routerName) {
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
        `app\\.use\\(\\s*["']${escapedPrefix}["']\\s*,\\s*${routerName}\\s*\\)`,
        "g"
    );

    return [...appSource.matchAll(pattern)].length;
}

test("маршрути Dev2 підключені рівно один раз через /api", () => {
    const routes = [
        ["/api/children", "childrenRoutes"],
        ["/api/rooms", "roomsRoutes"],
        ["/api/staff", "staffRoutes"],
        ["/api/groups", "groupsRoutes"],
        ["/api/activities", "activitiesRoutes"]
    ];

    for (const [prefix, routerName] of routes) {
        assert.equal(
            countMounts(prefix, routerName),
            1,
            `${prefix} має бути підключений один раз`
        );
    }
});

test("старі маршрути Dev2 без /api не підключені", () => {
    const routes = [
        ["/children", "childrenRoutes"],
        ["/rooms", "roomsRoutes"],
        ["/staff", "staffRoutes"],
        ["/groups", "groupsRoutes"]
    ];

    for (const [prefix, routerName] of routes) {
        assert.equal(
            countMounts(prefix, routerName),
            0,
            `${prefix} не має бути підключений`
        );
    }
});