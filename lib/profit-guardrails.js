export const DEFAULT_PROFIT_POLICY = Object.freeze({
  minimumMarginPercent: 30,
  targetMarginPercent: 35,
  paymentFeePercent: 2.9,
  paymentFeeFixed: 0.3,
  customerShippingCharge: 8,
  fulfillmentShippingReserve: 8.49,
  fulfillmentTaxRatePercent: 9,
  currency: "USD"
});

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonNegative(value, fallback = 0) {
  return Math.max(0, finiteNumber(value, fallback));
}

function percent(value, fallback) {
  return Math.min(99.99, nonNegative(value, fallback));
}

function policyValue(row, camelKey, snakeKey, fallback) {
  return row?.[camelKey] ?? row?.[snakeKey] ?? fallback;
}

function priceEndingIn99(value) {
  const amount = nonNegative(value);
  const whole = Math.floor(amount);
  const sameDollar = whole + 0.99;
  const rounded = sameDollar + Number.EPSILON >= amount
    ? sameDollar
    : whole + 1.99;

  return roundMoney(rounded);
}

function requiredRetailPrice({
  productionCost,
  marginPercent,
  policy
}) {
  const feeRate = policy.paymentFeePercent / 100;
  const marginRate = marginPercent / 100;
  const fulfillmentTax =
    (productionCost + policy.fulfillmentShippingReserve) *
    (policy.fulfillmentTaxRatePercent / 100);
  const fixedCosts =
    productionCost +
    policy.fulfillmentShippingReserve +
    fulfillmentTax +
    policy.paymentFeeFixed;
  const denominator = 1 - feeRate - marginRate;

  if (denominator <= 0) return null;

  const requiredRevenue = fixedCosts / denominator;
  const requiredRetail = Math.max(
    0,
    requiredRevenue - policy.customerShippingCharge
  );

  return priceEndingIn99(requiredRetail);
}

export function roundMoney(value) {
  return Math.round((finiteNumber(value) + Number.EPSILON) * 100) / 100;
}

export function normalizeProfitPolicy(row = {}) {
  const minimumMarginPercent = percent(
    policyValue(
      row,
      "minimumMarginPercent",
      "minimum_margin_percent",
      DEFAULT_PROFIT_POLICY.minimumMarginPercent
    ),
    DEFAULT_PROFIT_POLICY.minimumMarginPercent
  );
  const requestedTarget = percent(
    policyValue(
      row,
      "targetMarginPercent",
      "target_margin_percent",
      DEFAULT_PROFIT_POLICY.targetMarginPercent
    ),
    DEFAULT_PROFIT_POLICY.targetMarginPercent
  );

  return {
    minimumMarginPercent,
    targetMarginPercent: Math.max(minimumMarginPercent, requestedTarget),
    paymentFeePercent: percent(
      policyValue(
        row,
        "paymentFeePercent",
        "payment_fee_percent",
        DEFAULT_PROFIT_POLICY.paymentFeePercent
      ),
      DEFAULT_PROFIT_POLICY.paymentFeePercent
    ),
    paymentFeeFixed: roundMoney(
      nonNegative(
        policyValue(
          row,
          "paymentFeeFixed",
          "payment_fee_fixed",
          DEFAULT_PROFIT_POLICY.paymentFeeFixed
        ),
        DEFAULT_PROFIT_POLICY.paymentFeeFixed
      )
    ),
    customerShippingCharge: roundMoney(
      nonNegative(
        policyValue(
          row,
          "customerShippingCharge",
          "customer_shipping_charge",
          DEFAULT_PROFIT_POLICY.customerShippingCharge
        ),
        DEFAULT_PROFIT_POLICY.customerShippingCharge
      )
    ),
    fulfillmentShippingReserve: roundMoney(
      nonNegative(
        policyValue(
          row,
          "fulfillmentShippingReserve",
          "fulfillment_shipping_reserve",
          DEFAULT_PROFIT_POLICY.fulfillmentShippingReserve
        ),
        DEFAULT_PROFIT_POLICY.fulfillmentShippingReserve
      )
    ),
    fulfillmentTaxRatePercent: percent(
      policyValue(
        row,
        "fulfillmentTaxRatePercent",
        "fulfillment_tax_rate_percent",
        DEFAULT_PROFIT_POLICY.fulfillmentTaxRatePercent
      ),
      DEFAULT_PROFIT_POLICY.fulfillmentTaxRatePercent
    ),
    currency: String(
      policyValue(
        row,
        "currency",
        "currency",
        DEFAULT_PROFIT_POLICY.currency
      )
    ).trim().toUpperCase() || DEFAULT_PROFIT_POLICY.currency
  };
}

