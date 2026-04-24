import pkg from "@remix-run/node";
const { json } = pkg;

import { authenticate } from "../../shopify.server";
import { searchProducts } from "../../utils/search-engine";

export async function aiProductFinder(request) {
  try {
    const body = await request.json();
    const { query, countryCode } = body || {};
    console.log("[Product Finder] Received query:", query, "Country:", countryCode, body);
    if (!query) {
      return json({ error: "Query is required" }, 400);
    }

    const { storefront } = await authenticate.public.appProxy(request);

    if (!storefront) {
      return json({ error: "Could not connect to store" }, 500);
    }

    const products = await fetchProducts(storefront);

    if (products.length === 0) {
      return json({ items: [], meta: { totalProducts: 0 } });
    }

    const startMs = Date.now();
    const items = searchProducts(query, products, 6);
    const ms = Date.now() - startMs;

    console.log(`[Search] "${query}" -> ${items.length} results in ${ms}ms`);

    return json({
      items,
      meta: {
        query,
        totalProducts: products.length,
        resultCount: items.length,
        searchMs: ms,
        method: "bm25-local",
      },
    });
  } catch (err) {
    console.error("[Product Finder] Error:", err);
    return json({ error: "Search failed. Please try again." }, 500);
  }
}

export const loader = aiProductFinder;
export const action = aiProductFinder;

async function fetchProducts(storefront) {
  const allProducts = [];
  let cursor = null;
  let hasNextPage = true;

  const QUERY = `
    query Products($cursor: String) {
      products(first: 250, after: $cursor) {
        pageInfo { hasNextPage }
        edges {
          cursor
          node {
            id
            title
            handle
            description
            tags
            availableForSale
            featuredImage { url }
            variants(first: 10) {
              edges {
                node {
                  id
                  title
                  availableForSale
                  sku
                  price { amount currencyCode }
                }
              }
            }
          }
        }
      }
    }
  `;

  while (hasNextPage) {
    try {
      const res = await storefront.graphql(QUERY, { variables: { cursor } });
      const body = await res.json();
      const edges = body?.data?.products?.edges || [];

      if (!edges.length) break;

      for (const { node: p } of edges) {
        if (!p.availableForSale) continue;

        const variants = p.variants.edges
          .map((e) => e.node)
          .filter((v) => v.availableForSale)
          .map((v) => ({
            id: v.id,
            title: v.title,
            price: v.price.amount,
            currency: v.price.currencyCode,
            sku: v.sku || "",
          }));

        if (!variants.length) continue;

        allProducts.push({
          id: p.id,
          title: p.title,
          handle: p.handle,
          description: p.description || "",
          tags: p.tags || [],
          image: p.featuredImage?.url || null,
          variants,
        });
      }

      hasNextPage = body?.data?.products?.pageInfo?.hasNextPage ?? false;
      cursor = hasNextPage ? edges[edges.length - 1].cursor : null;
    } catch (err) {
      console.error("[Product Finder] Fetch error:", err);
      break;
    }
  }

  return allProducts;
}
