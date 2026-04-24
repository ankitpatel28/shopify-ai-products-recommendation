import pkg from "@remix-run/node";
const { json } = pkg;
import { authenticate } from "../../shopify.server";

export async function getMetaValue(request) {
  const { admin } = await authenticate.public.appProxy(request);

  const { customerId } = await request.json();

  if (!customerId) return null;

  try {
    const shopifyRes = await admin.graphql(
      `query getCustomerById($id: ID!) {
        customer(id: $id) {
          id
          metafield(namespace: "cart_sync", key: "items") {
            namespace
            key
            value
            type
          }
        }
      }`,
      { variables: {
          id: `gid://shopify/Customer/${customerId}`
        }
      },
    );
    const shopifyData = await shopifyRes.json();

    return JSON.stringify({
      success: true,
      data: shopifyData?.data,
      metafield: shopifyData?.data?.customer?.metafield
    }, { status: 200 });
  } catch(error) {
    console.error("Error getting customer:", error);
    return null;
  }
}

export const loader = getMetaValue;
export const action = getMetaValue;