export function calculateProfitability({
  retailPrice,
  baseProductionCost,
  extraPlacementCost = 0,
  policy = DEFAULT_PROFIT_POLICY
} = {}) {
  const normalizedPolicy = normalizeProfitPolicy(policy);
  const price = roundMoney(nonNegative(retailPrice));
  const hasProductionCost =
    baseProductionCost !== null &&
    baseProductionCost !== undefined &&
    baseProductionCost !== "" &&
    Number.isFinite(Number(baseProductionCost));
  const placementCost = roundMoney(nonNegative(extraPlacementCost));
  const customerShippingCharge =
    normalizedPolicy.customerShippingCharge;
  const estimatedRevenue = roundMoney(
    price + customerShippingCharge
  );

  if (!hasProductionCost) {
    return {
      retailPrice: price,
      customerShippingCharge,
      baseProductionCost: null,
      extraPlacementCost: placementCost,
      estimatedProductionCost: null,
      estimatedShippingCost:
        normalizedPolicy.fulfillmentShippingReserve,
      estimatedTax: null,
      estimatedPaymentFee: roundMoney(
        estimatedRevenue *
          (normalizedPolicy.paymentFeePercent / 100) +
          normalizedPolicy.paymentFeeFixed
      ),
      estimatedTotalCost: null,
      estimatedRevenue,
      estimatedProfit: null,
      marginPercent: null,
      minimumRetailPrice: null,
      recommendedRetailPrice: null,
      status: "needs_cost",
      policy: normalizedPolicy
    };
  }

  const productionCost = roundMoney(
    nonNegative(baseProductionCost) + placementCost
  );
  const estimatedShippingCost =
    normalizedPolicy.fulfillmentShippingReserve;
  const estimatedTax = roundMoney(
    (productionCost + estimatedShippingCost) *
      (normalizedPolicy.fulfillmentTaxRatePercent / 100)
  );
  const estimatedPaymentFee = roundMoney(
    estimatedRevenue *
      (normalizedPolicy.paymentFeePercent / 100) +
      normalizedPolicy.paymentFeeFixed
  );
  const estimatedTotalCost = roundMoney(
    productionCost +
      estimatedShippingCost +
      estimatedTax +
      estimatedPaymentFee
  );
  const estimatedProfit = roundMoney(
    estimatedRevenue - estimatedTotalCost
  );
  const marginPercent = estimatedRevenue > 0
    ? roundMoney((estimatedProfit / estimatedRevenue) * 100)
    : 0;
  const minimumRetailPrice = requiredRetailPrice({
    productionCost,
    marginPercent: normalizedPolicy.minimumMarginPercent,
    policy: normalizedPolicy
  });
  const recommendedRetailPrice = requiredRetailPrice({
    productionCost,
    marginPercent: normalizedPolicy.targetMarginPercent,
    policy: normalizedPolicy
  });
  const status = marginPercent < normalizedPolicy.minimumMarginPercent
    ? "blocked"
    : marginPercent < normalizedPolicy.targetMarginPercent
      ? "warning"
      : "ready";

  return {
    retailPrice: price,
    customerShippingCharge,
    baseProductionCost: roundMoney(nonNegative(baseProductionCost)),
    extraPlacementCost: placementCost,
    estimatedProductionCost: productionCost,
    estimatedShippingCost,
    estimatedTax,
    estimatedPaymentFee,
    estimatedTotalCost,
    estimatedRevenue,
    estimatedProfit,
    marginPercent,
    minimumRetailPrice,
    recommendedRetailPrice,
    status,
    policy: normalizedPolicy
  };
}
