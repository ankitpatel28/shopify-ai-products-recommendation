# 🛒 Shopify AI Products Recommendation

A Shopify app built with **Remix** that provides AI-powered product recommendations and cart management for customers. Cart data is persisted using Shopify customer metafields and exposed via an App Proxy API.

---

## ✨ Features

- **Automatic Synchronization** — Cart items are automatically saved and restored on login
- **Cart Transform Function** — Real-time cart processing using Shopify Functions (compiled to WASM)
- **Metafield Storage** — Secure, persistent cart data stored in customer metafields
- **App Proxy API** — RESTful endpoints for retrieving and saving cart data
- **Remix + Shopify App** — Modern architecture using the Remix framework

---

## 🗂️ Project Structure

```
shopify-ai-products-recommendation/
├── app/                    # Remix application (routes, loaders, server logic)
├── extension-src/          # Source for Shopify extensions
├── extensions/             # Compiled Shopify extensions (cart-transformer)
├── prisma/                 # Prisma schema and migrations (SQLite by default)
├── public/                 # Static assets
├── .vscode/                # VS Code workspace settings
├── shopify.app.toml        # Shopify app configuration
├── shopify.web.toml        # Shopify web configuration
├── Dockerfile              # Docker configuration
├── HOW_TO_RUN.md           # Step-by-step guide to run and test
├── CART_SYNC_INTEGRATION.md# Client-side integration instructions
└── CHANGELOG.md            # Version history
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Remix](https://remix.run/) |
| Shopify Integration | [@shopify/shopify-app-remix](https://shopify.dev/docs/api/shopify-app-remix) |
| UI Components | [@shopify/polaris](https://polaris.shopify.com/) v12 |
| App Bridge | [@shopify/app-bridge-react](https://shopify.dev/docs/apps/tools/app-bridge) v4 |
| AI / Embeddings | [@xenova/transformers](https://huggingface.co/docs/transformers.js) v2 |
| Database / ORM | [Prisma](https://www.prisma.io/) + SQLite (default) |
| Session Storage | [@shopify/shopify-app-session-storage-prisma](https://github.com/Shopify/shopify-app-js) |
| Language | JavaScript / TypeScript |
| Build Tool | [Vite](https://vitejs.dev/) |

---

## ✅ Prerequisites

Before you begin, ensure the following are in place:

1. **Node.js** — `v18.20+`, `v20.10+`, or `v21+`
2. **Shopify Partner Account** — [Create one here](https://partners.shopify.com/signup)
3. **Development Store** — [Set up a dev store](https://help.shopify.com/en/partners/dashboard/development-stores#create-a-development-store)
4. **Shopify CLI** — Install globally:

```bash
npm install -g @shopify/cli@latest
```

---

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/ankitpatel28/shopify-ai-products-recommendation.git
cd shopify-ai-products-recommendation
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up the Database

```bash
npm run setup
# Runs: prisma generate && prisma migrate deploy
```

### 4. Start Local Development

```bash
npm run dev
# OR
shopify app dev
```

This will:
- Start the Remix backend server
- Build and deploy the cart transform extension
- Create a secure tunnel (via Shopify CLI / Cloudflare)
- Open your app in the Shopify Admin

---

## 🔑 Authenticating & Querying Shopify Data

Use the exported `shopify` constant from `/app/shopify.server.js`:

```javascript
export async function loader({ request }) {
  const { admin } = await shopify.authenticate.admin(request);

  const response = await admin.graphql(`
    {
      products(first: 25) {
        nodes {
          title
          description
        }
      }
    }
  `);

  const { data: { products: { nodes } } } = await response.json();
  return nodes;
}
```

---

## 🌐 App Proxy API

The App Proxy endpoint is available at:

```
https://<your-store>.myshopify.com/apps/customer-cart
```

**GET — Retrieve a customer's saved cart:**

```bash
curl "https://<your-store>.myshopify.com/apps/customer-cart?customerId=gid://shopify/Customer/123"
```

**POST — Save a customer's cart:**

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

---

## 🏗️ Build

```bash
# Using npm
npm run build

# Using yarn
yarn build

