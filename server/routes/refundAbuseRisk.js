const router = require('express').Router();

router.post('/score', (req, res) => {
  const { refunds90d = 0, chargebacks90d = 0, accountAgeDays = 0, deviceAccounts = 1, highValueReturns = 0 } = req.body || {};
  const score = Math.min(100, Math.round(
    Number(refunds90d) * 7 +
    Number(chargebacks90d) * 12 +
    Math.max(0, 30 - Number(accountAgeDays)) * 0.8 +
    Math.max(0, Number(deviceAccounts) - 1) * 10 +
    Number(highValueReturns) * 9
  ));
  res.json({
    feature: 'refund_abuse_risk',
    score,
    level: score >= 70 ? 'block-review' : score >= 40 ? 'manual-review' : 'normal',
    actions: [
      Number(refunds90d) > 5 && 'Require manual approval for additional refunds.',
      Number(deviceAccounts) > 2 && 'Check shared device graph for linked refund abuse.',
      Number(highValueReturns) > 1 && 'Verify high-value return evidence before payout.',
    ].filter(Boolean),
  });
});

module.exports = router;
