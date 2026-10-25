const { test } = require("node:test");
const assert = require("node:assert/strict");
const proxyquire = require("proxyquire").noCallThru();

function createResponse() {
    return {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
}

test("повертає рекомендації у полі data зі статусом 200", async () => {
    const recommendations = { groups: [], staff: [] };
    const controller = proxyquire(
        "../src/modules/optimization/optimization.controller.js",
        {
            "./optimization.service": {
                getOptimizationRecommendations: async () => recommendations
            }
        }
    );
    const res = createResponse();

    await controller.getRecommendations({}, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { data: recommendations });
});