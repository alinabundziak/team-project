const { Router } = require('express');
const ctrl = require('./pricing.controller');

const router = Router();

const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    if (req.user.role === 'MANAGER') {
        return res.status(403).json({ error: 'Forbidden: Managers have no access to financial routes' });
    }

    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }
    
    
    next();
  };
};

router.get('/pricing-plans', authorize(['ADMIN']), ctrl.getPricingPlans);
router.post('/pricing-plans', authorize(['ADMIN']), ctrl.createPricingPlan);
router.patch('/pricing-plans/:id', authorize(['ADMIN']), ctrl.updatePricingPlan);
router.delete('/pricing-plans/:id', authorize(['ADMIN']), ctrl.deletePricingPlan);

router.get('/meal-rates', authorize(['ADMIN']), ctrl.getMealRates);

router.get('/benefits', authorize(['ADMIN']), ctrl.getBenefits);
router.post('/benefits', authorize(['ADMIN']), ctrl.createBenefit);
router.post('/children/:id/benefits', authorize(['ADMIN']), ctrl.assignBenefit);
router.delete('/children/:id/benefits/:benefitId', authorize(['ADMIN']), ctrl.removeChildBenefit);

router.post('/pricing/calculate', authorize(['ADMIN']), ctrl.calculatePrice);

router.get('/payments', authorize(['ADMIN', 'PARENT']), ctrl.getPayments);
router.get('/payments/:id', authorize(['ADMIN', 'PARENT']), ctrl.getPaymentById);
router.post('/payments', authorize(['ADMIN']), ctrl.createPayment);
router.patch('/payments/:id', authorize(['ADMIN']), ctrl.updatePayment);
router.delete('/payments/:id', authorize(['ADMIN']), ctrl.deletePayment);

router.get('/cost-rules', authorize(['ADMIN']), ctrl.getCostRules);
router.post('/cost-rules', authorize(['ADMIN']), ctrl.createCostRule);
router.patch('/cost-rules/:id', authorize(['ADMIN']), ctrl.updateCostRule);
router.delete('/cost-rules/:id', authorize(['ADMIN']), ctrl.deleteCostRule);

module.exports = router;