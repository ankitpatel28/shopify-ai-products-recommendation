# How to Run the Cart Transform Function

This guide explains how to run and test your cart transformation extension.

## Prerequisites

1. **Node.js** (v18.20+ or v20.10+ or v21+)
2. **Shopify CLI** installed globally:
   ```bash
   npm install -g @shopify/cli@latest
   ```
3. **Shopify Partner Account** with a development store
4. Your app installed and running

## Running the Full App with Cart Transform

### Step 1: Start the Development Server

From your project root directory, run:

```bash
npm run dev
```

Or directly with Shopify CLI:

```bash
shopify app dev
```

This command will:
- Start your Remix backend server
- Build and deploy your cart transform extension
- Create a secure tunnel for testing
- Open your app in the Shopify admin

### Step 2: Verify Cart Transform is Active

1. Once the dev server starts, check for these messages:
   ```
   ✓ Built function: cart-transformer
   ✓ Deployed extension: cart-transformer
   ```

2. Go to your Shopify admin: `https://<your-store>.myshopify.com/admin/apps`

3. Your app should be listed and active

### Step 3: Test the Cart Transform Function

The cart transform function runs **automatically** whenever:
- A customer adds an item to their cart
- A customer updates cart quantity
- A customer removes an item from their cart
- A cart is loaded/refreshed

#### Testing Process:

1. **Open a Private/Incognito Browser Window**
   - Navigate to your storefront: `https://<your-store>.myshopify.com`

2. **Log in as a Customer**
   - Create a test customer account in your Shopify admin
   - Log in to the storefront with this account

3. **Add Items to Cart**
   - Browse products and add a few items to your cart
   - The cart transform function runs automatically!

4. **Check Function Logs**
   - In your terminal where `shopify app dev` is running
   - Look for console.log outputs showing cart items
   - You should see: `Cart items for sync: {...}`

## Manually Building and Testing the Function

If you want to build and test the function independently:

### From the Extension Directory:

```bash
cd extensions/cart-transformer
npm run build
```

This compiles the function to WASM.

### Preview the Function:

```bash
cd extensions/cart-transformer
shopify app function run --input test-input.json
```

This runs the function with sample test data from `test-input.json`.

**Expected Output:**
You should see:
- Logs showing the extracted cart items
- Output with `operations: []`
- No errors

Example output:
```
Cart items for sync: {
  "customerId": "gid://shopify/Customer/111222",
  "cartItems": [
    {"lineId": "gid://shopify/CartLine/123456", "quantity": 2, "merchandiseId": "..."},
    {"lineId": "gid://shopify/CartLine/123457", "quantity": 1, "merchandiseId": "..."}
  ],
  "timestamp": "..."
}
```

### Run Type Generation:

```bash
cd extensions/cart-transformer
npm run typegen
```

This regenerates TypeScript types from your GraphQL schema.

## Testing the App Proxy Endpoint

Your app proxy endpoint is available at:

```
https://<your-store>.myshopify.com/apps/customer-cart
```

### Test with curl:

**GET request** (retrieve cart):
```bash
curl "https://<your-store>.myshopify.com/apps/customer-cart?customerId=gid://shopify/Customer/123"
```

**POST request** (save cart):
```bash
curl -X POST "https://<your-store>.myshopify.com/apps/customer-cart" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "gid://shopify/Customer/123",
    "cartItems": [
      {
        "lineId": "gid://shopify/CartLine/456",
        "quantity": 2,
        "merchandiseId": "gid://shopify/ProductVariant/789"
      }
    ]
  }'
```

## Viewing Function Logs

### During Development:

Function logs appear in your terminal where `shopify app dev` is running. Look for:
- Console.log outputs from your function
- Errors or warnings
- Build/deployment status

### In Production:

After deploying your app, you can view function logs in:

1. **Shopify Admin** → **Settings** → **Notifications** → **Developer tools** → **Function logs**
2. Or use the Shopify CLI:
   ```bash
   shopify app info --logs
   ```

## Common Issues and Solutions

### Issue: Function not running

**Solution:**
1. Check that the extension is deployed: `shopify app info`
2. Verify your app is installed: Admin → Apps
3. Check for build errors in terminal

### Issue: "TypeError: Cannot read property..."

**Solution:**
1. Run typegen to regenerate types:
   ```bash
   cd extensions/cart-transformer
   npm run typegen
   ```
2. Rebuild the function:
   ```bash
   npm run build
   ```

### Issue: App proxy returns 404

**Solution:**
1. Verify app proxy is configured in `shopify.app.toml`
2. Check the URL in Partner Dashboard → App Settings → App Proxy
3. Ensure your dev server is running
4. Restart the dev server

### Issue: Cart items not syncing

**Solution:**
1. Verify customer is logged in (cart transform only runs for authenticated customers)
2. Check browser console for JavaScript errors
3. Verify app proxy endpoint is accessible
4. Check function logs for errors

## Production Deployment

When ready to deploy to production:

```bash
npm run deploy
```

Or:

```bash
shopify app deploy
```

This will:
- Build your app and extensions
- Deploy to your hosting platform
- Update your app listing
- Make the cart transform available to all customers

## Debugging Tips

1. **Use console.log()** - Outputs appear in function logs
2. **Check the GraphQL query** - Ensure you're requesting the right fields
3. **Test with sample data** - Use `npm run preview` to test locally
4. **Verify customer authentication** - Cart sync only works for logged-in users
5. **Check metafield permissions** - Ensure your app has `write_customers` scope

## Next Steps

Once your cart transform is running:

1. **Add client-side integration** - See `CART_SYNC_INTEGRATION.md`
2. **Test cross-browser sync** - Add items in one browser, check in another
3. **Monitor logs** - Watch for errors or unexpected behavior
4. **Deploy to production** - Share with your customers!

## Additional Resources

- [Shopify Functions Documentation](https://shopify.dev/docs/apps/checkout/purchase-extensions/cart-transforms)
- [Shopify CLI Documentation](https://shopify.dev/docs/apps/tools/cli)
- [Remix App Documentation](https://remix.run/docs)
- [Cart Transform API Reference](https://shopify.dev/docs/api/functions/reference/cart-transforms)

