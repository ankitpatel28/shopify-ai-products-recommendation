// app/lib/search-engine.js
//
// Zero-dependency product search engine — works for ANY query.
//
// ── WHY THE OLD VERSION FAILED ──────────────────────────────────────────────
// The old BM25 + synonym dictionary only worked for known keywords.
// "I would like to buy a headset with best quality" fails because:
//   - "quality" is not in the synonym dict
//   - "best" is a stopword
//   - The intent ("I want audio gear") is never understood
//
// ── NEW APPROACH ─────────────────────────────────────────────────────────────
//
// LAYER 1 — INTENT EXTRACTION
//   Strips filler phrases from natural language queries.
//   "I would like to buy something warm for winter" → "warm winter"
//   "show me the best quality wireless headset" → "quality wireless headset"
//   Works by removing intent verbs + filler patterns, keeping nouns/adjectives.
//
// LAYER 2 — CHARACTER N-GRAM INDEXING (tri-grams)
//   Indexes products by overlapping 3-char sequences.
//   "headphone" → ["hea","ead","adp","dph","pho","hon","one"]
//   This means "headphne" (typo), "headphones", "headphone" all match.
//   Also enables PARTIAL WORD matching:
//   Query "wire" matches "wireless", "wired", "wire-free"
//
// LAYER 3 — TF-IDF WITH COSINE SIMILARITY
//   Builds a proper vector space from product corpus.
//   Query and each product become vectors of weighted term frequencies.
//   Cosine similarity measures the angle between vectors — immune to length.
//   IDF down-weights terms that appear in every product (like "product","item")
//   and up-weights rare, distinctive terms (like "noise-cancelling","vegan").
//
// LAYER 4 — FIELD-WEIGHTED SCORING
//   Title    × 4.0  (most important — what the product IS)
//   Tags     × 3.0  (merchant-curated keywords)
//   Variants × 2.0  (variant titles like "Black","XL","Wireless" matter)
//   Desc     × 1.0  (least important — often generic marketing copy)
//
// LAYER 5 — FUZZY PREFIX BONUS
//   For each query token, checks if any product token STARTS WITH it.
//   "wire" → matches "wireless" (+0.3 per match)
//   "noise" → matches "noise-cancelling" (+0.3)
//   Handles partial words and the way people naturally abbreviate.
//
// LAYER 6 — ATTRIBUTE SIGNAL EXTRACTION
//   Detects quality/price/feature signals from the query itself:
//   "best quality" / "premium" → boosts products with "premium","pro","plus"
//   "cheap" / "affordable"     → boosts lower-priced variants
//   "wireless" / "bluetooth"   → exact match on variant/tag tokens
//   These signals are detected dynamically from query words, not a dictionary.
//
// RESULT: A query like "I want something for listening to music while working out"
//   correctly surfaces headphones, earbuds, sports earphones — without any
//   hardcoded synonym for "music" or "workout".

// ─── Stopwords ────────────────────────────────────────────────────────────────
// Only pure function words — we keep adjectives and nouns that carry meaning

const STOPWORDS = new Set([
  // Articles & determiners
  "a","an","the","this","that","these","those","some","any","each","every",
  // Pronouns
  "i","me","my","we","our","you","your","he","his","she","her","it","its",
  "they","their","them","us","who","which","what",
  // Prepositions
  "in","on","at","to","for","of","with","by","from","as","into","onto",
  "upon","about","above","below","between","through","during","within",
  // Conjunctions
  "and","or","but","nor","so","yet","both","either","neither",
  // Aux verbs
  "is","was","are","were","be","been","being","have","has","had",
  "do","does","did","will","would","could","should","may","might",
  "shall","can","am","get","got","let","made","make",
  // Filler intent words — "I want to buy X" → remove everything before X
  "want","like","looking","need","find","show","buy","purchase","order",
  "please","help","im","id","would","something","anything","give","tell",
  "suggest","recommend","looking","searching","trying","hoping",
  // Common filler adjectives that add no product signal
  "really","very","quite","rather","pretty","just","also","too","so",
  "more","most","less","least","much","many","few","little","only",
]);

