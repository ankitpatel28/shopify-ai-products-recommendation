
import pkg from "@remix-run/node";
const { json } = pkg;
import { authenticate } from "../../shopify.server";

/**
 * App proxy endpoint for cart synchronization
 * Handles both GET (retrieve cart) and POST (save cart) requests
 */
export async function setCustomerCartData(request) {
  const { admin } = await authenticate.public.appProxy(request);

  const { customerId, cartItems } = await request.json();

  if (!customerId) return null;

  try {
    const response = await admin.graphql(
      `#graphql
      mutation updateCustomer($input: CustomerInput!) {
        customerUpdate(input: $input) {
          customer {
            id
            metafield(namespace: "cart_sync", key: "items") {
              namespace
              key
              value
              type
            }
          }
          userErrors {
            message
            field
          }
        }
      }`,
      {
        variables: {
          input: {
            id: `gid://shopify/Customer/${customerId}`,
            metafields: [
              {
                namespace: "cart_sync",
                key: "items",
                type: "json",
                value: JSON.stringify(cartItems),
              },
            ],
          },
        },
      },
    );

    const data = await response.json();

    if (data?.data?.customerUpdate?.userErrors?.length) {
      console.error("User errors:", data.data.customerUpdate.userErrors);
    }

    return data?.data?.customerUpdate?.customer || null;
  } catch (error) {
    console.error("Error updating customer:", error);
    return null;
  }
}

export const loader = setCustomerCartData;
export const action = setCustomerCartData;
