import { useEffect, useState, useRef } from "react";


let SYNC_URL = "/apps/customer-cart";


export default function CartSyncWidget() {
  useEffect(() => {
    const customerId = window?.customerId || null;
    if (!customerId && sessionStorage.getItem("cartSynced")) {
      sessionStorage.removeItem("cartSynced");
    }
    if (!customerId) return;


    let debounceTimer;


    async function getCart() {
      const res = await fetch("/cart.js");
      return res.json();
    }


    async function getMetafieldCart() {


      const res = await fetch(`${SYNC_URL}/get-meta-value`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });


      if (!res.ok) return { items: [] };
      return res.json();
    }


    async function syncCart() {
      try {
        const [cart, metafield] = await Promise.all([getCart(), getMetafieldCart()]);


        console.log("cart: ===== ", cart, JSON.parse(JSON.parse(metafield)?.metafield?.value));
        const metafieldItems = metafield ? JSON.parse(JSON.parse(metafield)?.metafield?.value)?.items : [];
        console.log("🛒 Current cart:", cart);
        console.log("📦 Metafield cart:", metafieldItems);


        const cartMap = new Map(cart.items.map((i) => [i.id, i]));
        const metaMap = new Map(metafieldItems?.map((i) => [i.variant_id, i]));


        const mergedItems = [];
        const allIds = new Set([...cartMap.keys(), ...metaMap.keys()]);
        console.log("allIds :", allIds);


        // --- Merge both cart & metafield ---
        if (allIds) {
          for (const id of allIds) {
            const cartItem = cartMap.get(id);
            const metaItem = metaMap.get(id);


            if (cartItem && metaItem) {
              // Both exist — choose the higher quantity (or prefer metafield)
              const finalQuantity = Math.max(cartItem.quantity, metaItem.quantity);
              mergedItems.push({ variant_id: id, quantity: finalQuantity });


              if (cartItem.quantity !== finalQuantity) {
                console.log("🔄 Updating quantity for:", id);
                await fetch("/cart/change.js", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id, quantity: finalQuantity }),
                });
              }
            } else if (!cartItem && metaItem) {
              // Only in metafield → add to cart
              console.log("➕ Adding from metafield:", id);
              await fetch("/cart/add.js", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, quantity: metaItem.quantity }),
              });
              mergedItems.push(metaItem);
            } else if (cartItem && !metaItem) {
              // Only in cart → keep in metafield
              mergedItems.push({ variant_id: id, quantity: cartItem.quantity });
            }
          }
        }


        const updatedCart = await getCart();
        const cartData = {
          items: updatedCart?.items.map((item) => ({
            variant_id: item.variant_id,
            quantity: item.quantity,
            attributes: item.properties || {}, // line-item attributes
          })),
          attributes: updatedCart.attributes || {}, // cart-level attributes
          note: updatedCart.note || "",
        };
        await fetch(`${SYNC_URL}/set-meta-value`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId, cartItems: cartData }),
        });


        console.log("✅ Cart synced to metafield");


        // --- Mark sync done for current session ---
        sessionStorage.setItem("cartSynced", "true");
      } catch (err) {
        console.error("❌ Sync failed", err);
      }
    }


    function scheduleSync() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(syncCart, 1000);
    }


    // --- Only run once per session after login ---
    if (!sessionStorage.getItem("cartSynced")) {
      console.log("🧭 Running initial cart sync...");
      scheduleSync();
    } else {
      console.log("⚡ Cart already synced this session");
    }
    // --- Monkey-patch fetch() ---
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const [url] = args;
      const response = await originalFetch(...args);
      if (typeof url === "string" && url.match(/\/cart\/(add|change|update|clear|remove)/)) {
        scheduleSync();
      }
      return response;
    };


    // --- Monkey-patch XMLHttpRequest ---
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (...args) {
      this._url = args[1];
      return originalOpen.apply(this, args);
    };


    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (...args) {
      this.addEventListener("load", function () {
        if (this._url && this._url.match(/\/cart\/(add|change|update|clear|remove)/)) {
          scheduleSync();
        }
      });
      return originalSend.apply(this, args);
    };


    // Cleanup when component unmounts
    return () => {
      window.fetch = originalFetch;
      XMLHttpRequest.prototype.open = originalOpen;
      XMLHttpRequest.prototype.send = originalSend;
    };
  }, [customerId]);


  return null; // This component runs only its side effects
}