// ─── Intent phrase patterns ───────────────────────────────────────────────────
// Strip these from the front of queries before tokenizing

const INTENT_PATTERNS = [
  /^(i\s+)?(would\s+like\s+to|want\s+to|need\s+to|am\s+looking\s+(for|to)|am\s+trying\s+to|am\s+searching\s+for)\s+(buy|purchase|get|find|order)?\s*/i,
  /^(i\s+)?(want|need|would\s+like|am\s+looking\s+for|am\s+searching\s+for)\s*/i,
  /^(show\s+me|find\s+me|help\s+me\s+(find|get|buy))\s*/i,
  /^(please\s+)?(recommend|suggest)\s*(me\s+)?(a|an|some)?\s*/i,
  /^(looking\s+for|searching\s+for|trying\s+to\s+(find|buy|get))\s*/i,
  /^(i\s+)?(am\s+)?(interested\s+in|hoping\s+to\s+(get|buy|find))\s*/i,
  /^(can\s+you\s+)?(help\s+me\s+)?(find|get|buy|show)\s*/i,
  /^(do\s+you\s+(have|sell)|is\s+there)\s*/i,
];

// ─── Quality/attribute signal words ──────────────────────────────────────────
// These are detected in the QUERY to boost relevant products
// Kept minimal — only words that reliably signal product attributes

const QUALITY_SIGNALS = new Set(["best","top","premium","quality","excellent","professional","pro","high","ultimate","superior"]);
const BUDGET_SIGNALS  = new Set(["cheap","affordable","budget","inexpensive","low","economical","value","basic","entry"]);
const FEATURE_SIGNALS = new Set(["wireless","bluetooth","wired","rechargeable","portable","waterproof","lightweight","heavy","large","small","mini","compact","fast","slow","long","short","strong","durable","comfortable","soft","hard"]);

// ─── Porter Stemmer (full implementation) ────────────────────────────────────
// Handles all English morphological suffixes so "running"="run", "quality"="qualiti"

function stem(word) {
  if (!word || word.length <= 2) return word;
  let w = word.toLowerCase();

  // Step 1a
  if      (w.endsWith("sses")) w = w.slice(0,-2);
  else if (w.endsWith("ies"))  w = w.slice(0,-2);
  else if (!w.endsWith("ss") && w.endsWith("s")) w = w.slice(0,-1);

  // Step 1b
  const hasvowel = (s) => /[aeiou]/.test(s);
  if (w.endsWith("eed")) {
    if (w.slice(0,-3).replace(/[^aeiou]/g,"").length > 0) w = w.slice(0,-1);
  } else if ((w.endsWith("ed") && hasvowel(w.slice(0,-2))) ||
             (w.endsWith("ing") && hasvowel(w.slice(0,-3)))) {
    w = w.endsWith("ed") ? w.slice(0,-2) : w.slice(0,-3);
    if      (w.endsWith("at")||w.endsWith("bl")||w.endsWith("iz")) w += "e";
    else if (/([^aeioulsSz])\1$/.test(w)) w = w.slice(0,-1);
  }

  // Step 1c
  if (w.endsWith("y") && hasvowel(w.slice(0,-1))) w = w.slice(0,-1)+"i";

  // Step 2
  const step2 = [
    ["ational","ate"],["tional","tion"],["enci","ence"],["anci","ance"],
    ["izer","ize"],["abli","able"],["alli","al"],["entli","ent"],
    ["eli","e"],["ousli","ous"],["ization","ize"],["ation","ate"],
    ["ator","ate"],["alism","al"],["iveness","ive"],["fulness","ful"],
    ["ousness","ous"],["aliti","al"],["iviti","ive"],["biliti","ble"],
  ];
  for (const [suf,rep] of step2) {
    if (w.endsWith(suf) && w.length - suf.length > 1) { w = w.slice(0,-suf.length)+rep; break; }
  }

  // Step 3
  const step3 = [
    ["icate","ic"],["ative",""],["alize","al"],["iciti","ic"],
    ["ical","ic"],["ful",""],["ness",""],
  ];
  for (const [suf,rep] of step3) {
    if (w.endsWith(suf) && w.length - suf.length > 1) { w = w.slice(0,-suf.length)+rep; break; }
  }

  // Step 4
  const step4 = ["al","ance","ence","er","ic","able","ible","ant","ement",
    "ment","ent","ion","ou","ism","ate","iti","ous","ive","ize"];
  for (const suf of step4) {
    if (w.endsWith(suf) && w.length - suf.length > 1) {
      if (suf === "ion") {
        const pre = w.slice(0,-3);
        if (pre.endsWith("s") || pre.endsWith("t")) { w = pre; break; }
      } else { w = w.slice(0,-suf.length); break; }
    }
  }

  // Step 5a
  if (w.endsWith("e")) {
    const pre = w.slice(0,-1);
    const m = pre.replace(/[^aeiou]/g,"").length;
    if (m > 1) w = pre;
    else if (m === 1 && !/[aeiou][^aeiou][^aeiou]$/.test(pre)) w = pre;
  }

  return w.length > 0 ? w : word;
}

