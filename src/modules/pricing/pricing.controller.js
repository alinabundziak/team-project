const { PricingService } = require('./pricing.service');

const handleError = (res, error, fallbackMsg) => {
    const status = [400, 401, 403, 404, 409].includes(error?.status) ? error.status : 400;
    return res.status(status).json({ error: error?.message || fallbackMsg });
};

const createPricingPlan = async (req, res) => {
    try {
        const plan = await PricingService.createPricingPlan(req.body);
        return res.status(201).json(plan);
    } catch (e) { return handleError(res, e, 'Error creating pricing plan'); }
};

const getPricingPlans = async (req, res) => {
    try {
        const plans = await PricingService.getPricingPlans();
        return res.status(200).json(plans);
    } catch (e) { return handleError(res, e, 'Error fetching pricing plans'); }
};

const updatePricingPlan = async (req, res) => {
    try {
        const plan = await PricingService.updatePricingPlan(req.params.id, req.body);
        return res.status(200).json(plan);
    } catch (e) { return handleError(res, e, 'Error updating pricing plan'); }
};

const deletePricingPlan = async (req, res) => {
    try {
        await PricingService.deletePricingPlan(req.params.id);
        return res.status(200).json({ message: 'Pricing plan deleted successfully' });
    } catch (e) { return handleError(res, e, 'Error deleting pricing plan'); }
};

const getMealRates = async (req, res) => {
    try {
        const rates = await PricingService.getMealRates();
        return res.status(200).json(rates);
    } catch (e) { return handleError(res, e, 'Failed to fetch meal rates'); }
};

const getBenefits = async (req, res) => {
    try {
        const benefits = await PricingService.getBenefits();
        return res.status(200).json(benefits);
    } catch (e) { return handleError(res, e, 'Failed to fetch benefits'); }
};

const createBenefit = async (req, res) => {
    try {
        const benefit = await PricingService.createBenefit(req.body);
        return res.status(201).json(benefit);
    } catch (e) { return handleError(res, e, 'Error creating benefit'); }
};

const assignBenefit = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedChild = await PricingService.assignBenefitToChild(id, req.body);
        return res.status(200).json(updatedChild);
    } catch (e) { return handleError(res, e, 'Error assigning benefit'); }
};

const removeChildBenefit = async (req, res) => {
    try {
        await PricingService.removeChildBenefit(req.params.id, req.params.benefitId);
        return res.status(200).json({ message: 'Child benefit removed successfully' });
    } catch (e) { return handleError(res, e, 'Error removing child benefit'); }
};

const calculatePrice = async (req, res) => {
    try {
        const result = await PricingService.calculateTuition(req.body);
        return res.status(200).json(result);
    } catch (e) { return handleError(res, e, 'Error calculating price'); }
};

const createPayment = async (req, res) => {
    try {
        const payment = await PricingService.createPayment(req.body);
        return res.status(201).json(payment);
    } catch (e) { return handleError(res, e, 'Error creating payment'); }
};

const getPayments = async (req, res) => {
    try {
        const payments = await PricingService.getPayments(req.user);
        return res.status(200).json(payments);
    } catch (e) { return handleError(res, e, 'Error fetching payments'); }
};

const getPaymentById = async (req, res) => {
    try {
        const payment = await PricingService.getPaymentById(req.params.id);
        return res.status(200).json(payment);
    } catch (e) { return handleError(res, e, 'Error fetching payment'); }
};

const updatePayment = async (req, res) => {
    try {
        const payment = await PricingService.updatePayment(req.params.id, req.body);
        return res.status(200).json(payment);
    } catch (e) { return handleError(res, e, 'Error updating payment'); }
};

const deletePayment = async (req, res) => {
    try {
        await PricingService.deletePayment(req.params.id);
        return res.status(200).json({ message: 'Payment deleted successfully' });
    } catch (e) { return handleError(res, e, 'Error deleting payment'); }
};

const getCostRules = async (req, res) => {
    try {
        const rules = await PricingService.getCostRules();
        return res.status(200).json(rules);
    } catch (e) { return handleError(res, e, 'Failed to fetch cost rules'); }
};

const createCostRule = async (req, res) => {
    try {
        const rule = await PricingService.createCostRule(req.body);
        return res.status(201).json(rule);
    } catch (e) { return handleError(res, e, 'Invalid data for creating cost rule'); }
};

const updateCostRule = async (req, res) => {
    try {
        const rule = await PricingService.updateCostRule(req.params.id, req.body);
        return res.status(200).json(rule);
    } catch (e) { return handleError(res, e, 'Error updating cost rule'); }
};

const deleteCostRule = async (req, res) => {
    try {
        await PricingService.deleteCostRule(req.params.id);
        return res.status(200).json({ message: 'Cost rule deleted successfully' });
    } catch (e) { return handleError(res, e, 'Error deleting cost rule'); }
};

module.exports = {
    createPricingPlan,
    getPricingPlans,
    updatePricingPlan,
    deletePricingPlan,
    getMealRates,
    getBenefits,
    createBenefit,
    assignBenefit,
    removeChildBenefit,
    calculatePrice,
    createPayment,
    getPayments,
    getPaymentById,
    updatePayment,
    deletePayment,
    getCostRules,
    createCostRule,
    updateCostRule,
    deleteCostRule
};