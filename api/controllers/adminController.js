// Profit Simulation Controller for /api/admin/simulate
exports.simulateProfit = (req, res) => {
  try {
    const {
      product_price,
      referral_chain_length,
      company_fee_percent,
      platform_fee_percent,
      referrer_percent,
      discount_percent,
    } = req.body;

    const total_revenue = product_price * referral_chain_length;
    const company_gross_profit = total_revenue * (company_fee_percent / 100);
    const referrer_earnings = total_revenue * (referrer_percent / 100);
    const referred_discounts = total_revenue * (discount_percent / 100);
    const platform_earnings = total_revenue * (platform_fee_percent / 100);
    const company_net_profit = total_revenue - (referrer_earnings + referred_discounts + platform_earnings);

    return res.json({
      total_revenue,
      company_gross_profit,
      referrer_earnings,
      referred_discounts,
      platform_earnings,
      company_net_profit,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Simulation error', details: error.message });
  }
};