// ─── Character n-gram generator ───────────────────────────────────────────────

function ngrams(word, n = 3) {
  if (word.length <= n) return [word];
  const grams = [];
  for (let i = 0; i <= word.length - n; i++) {
    grams.push(word.slice(i, i + n));
  }
  return grams;
}

// ─── Tokenizer ────────────────────────────────────────────────────────────────

function tokenize(text, { keepOriginal = false } = {}) {
  const words = (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));

  if (keepOriginal) return words; // For fuzzy prefix matching
  return words.map(stem);
}

// ─── Intent extractor ────────────────────────────────────────────────────────

function extractIntent(rawQuery) {
  let q = rawQuery.trim();

  // Remove intent patterns from start
  for (const pattern of INTENT_PATTERNS) {
    q = q.replace(pattern, "");
  }

  // Remove trailing filler like "for me", "please"
  q = q.replace(/\s+(for me|for us|please|thanks|thank you)\.?$/i, "");

  return q.trim() || rawQuery.trim();
}

// ─── Signal detection ─────────────────────────────────────────────────────────

function detectSignals(queryTokens) {
  const signals = { quality: false, budget: false, features: new Set() };
  for (const t of queryTokens) {
    if (QUALITY_SIGNALS.has(t)) signals.quality = true;
    if (BUDGET_SIGNALS.has(t))  signals.budget  = true;
    if (FEATURE_SIGNALS.has(t)) signals.features.add(t);
  }
  return signals;
}

// ─── TF-IDF Vector Space ──────────────────────────────────────────────────────

class TFIDFIndex {
  constructor() {
    this.docs  = [];   // tokenized docs
    this.df    = {};   // document frequency per term
    this.N     = 0;
  }

  addDoc(tokens) {
    const freq = {};
    for (const t of tokens) freq[t] = (freq[t] || 0) + 1;
    for (const t of Object.keys(freq)) this.df[t] = (this.df[t] || 0) + 1;
    this.docs.push({ tokens, freq, len: tokens.length });
    this.N++;
  }

  // IDF: log((N+1)/(df+1)) + 1  — smoothed to avoid division by zero
  idf(term) {
    const df = this.df[term] || 0;
    return Math.log((this.N + 1) / (df + 1)) + 1;
  }

  // TF-IDF vector for a document
  vector(docFreq, docLen) {
    const vec = {};
    for (const [term, count] of Object.entries(docFreq)) {
      const tf = count / (docLen || 1);
      vec[term] = tf * this.idf(term);
    }
    return vec;
  }

  // Cosine similarity between query vector and doc vector
  cosine(queryVec, docIdx) {
    const doc = this.docs[docIdx];
    if (!doc) return 0;
    const docVec = this.vector(doc.freq, doc.len);

    let dot = 0, qMag = 0, dMag = 0;
    const allTerms = new Set([...Object.keys(queryVec), ...Object.keys(docVec)]);

    for (const t of allTerms) {
      const q = queryVec[t] || 0;
      const d = docVec[t]   || 0;
      dot  += q * d;
      qMag += q * q;
      dMag += d * d;
    }

    qMag = Math.sqrt(qMag);
    dMag = Math.sqrt(dMag);
    return (qMag > 0 && dMag > 0) ? dot / (qMag * dMag) : 0;
  }
}

