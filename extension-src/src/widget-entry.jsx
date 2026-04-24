import { createRoot } from "react-dom/client";
import CartSyncWidget, { ContactForm, AIProductFinder } from "./CartSyncWidget";
import { AppProvider } from "@shopify/polaris";

const cartSyncWidgetElement = document.getElementById("cart-sync-widget");
console.log("👤 CartSyncWidgetElement", cartSyncWidgetElement);
if (cartSyncWidgetElement) {
  console.log("👤 CartSyncWidgetElement", cartSyncWidgetElement);
  createRoot(cartSyncWidgetElement).render(
    <AppProvider>
      <CartSyncWidget />
    </AppProvider>
  );
}

// const contactFormWidgetElement = document.getElementById("contact-form-widget");
// if (cartSyncWidgetElement) {
//   createRoot(contactFormWidgetElement).render(
//     <AppProvider>
//       <ContactForm />
//     </AppProvider>
//   );
// }

const aiProductFindWidgetElement = document.getElementById("ai-product-find-widget");
if (aiProductFindWidgetElement) {
  createRoot(aiProductFindWidgetElement).render(
    <AppProvider>
      <AIProductFinder />
    </AppProvider>
  );
}
