# Cross-Browser Cart Synchronization

This document explains how the cross-browser cart synchronization feature works and how to integrate it with your storefront.

## Architecture Overview

The cart synchronization system consists of three main components:

1. **Cart Transform Extension** - Extracts cart items when customers add products to their cart
2. **Remix Backend API** - Saves/retrieves cart items from customer metafields via the app proxy
3. **Storefront Client Code** - Triggers sync on cart changes and retrieves items on login

## Components

### 1. Cart Transform Extension

**File:** `extensions/cart-transformer/src/cart_transform_run.js`

The cart transform extension runs automatically whenever the cart changes. It:
- Extracts cart items (lineId, quantity, merchandiseId)
- Only includes ProductVariant items (excludes CustomProduct like gift cards)
- Logs cart data for debugging (visible in Shopify Function logs)

**Note:** Shopify Functions run in WASM and cannot make HTTP requests directly. Client-side code must handle the actual sync.

### 2. Backend API Endpoint

**File:** `app/routes/shopify.customer-cart.tsx`

The app proxy endpoint handles:
- **POST** `/apps/customer-cart` - Save cart items to customer metafield
- **GET** `/apps/customer-cart?customerId=XXX` - Retrieve cart items from metafield

**App Proxy Configuration:**
- Subpath: `customer-cart`
- Prefix: `apps`
- URL: `https://class-recipients-survive-philips.trycloudflare.com/shopify/customer-cart`

### 3. Customer Metafield Storage

Cart items are stored in a customer metafield:
- **Namespace:** `cart_sync`
- **Key:** `items`
- **Type:** `json`
- **Structure:**
```json
[
  {
    "lineId": "gid://shopify/CartLine/123",
    "quantity": 2,
    "merchandiseId": "gid://shopify/ProductVariant/456"
  }
]
```

## Client-Side Integration

You need to add JavaScript to your storefront theme or app embed to complete the integration.

### Option A: Liquid Theme Integration

Add this code to your theme's `theme.liquid` or a cart template:

```liquid
<script>
  (function() {
    // App proxy URL
    const appProxyUrl = '/apps/customer-cart';
    
    /**
     * Save cart items to customer metafield
     */
    async function syncCartToMetafield() {
      try {
        // Get current cart data
        const cartResponse = await fetch('/cart.js');
        const cart = await cartResponse.json();
        
        // Extract cart items
        const cartItems = cart.items.map(item => ({
          lineId: item.id,
          quantity: item.quantity,
          merchandiseId: item.variant_id
        }));
        
        // Post to app proxy
        const response = await fetch(appProxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customerId: {% if customer %}'{{ customer.id }}'{% else %}null{% endif %},
            cartItems: cartItems
          })
        });
        
        if (!response.ok) {
          console.error('Failed to sync cart to metafield');
        }
      } catch (error) {
        console.error('Error syncing cart:', error);
      }
    }
    
    /**
     * Retrieve cart items from metafield and add to cart
     */
    async function syncCartFromMetafield() {
      try {
        {% if customer %}
        const customerId = '{{ customer.id }}';
        
        // Fetch saved cart items
        const response = await fetch(`${appProxyUrl}?customerId=${customerId}`);
        const data = await response.json();
        
        if (data.cartItems && data.cartItems.length > 0) {
          // Get current cart
          const cartResponse = await fetch('/cart.js');
          const currentCart = await cartResponse.json();
          const currentVariantIds = new Set(currentCart.items.map(item => item.variant_id));
          
          // Add missing items to cart
          for (const item of data.cartItems) {
            // Extract variant ID from merchandiseId GID
            const variantId = item.merchandiseId.split('/').pop();
            
            if (!currentVariantIds.has(Number(variantId))) {
              await fetch('/cart/add.js', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: variantId,
                  quantity: item.quantity
                })
              });
            }
          }
        }
        {% endif %}
      } catch (error) {
        console.error('Error syncing cart from metafield:', error);
      }
    }
    
    // Sync cart when items are added/changed
    document.addEventListener('cart:updated', syncCartToMetafield);
    
    // Sync cart on page load if customer is logged in
    {% if customer %}
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', syncCartFromMetafield);
    } else {
      syncCartFromMetafield();
    }
    {% endif %}
  })();
</script>
```

### Option B: App Embed Block (Recommended for newer themes)

If you're using Online Store 2.0, create an app embed block:

1. Create a new file: `app/blocks/cart-sync.liquid`
2. Add the JavaScript code above (modified to work without Liquid variables if needed)
3. Merchants can then enable this block from the theme customizer

### Option C: Checkout UI Extension

For a more seamless experience, you can also create a checkout UI extension that handles sync during checkout.

## Testing

### 1. Test Cart Save

1. Log in as a customer on Browser A
2. Add products to cart
3. Check Shopify logs to verify cart items are being extracted
4. Verify metafield is created/updated in Admin → Customers → [Customer] → Metafields

### 2. Test Cart Sync

1. Log in as the same customer on Browser B
2. Check that saved cart items are automatically added to the cart
3. Verify no duplicate items are added

### 3. Test Edge Cases

- Customer logs out and back in
- Cart is cleared on one browser
- Product is out of stock
- Customer has an empty cart

## Required Scopes

The following scopes are already configured in `shopify.app.toml`:

```
write_app_proxy
read_customers
write_customers
customer_read_customers
customer_write_customers
```

## Troubleshooting

### Cart items not syncing

1. Check browser console for JavaScript errors
2. Verify app proxy is properly configured in Partner Dashboard
3. Check Shopify Function logs for cart transform errors
4. Verify customer is logged in

### Duplicate items in cart

1. Ensure the client code checks for existing items before adding
2. Verify the variant ID extraction logic

### CORS errors

If you encounter CORS errors, ensure your store domain is whitelisted in your Remix app's CORS settings.

## Future Enhancements

Possible improvements:
- Add timestamp to track cart age
- Implement cart expiration (e.g., sync only recent carts)
- Add conflict resolution for simultaneous edits
- Support for cart attributes and notes
- Performance optimization with batching
- Add analytics to track sync success/failure rates