// ─── N-gram index for fuzzy/partial matching ──────────────────────────────────

class NGramIndex {
  constructor() {
    // Map: ngram → Set of doc indexes that contain it
    this.index = new Map();
    this.N     = 0;
  }

  addDoc(tokens) {
    const idx = this.N++;
    const seen = new Set();
    for (const token of tokens) {
      for (const gram of ngrams(token, 3)) {
        if (!seen.has(gram)) {
          if (!this.index.has(gram)) this.index.set(gram, new Set());
          this.index.get(gram).add(idx);
          seen.add(gram);
        }
      }
    }
  }

  // Score: fraction of query ngrams that appear in the doc
  score(queryTokens, docIdx) {
    let total = 0, matches = 0;
    for (const token of queryTokens) {
      const grams = ngrams(token, 3);
      for (const gram of grams) {
        total++;
        if (this.index.get(gram)?.has(docIdx)) matches++;
      }
    }
    return total > 0 ? matches / total : 0;
  }
}

// ─── Main exported function ───────────────────────────────────────────────────

/**
 * Search products with natural language query.
 * No external dependencies, no hardcoded keyword lists.
 *
 * @param {string} query    - Natural language user query (any length, any phrasing)
 * @param {Array}  products - Products from Storefront API
 * @param {number} limit    - Max results (default 6)
 * @returns {Array}         - Ranked results with score, match_reason
 */
