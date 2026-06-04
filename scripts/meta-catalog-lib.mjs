export const SHOP_BASE = "https://www.onejikgu.co.kr";

// HTTP status codes worth retrying: transient server faults and rate limiting.
// The local imweb admin API intermittently answers a paginated /api/products
// request with HTTP 500, which previously aborted the whole feed run.
export const TRANSIENT_HTTP_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function backoffDelay(baseDelayMs, attempt, maxDelayMs = 8000) {
  return Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
}

// Fetch JSON from the imweb admin API, retrying transient HTTP 5xx / 429
// responses, JSON-body `statusCode` faults, and network errors with
// exponential backoff before giving up. This keeps a single flaky page from
// failing the entire Naver/Meta/Google feed generation.
export async function fetchJson(url, options = {}) {
  const {
    retries = 4,
    baseDelayMs = 500,
    maxDelayMs = 8000,
    fetchImpl = fetch,
    sleepImpl = sleep,
    onRetry,
  } = options;

  for (let attempt = 0; ; attempt += 1) {
    const canRetry = attempt < retries;

    let response;
    try {
      response = await fetchImpl(url);
    } catch (error) {
      if (!canRetry) throw error;
      onRetry?.({ url: String(url), attempt, reason: error.message });
      await sleepImpl(backoffDelay(baseDelayMs, attempt, maxDelayMs));
      continue;
    }

    if (!response.ok) {
      const message = `GET ${url} HTTP ${response.status}`;
      if (canRetry && TRANSIENT_HTTP_STATUS.has(response.status)) {
        onRetry?.({ url: String(url), attempt, reason: message });
        await sleepImpl(backoffDelay(baseDelayMs, attempt, maxDelayMs));
        continue;
      }
      throw new Error(message);
    }

    let json;
    try {
      json = await response.json();
    } catch (error) {
      const message = `GET ${url} invalid JSON: ${error.message}`;
      if (!canRetry) throw new Error(message);
      onRetry?.({ url: String(url), attempt, reason: message });
      await sleepImpl(backoffDelay(baseDelayMs, attempt, maxDelayMs));
      continue;
    }

    const bodyStatus = Number(json.statusCode);
    if (json.statusCode && bodyStatus !== 200) {
      const message = `GET ${url} statusCode=${json.statusCode}`;
      if (canRetry && TRANSIENT_HTTP_STATUS.has(bodyStatus)) {
        onRetry?.({ url: String(url), attempt, reason: message });
        await sleepImpl(backoffDelay(baseDelayMs, attempt, maxDelayMs));
        continue;
      }
      throw new Error(message);
    }

    return json;
  }
}

export const IHERB_CATEGORIES = [
  { name: "비타민보충제", code: "s202605141c848b6186556", label: "vitamin_supplements" },
  { name: "스포츠 보충제", code: "s202604243ee12b3f395b7", label: "sports_supplements" },
  { name: "허브", code: "s20260424beae688272981", label: "herbs" },
  { name: "식료품", code: "s20260424e024de506e7ce", label: "grocery" },
  { name: "뷰티", code: "s20260424f3fc7fab729c1", label: "beauty" },
  { name: "목욕", code: "s20260424bc7c15b026d2e", label: "bath" },
  { name: "베이비", code: "s2026042448bcffa4cfab3", label: "baby" },
  { name: "반려동물", code: "s2026042486b848c85654f", label: "pet" },
  { name: "생활용품", code: "s2026042433e6d4277c687", label: "household" },
];

export const NAVER_EP_COLUMNS = [
  "id",
  "title",
  "price_pc",
  "normal_price",
  "link",
  "mobile_link",
  "image_link",
  "add_image_link",
  "category_name1",
  "category_name2",
  "condition",
  "import_flag",
  "shipping",
  "shipping_origin",
  "brand",
  "maker",
  "origin",
  "minimum_purchase_quantity",
  "search_tag",
];

export const META_CATALOG_COLUMNS = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "link",
  "image_link",
  "additional_image_link",
  "brand",
  "mpn",
  "google_product_category",
  "product_type",
  "custom_label_0",
  "custom_label_1",
  "custom_label_2",
  "custom_label_3",
  "custom_label_4",
];

export const GOOGLE_MERCHANT_COLUMNS = [
  "id",
  "title",
  "description",
  "link",
  "image_link",
  "additional_image_link",
  "availability",
  "price",
  "condition",
  "brand",
  "identifier_exists",
  "mpn",
  "google_product_category",
  "product_type",
  "custom_label_0",
  "custom_label_1",
  "custom_label_2",
  "custom_label_3",
  "custom_label_4",
];

const BLOCKED_PATTERNS = [
  /\bcbd\b/i,
  /\bthc\b/i,
  /\bcannabis\b/i,
  /\bmarijuana\b/i,
  /\bhemp\b/i,
  /\bdhea\b/i,
  /\bkratom\b/i,
  /\bephedra\b/i,
  /성기능|발기\s*부전|발기력|발기\s*개선|최음/i,
];

