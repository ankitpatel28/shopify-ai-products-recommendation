// @ts-check

/**
 * @typedef {import("../generated/api").CartTransformRunInput} CartTransformRunInput
 * @typedef {import("../generated/api").CartTransformRunResult} CartTransformRunResult
 */

/**
 * @type {CartTransformRunResult}
 */
const NO_CHANGES = {
  operations: [],
};

/**
 * @param {CartTransformRunInput} input
 * @returns {CartTransformRunResult}
 */
export function cartTransformRun(input) {
  const cart = input.cart;
  //console.log('Cart:', cart);
  const customerId = cart.buyerIdentity?.customer?.id;

  // If customer is logged in, prepare cart items for cross-browser sync
  if (customerId) {
    const cartItems = cart.lines.map(line => {
      // Only include ProductVariant items (skip CustomProduct like gift cards)
      const merchandiseId =
        line.merchandise && line.merchandise.__typename === 'ProductVariant'
          ? line.merchandise.id
          : null;

      return {
        lineId: line.id,
        quantity: line.quantity,
        merchandiseId: merchandiseId,
      };
    }).filter(item => item.merchandiseId !== null); // Only sync regular product variants

    // Note: Shopify Functions run in WASM and cannot make HTTP requests.
    // The frontend needs to listen for cart changes and call the app proxy endpoint.
    // See the client-side integration in the storefront theme or app embed.

    // Log cart items for debugging (in production, this will be visible in Shopify logs)
    // console.log('Cart items for sync:', JSON.stringify({
    //   customerId,
    //   cartItems,
    //   timestamp: new Date().toISOString()
    // }));
  }

  return NO_CHANGES;
};
