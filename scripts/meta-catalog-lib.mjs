export const SHOP_BASE = "https://www.onejikgu.co.kr";

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

export function googleRowsToTsv(rows) {
  const lines = [GOOGLE_MERCHANT_COLUMNS.join("\t")];
  for (const row of rows) {
    lines.push(GOOGLE_MERCHANT_COLUMNS.map((column) => clean(row[column])).join("\t"));
  }
  return `${lines.join("\n")}\n`;
}