const SENSITIVE_PATTERNS = [
  /weight\s*loss|fat\s*burn|diet|detox|cleanse/i,
  /testosterone|hormone|libido|male\s*enhancement/i,
  /melatonin|sleep|anxiety|stress/i,
  /diabetes|blood\s*sugar|cholesterol|blood\s*pressure/i,
  /joint|pain|inflammation|liver/i,
  /다이어트|체중|지방|디톡스|수면|불면|혈당|콜레스테롤|혈압|관절|통증|염증|간\s*건강/i,
];

// Naver Shopping EP category display name + CATE tag per iHerb category bucket,
// reverse-engineered from the published ep.txt feed.
const NAVER_CATEGORY_BY_LABEL = {
  vitamin_supplements: { name: "비타민 영양제", cate: "CATE83" },
  sports_supplements: { name: "스포츠 보충제", cate: "CATE71" },
  herbs: { name: "허브", cate: "CATE72" },
  grocery: { name: "식료품", cate: "CATE75" },
  beauty: { name: "뷰티", cate: "CATE73" },
  bath: { name: "목욕", cate: "CATE74" },
  baby: { name: "베이비", cate: "CATE76" },
  pet: { name: "반려동물", cate: "CATE77" },
  household: { name: "생활용품", cate: "CATE78" },
};

// Free domestic shipping at/above this KRW price; otherwise a flat 6,000 KRW.
export const NAVER_FREE_SHIPPING_THRESHOLD = 40000;
export const NAVER_SHIPPING_FEE = 6000;

const GOOGLE_CATEGORY_BY_LABEL = {
  grocery: "Food, Beverages & Tobacco > Food Items",
  beauty: "Health & Beauty > Personal Care",
  bath: "Health & Beauty > Personal Care",
  baby: "Baby & Toddler",
  pet: "Animals & Pet Supplies",
  household: "Home & Garden",
};

export function clean(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[\t\r\n\v\f\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(value, max) {
  return [...clean(value)].slice(0, max).join("");
}

export function classifyCompliance(text) {
  const value = clean(text);
  if (BLOCKED_PATTERNS.some((pattern) => pattern.test(value))) return "blocked";
  if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(value))) return "sensitive";
  return "safe";
}

export function priceBand(price) {
  if (price < 20000) return "price_under_20000";
  if (price < 50000) return "price_20000_50000";
  return "price_50000_plus";
}

export function stockDepth(product) {
  const status = clean(product.prodStatus).toLowerCase();
  if (status && status !== "sale") return "out_of_stock";
  const stockUse = clean(product.stockUse);
  const stock = Number(product.stockNoOption ?? 0);
  if (stockUse === "Y" && Number.isFinite(stock) && stock > 0 && stock <= 5) {
    return "low_stock";
  }
  return "stable_stock";
}

export function catalogId(product) {
  const customCode = clean(product.customProdCode);
  if (customCode) return customCode;
  const prodNo = Number(product.prodNo ?? 0);
  return prodNo ? String(prodNo) : "";
}

function googleProductCategory(category) {
  return (
    GOOGLE_CATEGORY_BY_LABEL[category.label] ||
    "Health & Beauty > Health Care > Fitness & Nutrition > Vitamins & Supplements"
  );
}

function descriptionFor(product, category) {
  return truncate(
    product.seoDescription ||
      product.summaryDescription ||
      `${clean(product.name)}. iHerb 해외직구 ${category.name} 상품입니다.`,
    5000
  );
}

export function buildMetaCatalogRecord(product, category) {
  const prodNo = Number(product.prodNo ?? 0);
  const id = catalogId(product);
  const title = truncate(product.name, 200);
  const price = Number(product.price ?? 0);
  const productImages = Array.isArray(product.productImages)
    ? product.productImages.map(clean).filter(Boolean)
    : [];

  if (!prodNo || !id || !title || price <= 0 || productImages.length === 0) {
    return null;
  }

  const brand = truncate(product.brand || "iHerb", 100) || "iHerb";
  const compliance = classifyCompliance(`${title} ${brand} ${product.maker || ""}`);
  const availability = clean(product.prodStatus).toLowerCase() === "sale" ? "in stock" : "out of stock";

  return {
    id,
    title,
    description: descriptionFor(product, category),
    availability,
    condition: "new",
    price: `${Math.round(price)} KRW`,
    link: `${SHOP_BASE}/shop_view?idx=${prodNo}`,
    image_link: productImages[0],
    additional_image_link: productImages.slice(1, 10).join(","),
    brand,
    mpn: id,
    google_product_category: googleProductCategory(category),
    product_type: `iHerb > ${category.name}`,
    custom_label_0: category.label,
    custom_label_1: "margin_unknown",
    custom_label_2: stockDepth(product),
    custom_label_3: priceBand(price),
    custom_label_4: compliance,
  };
}