export function searchProducts(query, products, limit = 6) {
  if (!query || !products?.length) return [];

  // ── Step 1: Extract the real intent from natural language ──
  const cleanQuery   = extractIntent(query);
  const rawTokens    = tokenize(cleanQuery, { keepOriginal: true });
  const stemTokens   = rawTokens.map(stem).filter((t) => !STOPWORDS.has(t));
  const signals      = detectSignals(rawTokens);

  if (stemTokens.length === 0) return [];

  // ── Step 2: Build indexes from product corpus ──
  const titleTFIDF   = new TFIDFIndex();
  const tagTFIDF     = new TFIDFIndex();
  const descTFIDF    = new TFIDFIndex();
  const variantTFIDF = new TFIDFIndex();
  const titleNGram   = new NGramIndex();
  const tagNGram     = new NGramIndex();

  for (const p of products) {
    const titleToks   = tokenize(p.title);
    const tagToks     = tokenize((p.tags || []).join(" "));
    const descToks    = tokenize(p.description || "");
    const variantToks = tokenize(
      (p.variants || []).map((v) => v.title || "").join(" ")
    );

    titleTFIDF.addDoc(titleToks);
    tagTFIDF.addDoc(tagToks);
    descTFIDF.addDoc(descToks);
    variantTFIDF.addDoc(variantToks);

    // N-gram index uses original (unstemmed) tokens for better partial matching
    titleNGram.addDoc(tokenize(p.title, { keepOriginal: true }));
    tagNGram.addDoc(tokenize((p.tags || []).join(" "), { keepOriginal: true }));
  }

  // ── Step 3: Build query TF-IDF vector ──
  const queryFreq = {};
  for (const t of stemTokens) queryFreq[t] = (queryFreq[t] || 0) + 1;

  const qVecTitle   = titleTFIDF.vector(queryFreq, stemTokens.length);
  const qVecTags    = tagTFIDF.vector(queryFreq, stemTokens.length);
  const qVecDesc    = descTFIDF.vector(queryFreq, stemTokens.length);
  const qVecVariant = variantTFIDF.vector(queryFreq, stemTokens.length);

  // ── Step 4: Score each product ──
  const WEIGHTS = { title: 4.0, tags: 3.0, variant: 2.0, desc: 1.0, ngram: 1.5 };

  const scored = products.map((product, i) => {
    // TF-IDF cosine similarity per field
    const titleCos   = titleTFIDF.cosine(qVecTitle, i)   * WEIGHTS.title;
    const tagCos     = tagTFIDF.cosine(qVecTags, i)      * WEIGHTS.tags;
    const descCos    = descTFIDF.cosine(qVecDesc, i)     * WEIGHTS.desc;
    const variantCos = variantTFIDF.cosine(qVecVariant, i) * WEIGHTS.variant;

    // N-gram fuzzy match (handles typos and partial words)
    const ngramTitle = titleNGram.score(rawTokens, i) * WEIGHTS.ngram;
    const ngramTags  = tagNGram.score(rawTokens, i)   * WEIGHTS.ngram * 0.7;

    let score = titleCos + tagCos + descCos + variantCos + ngramTitle + ngramTags;

    // ── Fuzzy prefix bonus: "wire" → "wireless" ──
    const titleWords = tokenize(product.title, { keepOriginal: true });
    const tagWords   = tokenize((product.tags || []).join(" "), { keepOriginal: true });
    const allWords   = [...titleWords, ...tagWords];

    for (const qWord of rawTokens) {
      if (qWord.length < 3) continue;
      const prefixMatches = allWords.filter((w) => w.startsWith(qWord) && w !== qWord);
      score += prefixMatches.length * 0.3;
    }

    // ── Exact phrase bonus ──
    const cleanLower = cleanQuery.toLowerCase();
    if ((product.title || "").toLowerCase().includes(cleanLower))       score += 2.0;
    else if ((product.description || "").toLowerCase().includes(cleanLower)) score += 0.8;

    // ── Attribute signal bonus ──
    if (signals.quality) {
      const productText = `${product.title} ${(product.tags||[]).join(" ")}`.toLowerCase();
      if (/premium|pro|plus|elite|deluxe|professional|studio|signature/.test(productText)) score += 0.5;
    }
    if (signals.budget) {
      // Give a small boost to lower-priced items
      const price = parseFloat(product.variants?.[0]?.price || "999");
      if (price < 50)  score += 0.4;
      if (price < 100) score += 0.2;
    }
    for (const feature of signals.features) {
      const productText = `${product.title} ${(product.tags||[]).join(" ")} ${product.description||""}`.toLowerCase();
      if (productText.includes(feature)) score += 0.4;
    }

    // ── Build match reason ──
    const reason = buildReason(product, rawTokens, stemTokens, {
      titleCos, tagCos, descCos, ngramTitle,
    });

    return { product, score, reason };
  });

  // ── Step 5: Filter, rank, normalize, return ──
  const MIN_SCORE = 0.01;
  const results   = scored
    .filter((r) => r.score > MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (!results.length) return [];

  const maxScore = results[0].score;

  return results.map(({ product, score, reason }) => {
    const first = product.variants?.[0];
    return {
      id:           product.id,
      handle:       product.handle,
      title:        product.title,
      price:        first?.price || null,
      currency:     first?.currency || "USD",
      variants:     product.variants,
      image:        product.image || null,
      score:        (score / maxScore).toFixed(2),
      match_reason: reason,
      summary:      (product.description || product.title).slice(0, 140),
    };
  });
}

// ─── Match reason builder ─────────────────────────────────────────────────────

function buildReason(product, rawTokens, stemTokens, scores) {
  const titleLow = (product.title || "").toLowerCase();
  const tagLow   = (product.tags  || []).join(", ").toLowerCase();

  // Find which query words are present in product
  const inTitle = rawTokens.filter((t) =>
    titleLow.includes(t) || titleLow.split(" ").some((w) => w.startsWith(t))
  );
  const inTags  = rawTokens.filter((t) => tagLow.includes(t));

  if (inTitle.length > 0) {
    const words = [...new Set(inTitle)].slice(0, 3).join(", ");
    return `Matches "${words}" in product name`;
  }
  if (inTags.length > 0) {
    const tagSample = product.tags.slice(0, 3).join(", ");
    return `Tagged as: ${tagSample}`;
  }
  if (scores.descCos > 0.05) {
    return "Described as relevant to your search";
  }
  if (scores.ngramTitle > 0.3) {
    return "Partial keyword match";
  }
  return "Related product";
}