# Using pnpm
pnpm run build
```

---

## 🚢 Deployment

### Deploy to Shopify

```bash
npm run deploy
# OR
shopify app deploy
```

This builds the app and extensions, and deploys them to all customers.

### Hosting Providers

You can host this app on any cloud provider. Recommended options:

- [Heroku](https://www.heroku.com/)
- [Fly.io](https://fly.io/)
- [Vercel](https://vercel.com/) *(see Vercel-specific notes below)*
- [Railway](https://railway.app/)

> **Important:** Set `NODE_ENV=production` when configuring environment variables on your hosting platform.

### Hosting on Vercel

Install the Vercel preset and update `vite.config.js`:

```javascript
import { vercelPreset } from '@vercel/remix/vite';

export default defineConfig({
  plugins: [
    remix({
      ignoredRouteFiles: ["**/.*"],
      presets: [vercelPreset()],
    }),
    tsconfigPaths(),
  ],
});
```

Also replace imports from `@remix-run/node` with `@vercel/remix`.

---

## 🗄️ Database Options

By default, the app uses **SQLite** via Prisma (suitable for single-instance deployments). For production, consider:

| Database | Type | Managed Providers |
|---|---|---|
| MySQL | SQL | PlanetScale, Digital Ocean, AWS Aurora, Google Cloud SQL |
| PostgreSQL | SQL | Digital Ocean, AWS Aurora, Google Cloud SQL |
| Redis | Key-value | Digital Ocean, Amazon MemoryDB |
| MongoDB | NoSQL | MongoDB Atlas, Digital Ocean |

To switch databases, update the `datasource` in `prisma/schema.prisma` and install the matching session storage adapter.

---

## 🐳 Docker

The project includes a `Dockerfile` for containerized deployments.

```bash
# Build the image
docker build -t shopify-ai-recommendation .

# Run the container
docker run -p 3000:3000 shopify-ai-recommendation
```

The Docker entrypoint runs `npm run setup && npm run start` automatically.

---

## 🔧 Troubleshooting

### `main.Session` table does not exist
Run the database setup:
```bash
npm run setup
```

### Navigation breaks in embedded app
- Use `Link` from `@remix-run/react` or `@shopify/polaris` — not `<a>`
- Use `redirect` from `authenticate.admin` — not from `@remix-run/node`
- Use `useSubmit` or `<Form/>` from `@remix-run/react` — not lowercase `<form/>`

### OAuth loops after changing scopes
Run deploy to push the new scopes to Shopify:
```bash
npm run deploy
```

### `nbf` claim timestamp error
Enable **"Set time and date automatically"** in your OS date/time settings to keep your system clock in sync.

---

## 📦 Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start local development server |
| `npm run build` | Build the Remix app |
| `npm run start` | Serve the production build |
| `npm run setup` | Generate Prisma client + run migrations |
| `npm run deploy` | Deploy app and extensions to Shopify |
| `npm run lint` | Run ESLint |
| `npm run generate` | Generate Shopify app extensions |
| `npm run graphql-codegen` | Regenerate GraphQL types |

---

## 📚 Resources

- [Remix Documentation](https://remix.run/docs/en/v1)
- [Shopify App Remix](https://shopify.dev/docs/api/shopify-app-remix)
- [Shopify Functions — Cart Transforms](https://shopify.dev/docs/apps/checkout/purchase-extensions/cart-transforms)
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli)
- [App Extensions](https://shopify.dev/docs/apps/app-extensions/list)
- [Shopify Functions API Reference](https://shopify.dev/docs/api/functions/reference/cart-transforms)
- [Polaris Design System](https://polaris.shopify.com/)
- [Prisma Docs](https://www.prisma.io/docs/)

---

## 🤝 Contributing

Pull requests are welcome! For significant changes, please open an issue first to discuss what you'd like to change.

---

## 👨‍💻 Contact

| | |
|---|---|
| **Developed By** | Ankit Patel |
| **Email** | [ankitjpatel28@gmail.com](mailto:ankitjpatel28@gmail.com) |
| **Website** | [https://ankitdevhub.info/](https://ankitdevhub.info/) |

---

## 📄 License

This project is private. All rights reserved.

---

> **Note:** Remix has merged with React Router as of React Router v7. For new projects, consider using the [Shopify App Template — React Router](https://github.com/Shopify/shopify-app-template-react-router). To migrate an existing Remix app, see the [migration guide](https://github.com/Shopify/shopify-app-template-react-router/wiki/Upgrading-from-Remix).