export function buildGoogleMerchantRecord(product, category) {
  const metaRecord = buildMetaCatalogRecord(product, category);
  if (!metaRecord) return null;

  return {
    id: metaRecord.id,
    title: truncate(metaRecord.title, 150),
    description: metaRecord.description,
    link: metaRecord.link,
    image_link: metaRecord.image_link,
    additional_image_link: metaRecord.additional_image_link,
    availability: metaRecord.availability === "in stock" ? "in_stock" : "out_of_stock",
    price: metaRecord.price,
    condition: "new",
    brand: metaRecord.brand,
    identifier_exists: "no",
    mpn: "",
    google_product_category: metaRecord.google_product_category,
    product_type: metaRecord.product_type,
    custom_label_0: metaRecord.custom_label_0,
    custom_label_1: metaRecord.custom_label_1,
    custom_label_2: metaRecord.custom_label_2,
    custom_label_3: metaRecord.custom_label_3,
    custom_label_4: metaRecord.custom_label_4,
  };
}


function naverCategory(category) {
  return NAVER_CATEGORY_BY_LABEL[category.label] || { name: category.name, cate: "" };
}

export function naverShipping(price) {
  return price >= NAVER_FREE_SHIPPING_THRESHOLD ? "0" : String(NAVER_SHIPPING_FEE);
}

// Build a Naver Shopping EP row. The EP is a sale-only feed, so sold-out and
// otherwise unavailable products are dropped (returns null) rather than carried
// as out-of-stock. Blocked-compliance rows are flagged via custom_label_4-style
// `compliance` so the generator can route them to the excluded review file.
export function buildNaverEpRecord(product, category) {
  const prodNo = Number(product.prodNo ?? 0);
  const id = catalogId(product);
  const title = truncate(product.name, 100);
  const price = Number(product.price ?? 0);
  const productImages = Array.isArray(product.productImages)
    ? product.productImages.map(clean).filter(Boolean)
    : [];

  if (!prodNo || !id || !title || price <= 0 || productImages.length === 0) {
    return null;
  }

  // Sale-only feed: keep on-sale products, drop everything else.
  if (clean(product.prodStatus).toLowerCase() !== "sale") {
    return null;
  }

  const brand = truncate(product.brand || "iHerb", 100) || "iHerb";
  const maker = truncate(product.maker, 100) || brand;
  const { name: categoryName, cate } = naverCategory(category);
  const link = `${SHOP_BASE}/shop_view?idx=${prodNo}`;
  const compliance = classifyCompliance(`${title} ${brand} ${product.maker || ""}`);
  const searchTag = [brand, "iHerb", "아이허브", "해외직구", categoryName, cate]
    .filter(Boolean)
    .join(",");

  return {
    id,
    title,
    price_pc: String(Math.round(price)),
    normal_price: "",
    link,
    mobile_link: link,
    image_link: productImages[0],
    add_image_link: productImages.slice(1).join(","),
    category_name1: "iHerb",
    category_name2: categoryName,
    condition: "신상품",
    import_flag: "Y",
    shipping: naverShipping(price),
    shipping_origin: "미국",
    brand,
    maker,
    origin: "미국",
    minimum_purchase_quantity: "1",
    search_tag: searchTag,
    compliance,
  };
}

export function productSortKey(product) {
  const addTime = typeof product.addTime === "string" ? Date.parse(product.addTime) : Number.NaN;
  if (Number.isFinite(addTime)) return addTime;
  const editTime = typeof product.editTime === "string" ? Date.parse(product.editTime) : Number.NaN;
  if (Number.isFinite(editTime)) return editTime;
  const prodNo = Number(product.prodNo ?? 0);
  return Number.isFinite(prodNo) ? prodNo : 0;
}

export function rowsToTsv(rows) {
  const lines = [META_CATALOG_COLUMNS.join("\t")];
  for (const row of rows) {
    lines.push(META_CATALOG_COLUMNS.map((column) => clean(row[column])).join("\t"));
  }
  return `${lines.join("\n")}\n`;
}

export function naverRowsToTsv(rows) {
  const lines = [NAVER_EP_COLUMNS.join("\t")];
  for (const row of rows) {
    lines.push(NAVER_EP_COLUMNS.map((column) => clean(row[column])).join("\t"));
  }
  return `${lines.join("\n")}\n`;
}

export function googleRowsToTsv(rows) {
  const lines = [GOOGLE_MERCHANT_COLUMNS.join("\t")];
  for (const row of rows) {
    lines.push(GOOGLE_MERCHANT_COLUMNS.map((column) => clean(row[column])).join("\t"));
  }
  return `${lines.join("\n")}\n`;
}
