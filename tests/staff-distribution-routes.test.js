
const { test } = require("node:test");
const assert = require("node:assert/strict");
const proxyquire = require("proxyquire").noCallThru();

const registeredRoutes = [];
const usedMiddleware = [];
const mockController = {
    getStaff: () => {},
    getStaffById: () => {},
    createStaff: () => {},
    updateStaff: () => {},
    deleteStaff: () => {},
    getSalaryEstimates: () => {},
    getStaffDistributionAnalysis: () => {}
};

const routerMock = {
    use(...middleware) {
        usedMiddleware.push(...middleware);
    },

    get(path, handler) {
        registeredRoutes.push({ method: "GET", path, handler });
    },

    post(path, handler) {
        registeredRoutes.push({ method: "POST", path, handler });
    },

    patch(path, handler) {
        registeredRoutes.push({ method: "PATCH", path, handler });
    },

    delete(path, handler) {
        registeredRoutes.push({ method: "DELETE", path, handler });
    }
};

const authenticate = () => {};
const authorizeRoles = (...roles) => {
    authorizeRoles.receivedRoles = roles;
    return () => {};
};

proxyquire("../src/modules/employees/staff.routes.js", {
    express: {
        Router: () => routerMock
    },
    "./staff.controller": mockController,
    "../../middleware/authenticate": authenticate,
    "../../middleware/authorizeRoles": authorizeRoles,
    "../../config/roles": {
        ROLES: {
            ADMIN: "ADMIN",
            MANAGER: "MANAGER"
        }
    }
});

test("маршрут аналізу зареєстрований перед маршрутом з ID", () => {
    const analysisIndex = registeredRoutes.findIndex(
        route =>
            route.method === "GET" &&
            route.path === "/distribution-analysis"
    );

    const idIndex = registeredRoutes.findIndex(
        route => route.method === "GET" && route.path === "/:id"
    );

    assert.notEqual(analysisIndex, -1);
    assert.notEqual(idIndex, -1);
    assert.ok(analysisIndex < idIndex);

    assert.equal(
        registeredRoutes[analysisIndex].handler,
        mockController.getStaffDistributionAnalysis
    );
});

test("маршрут зберігає middleware автентифікації та ролей", () => {
    assert.ok(usedMiddleware.includes(authenticate));

    assert.deepEqual(
        authorizeRoles.receivedRoles,
        ["ADMIN", "MANAGER"]
    );

    assert.ok(usedMiddleware.length >= 2);
});