export function ContactForm() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    message: "",
  });
  const [status, setStatus] = useState({ loading: false, success: null, error: null });


  // --- Handle input changes ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };


  // --- Handle form submit ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, success: null, error: null });
    console.log("Form Data: ", formData);
    try {
      // ✅ Replace this with your actual endpoint
      const res = await fetch(`${SYNC_URL}/contact-form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });


      if (!res.ok) throw new Error("Failed to submit form");


      setStatus({ loading: false, success: "Form submitted successfully!", error: null });
      setFormData({ firstName: "", lastName: "", email: "", phone: "", message: "" });
    } catch (err) {
      setStatus({ loading: false, success: null, error: err.message });
    }
  };


  return (
    <div className="form-widget-inner max-w-md mx-auto p-6 bg-white shadow rounded-xl">
      <h2 className="text-2xl font-semibold mb-4 text-center">Contact Us</h2>


      <form onSubmit={handleSubmit} className="space-y-4">
        {/* First Name */}
        <div>
          <label htmlFor="firstName" className="block font-medium text-gray-700">
            First Name
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            value={formData.firstName}
            onChange={handleChange}
            required
            placeholder="Enter your first name"
            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
          />
        </div>


        {/* Last Name */}
        <div>
          <label htmlFor="lastName" className="block font-medium text-gray-700">
            Last Name
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            value={formData.lastName}
            onChange={handleChange}
            required
            placeholder="Enter your last name"
            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
          />
        </div>


        {/* Email */}
        <div>
          <label htmlFor="email" className="block font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
            placeholder="Enter your email"
            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
          />
        </div>


        {/* Phone */}
        <div>
          <label htmlFor="phone" className="block font-medium text-gray-700">
            Phone Number
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
            required
            placeholder="Enter your phone number"
            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
          />
        </div>


        {/* Message */}
        <div>
          <label htmlFor="message" className="block font-medium text-gray-700">
            Message
          </label>
          <textarea
            id="message"
            name="message"
            rows="5"
            value={formData.message}
            onChange={handleChange}
            required
            placeholder="Type your message"
            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
          ></textarea>
        </div>


        {/* Submit Button */}
        <button
          type="submit"
          disabled={status.loading}
          className="w-full bg-gray text-black py-2 rounded-lg hover:bg-blue-700 transition"
        >
          {status.loading ? "Submitting..." : "Submit"}
        </button>


        {/* Status Messages */}
        {status.success && (
          <p className="text-green-600 text-center mt-2">{status.success}</p>
        )}
        {status.error && (
          <p className="text-red-600 text-center mt-2">{status.error}</p>
        )}
      </form>
    </div>
  );
}
/**
 * Props assumptions:
 * - SYNC_URL global var points to your app proxy root (e.g., '/apps')
 * - Shopify global provides country, formatMoney, money_format
 *
 * Paste CSS provided below into your theme's stylesheet.
 */


export function AIProductFinder() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState({ loading: false, error: null });
  const [results, setResults] = useState([]);
  const [shortlist, setShortlist] = useState([]); // array of handles
  const [compare, setCompare] = useState([]); // array of handles
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [stickyItem, setStickyItem] = useState(null);
  const [exitOfferShown, setExitOfferShown] = useState(false);


  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef(null);


  const containerRef = useRef();


  // Initialize from localStorage
  useEffect(() => {
    const savedResults = localStorage.getItem("ai_finder_results");
    const savedQuery = localStorage.getItem("ai_finder_query");
    const savedShortlist = localStorage.getItem("ai_finder_shortlist");
    const savedCompare = localStorage.getItem("ai_finder_compare");
    const savedRecently = localStorage.getItem("ai_finder_recently");


    if (savedResults) {
      setResults(JSON.parse(savedResults));
      setStickyItem(JSON.parse(savedResults)[0]);
    }
    if (savedQuery) setQuery(savedQuery);
    if (savedShortlist) setShortlist(JSON.parse(savedShortlist));
    if (savedCompare) setCompare(JSON.parse(savedCompare));
    if (savedRecently) setRecentlyViewed(JSON.parse(savedRecently));
  }, []);


  // Persist shortlist/compare/recently
  useEffect(() => {
    localStorage.setItem("ai_finder_shortlist", JSON.stringify(shortlist));
  }, [shortlist]);
  useEffect(() => {
    localStorage.setItem("ai_finder_compare", JSON.stringify(compare));
  }, [compare]);
  useEffect(() => {
    localStorage.setItem("ai_finder_recently", JSON.stringify(recentlyViewed));
  }, [recentlyViewed]);


  // exit-intent (simple)
  useEffect(() => {
    function onMouse(e) {
      if (e.clientY < 20 && !exitOfferShown) {
        setExitOfferShown(true);
        // show small modal/offer (you can expand)
        alert("Wait! Get 5% off your top AI match — use code AI5 at checkout.");
      }
    }
    //window.addEventListener("mouseout", onMouse);
    // () => window.removeEventListener("mouseout", onMouse);
  }, [exitOfferShown]);


  // Speech recognition setup
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;


    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }


    setSpeechSupported(true);


    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = document.documentElement.lang || "en-US";
    recognition.maxAlternatives = 1;


    recognition.onstart = () => {
      setIsListening(true);
      setStatus((prev) => ({ ...prev, error: null }));
    };


    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";


      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }


      setQuery((finalTranscript || interimTranscript).trim());
    };


    recognition.onerror = (event) => {
      setIsListening(false);
      setStatus((prev) => ({
        ...prev,
        error: `Voice input error: ${event.error}`,
      }));
    };


    recognition.onend = () => {
      setIsListening(false);
    };


    recognitionRef.current = recognition;


    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);


  // Start voice input
  function startVoiceInput() {
    if (!recognitionRef.current) return;


    try {
      recognitionRef.current.start();
    } catch (err) {
      console.error("Speech start error:", err);
    }
  }


  // Stop voice input
  function stopVoiceInput() {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
  }


  // helper: call backend
  async function callFinder(text) {
    const res = await fetch(`${SYNC_URL}/ai-product-finder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: text, countryCode: Shopify.country }),
    });
    return res.json();
  }


  // search handler
  async function handleSearch(e) {
    if (e) e.preventDefault();
    if (!query.trim()) return;


    setStatus({ loading: true, error: null });
    setResults([]);


    try {
      const data = await callFinder(query);
      if (data?.error) {
        setStatus({ loading: false, error: data.error });
        return;
      }


      const items = data.items || [];
      setResults(items);
      localStorage.setItem("ai_finder_results", JSON.stringify(items));
      localStorage.setItem("ai_finder_query", query);


      // set sticky first item for sticky bar
      if (items.length) {
        setStickyItem(items[0]);
        // add to recently viewed
        addRecentlyViewed(items[0]);
      }


      setStatus({ loading: false, error: null });
    } catch (err) {
      setStatus({ loading: false, error: err.message || String(err) });
    }
  }


  // suggestion quick search
  function handleSuggestion(text) {
    setQuery(text);
    // don't pass event; call search explicitly
    handleSearch();
  }


  // addToCart (1-click). We try variant-aware pricing: picks first variant.
  async function addToCart(item, variantIndex = 0, quantity = 1) {
    try {
      const variant = item.variants?.[variantIndex];
      if (!variant) {
        alert("No variant available");
        return;
      }


      const payload = {
        items: [{ id: variant.id || variant.sku || variant.title, quantity }],
      };


      // Shopify storefront cart add endpoint
      // If your storefront uses different endpoint, adapt
      const res = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ id: variant.id?.replace("gid://shopify/ProductVariant/", ""), quantity }] }),
      });


      if (!res.ok) {
        const txt = await res.text();
        console.error("Add to cart failed", txt);
        alert("Failed to add to cart");
        return;
      }


      const json = await res.json();
      // set sticky item to promote cart upsell
      setStickyItem(item);


      // show a friendly animation / toast
      alert(`Added ${item.title} to cart!`);
    } catch (e) {
      console.error(e);
      alert("Error adding to cart");
    }
  }


  // add bundle to cart (bundle is array of handles or ids)
  async function addBundleToCart(bundle) {
    // bundle: [{handle/id, quantity}]
    try {
      const itemsToAdd = bundle.map((b) => {
        console.log(b);
        // we expect variant id or sku in returned bundle; otherwise fallback
        return { id: b.variant_id?.replace("gid://shopify/ProductVariant/", "") || b.id?.replace("gid://shopify/ProductVariant/", "") || b.handle, quantity: b.quantity || 1 };
      });


      const res = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsToAdd }),
      });
      if (!res.ok) {
        alert("Failed to add bundle");
        return;
      }
      alert("Bundle added to cart!");
    } catch (e) {
      console.error(e);
      alert("Bundle add error");
    }
  }


  // shortlist / compare / recently viewed helpers
  function toggleShortlist(handle) {
    setShortlist((prev) => {
      if (prev.includes(handle)) return prev.filter((h) => h !== handle);
      return [handle, ...prev].slice(0, 20);
    });
  }


  function toggleCompare(handle) {
    setCompare((prev) => {
      if (prev.includes(handle)) return prev.filter((h) => h !== handle);
      if (prev.length >= 3) {
        // only allow max 3 to compare
        const after = [...prev.slice(0, 2), handle];
        return after;
      }
      return [handle, ...prev];
    });
  }


  function addRecentlyViewed(item) {
    setRecentlyViewed((prev) => {
      const exists = prev.find((p) => p.handle === item.handle);
      const updated = [item, ...prev.filter((p) => p.handle !== item.handle)].slice(0, 12);
      localStorage.setItem("ai_finder_recently", JSON.stringify(updated));
      return updated;
    });
  }


  // small UI helpers
  function formatMoney(amount, currency = (Shopify && Shopify.money_format) || "${{amount}}") {
    try {
      if (!amount) return "";
      // assume amount is decimal string or number
      const cents = Math.round(Number(amount) * 100);
      return Shopify.formatMoney ? Shopify.formatMoney(cents, Shopify.money_format) : `${currency} ${amount}`;
    } catch {
      return amount;
    }
  }


  // compare panel (simple)
  function renderComparePanel() {
    if (!compare.length) return null;
    const items = results.filter((r) => compare.includes(r.handle));
    return (
      <div className="ai-compare-panel">
        <h4>Compare ({items.length})</h4>
        <div className="compare-grid">
          {items.map((it) => (
            <div key={it.handle} className="compare-card">
              <h5>{it.title}</h5>
              <p>{it.summary}</p>
              <p className="price">{formatMoney(it.price, it.currency)}</p>
              <a href={`/products/${it.handle}`}>View</a>
            </div>
          ))}
        </div>
      </div>
    );
  }


  // UI: sticky personalized bar
  function renderStickyBar() {
    if (!stickyItem) return null;
    return (
      <div className="ai-sticky-bar">
        <div className="left">
          <strong>Recommended for you:</strong> {stickyItem.title}
          <br /><span>{formatMoney(stickyItem?.price)}</span>
        </div>
        <div className="right">
          <button onClick={() => addToCart(stickyItem)}>Add to cart</button>
          <a href={`/products/${stickyItem.handle}`}>View</a>
        </div>
      </div>
    );
  }


  return (
    <>
      {/* loading background */}
      {status.loading && <div className="ai-loading-background"></div>}


      {/* sticky bar */}
      {renderStickyBar()}


      <div className="ai-wrapper" ref={containerRef}>
        <h2 className="ai-title">Find the Best Product for You</h2>
        <p className="ai-subtitle">
          Describe what you're looking for — our AI will match the perfect products.
        </p>


        <form onSubmit={handleSearch} className="ai-form">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., best kryptonite products, lightweight locks, etc."
            className="ai-input"
          />


          {speechSupported && (
            <button
              type="button"
              onClick={isListening ? stopVoiceInput : startVoiceInput}
              className={`ai-mic-button ${isListening ? "listening" : ""}`}
              aria-label={isListening ? "Stop voice input" : "Start voice input"}
              title={isListening ? "Stop voice input" : "Start voice input"}
            >
              {isListening ? "🎙️ Listening..." : "🎤"}
            </button>
          )}


          <button type="submit" className="ai-button">
            {status.loading ? "Searching..." : "Find Products"}
          </button>
        </form>


        <div className="ai-suggestions">
          <p className="ai-suggestions-label">Try one of these:</p>
          <div className="ai-suggestions-list">
            <button type="button" disabled={status.loading} onClick={() => handleSuggestion("best kryptonite bike locks")} className="ai-suggestion-btn">Best Kryptonite bike locks</button>
            <button type="button" disabled={status.loading} onClick={() => handleSuggestion("lightweight bike lock for travel")} className="ai-suggestion-btn">Lightweight bike lock for travel</button>
            <button type="button" disabled={status.loading} onClick={() => handleSuggestion("most secure lock under 5000")} className="ai-suggestion-btn">Most secure lock under ₹5000</button>
            <button type="button" disabled={status.loading} onClick={() => handleSuggestion("cheap U-lock with good rating")} className="ai-suggestion-btn">Cheap U-lock with good rating</button>
          </div>
        </div>


        <div className="ai-divider"></div>


        {/* skeleton loader */}
        {status.loading && (
          <div className="ai-skeleton-list">
            {[1,2,3].map((n) => (
              <div key={n} className="ai-skeleton-item">
                <div className="skeleton skeleton-title"></div>
                <div className="skeleton skeleton-text"></div>
                <div className="skeleton skeleton-text"></div>
                <div className="skeleton skeleton-price"></div>
              </div>
            ))}
          </div>
        )}


        {/* results grid */}
        {results?.length > 0 && !status.loading && (
          <div className="ai-results">
            {results.map((item, idx) => (
              <div key={item.handle || item.id || idx} className="ai-result-item">
                <h3 className="ai-result-title" data-handle={item.handle}>{item.title}</h3>
                <p className="ai-match-reason">{item.match_reason}</p>
                <p className="ai-summary">{item.summary}</p>


                <div className="ai-price-with-button">
                  <div className="left-content">
                    <div className="ai-price">{formatMoney(item.price, item.currency)}</div>
                    {item.variants?.length > 1 && <p className="ai-variants">{item.variants.length} variants available</p>}
                  </div>


                  <div className="right-content">
                    {item.handle && <a href={`/products/${item.handle}`}>View product</a>}
                    <button onClick={() => addToCart(item)} className="ai-add-btn">Add</button>
                    <button onClick={() => toggleShortlist(item.handle)} className={`ai-shortlist ${shortlist.includes(item.handle) ? 'active' : ''}`}>{shortlist.includes(item.handle) ? "Saved" : "Save"}</button>
                    <button onClick={() => toggleCompare(item.handle)} className={`ai-compare ${compare.includes(item.handle) ? 'active' : ''}`}>{compare.includes(item.handle) ? "Comparing" : "Compare"}</button>
                  </div>
                </div>


                {/* bundles */}
                {item.bundles?.length > 0 && (
                  <div className="ai-bundles">
                    <p className="small-label">Frequently bought together</p>
                    <div className="bundle-list">
                      {item.bundles.map((b, i) => (
                        <div key={i} className="bundle-card">
                          <div className="bundle-title">{b.title}</div>
                          <div className="bundle-price">{formatMoney(b.price)}</div>
                          <button onClick={() => addBundleToCart([b])}>Add bundle</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}


                {/* alternatives / upsell */}
                {item.alternatives?.length > 0 && (
                  <div className="ai-alternatives">
                    <p className="small-label">Better alternative</p>
                    <div className="alt-list">
                      {item.alternatives.map((a, i) => (
                        <div key={i} className="alt-card">
                          <div className="alt-title">{a.title}</div>
                          <div className="alt-price">{formatMoney(a.price)}</div>
                          <a className="alt-link" href={`/products/${a.handle}`}>View</a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}


        {/* empty state */}
        {!status.loading && results?.length === 0 && (
          <p className="ai-empty">No matching products found. Try different keywords.</p>
        )}


        {/* Compare panel */}
        {renderComparePanel()}


        {/* Recently viewed & shortlist */}
        <div className="ai-footer-panels">
          {/*recentlyViewed?.length > 0 && (
            <div className="ai-recently">
              <h4>Recently recommended</h4>
              <div className="mini-list">
                {recentlyViewed.map((r) => (
                  <div key={r.handle} className="mini-item">
                    <div>{r.title}</div>
                    <div className="mini-actions">
                      <a href={`/products/${r.handle}`}>View</a>
                      <button onClick={() => addToCart(r)}>Add</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )*/}


          {shortlist?.length > 0 && (
            <div className="ai-shortlist-panel">
              <h4>Shortlist</h4>
              <ul>
                {shortlist.map((handle) => (
                  <li key={handle}><a href={`/products/${handle}`}>{handle}</a></li>
                ))}
              </ul>
            </div>
          )}
        </div>


      </div>
    </>
  );
}
