import { authenticate, unauthenticated } from "../shopify.server";

export const action = async ({ request }) => {
  const { shop, session, topic, payload, admin, buyerIdentity } = await authenticate.webhook(request);
  //console.log("Carts update webhook received", payload, "buyerIdentity", buyerIdentity);
  if (topic === "CARTS_UPDATE") {
    // Handle the cart update event
    //console.log("Cart update webhook received", payload, "admin", admin, "shop", shop, "session", session, "topic", topic);
    // Your logic here (e.g., update DB)
  } else {
    return new Response("Unhandled webhook topic", { status: 404 });
  }

  return new Response(null, { status: 200 });
};
