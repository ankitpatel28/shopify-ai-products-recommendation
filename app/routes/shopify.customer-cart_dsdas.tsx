import pkg from "@remix-run/node";
const { json } = pkg;
import { authenticate } from "../shopify.server";

/**
 * App proxy endpoint for cart synchronization
 * Handles both GET (retrieve cart) and POST (save cart) requests
 */
export const loader = async ({ request }: any) => {
  // Authenticate the app proxy request
  const { session } = await authenticate.public.appProxy(request);

  if (!session) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get query parameters
  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId");

  if (!customerId) {
    return json({ error: "Missing customerId parameter" }, { status: 400 });
  }

  try {
    // Retrieve customer metafield with cart items
    const response = await fetch(
      `https://${session.shop}/admin/api/2025-01/customers/${customerId}/metafields.json?namespace=cart_sync&key=items`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": session.accessToken || "",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("Error fetching cart metafield:", error);
      return json({ error: "Failed to fetch cart items" }, { status: 500 });
    }

    const data = await response.json();

    // Return the cart items or empty array if no metafield exists
    return json({
      cartItems: data.metafield?.value ? JSON.parse(data.metafield.value) : []
    });
  } catch (error) {
    console.error("Error in loader:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
};

export const action = async ({ request }: any) => {
  // Authenticate the app proxy request
  const { session } = await authenticate.public.appProxy(request);

  if (!session) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { customerId, cartItems } = body;

    if (!customerId || !cartItems) {
      return json(
        { error: "Missing required fields: customerId or cartItems" },
        { status: 400 }
      );
    }

    // Convert cartItems to JSON string for metafield storage
    const cartItemsJson = JSON.stringify(cartItems);

    // Save cart items to customer metafield using Shopify Admin API
    const response = await fetch(
      `https://${session.shop}/admin/api/2025-01/customers/${customerId}/metafields.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": session.accessToken || "",
        },
        body: JSON.stringify({
          metafield: {
            namespace: "cart_sync",
            key: "items",
            value: cartItemsJson,
            type: "json",
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("Error saving cart metafield:", error);
      return json({ error: "Failed to save cart items" }, { status: 500 });
    }

    const data = await response.json();

    return json({
      success: true,
      metafield: data.metafield
    });
  } catch (error) {
    console.error("Error in action:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
};

