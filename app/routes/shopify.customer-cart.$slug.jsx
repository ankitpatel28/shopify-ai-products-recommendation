import pkg from "@remix-run/node";
const { json } = pkg;
import { setCustomerCartData } from "./api/set-meta-value";
import { getMetaValue } from "./api/get-meta-value";
import { contactForm } from "./api/contact-form";
import { aiProductFinder } from "./api/ai-product-finder";

export const loader = async ({ params, request }) => {
  return handleProxy(params.slug, request);
};

export const action = async ({ params, request }) => {
  return handleProxy(params.slug, request);
};

async function handleProxy(slug, request) {
  // You can extend this switch as per your API routes
  console.log("Proxy request for slug:", slug);
  switch (slug) {
    case "get-meta-value":
      return getMetaValue(request);
    case "set-meta-value":
      return setCustomerCartData(request);
    case "contact-form":
      return contactForm(request);
    case "ai-product-finder":
      return aiProductFinder(request);
    default:
      return json({ error: "Invalid slug" }, { status: 404 });
  }
}
