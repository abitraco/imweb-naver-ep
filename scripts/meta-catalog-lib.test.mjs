import assert from "node:assert/strict";
import test from "node:test";

import {
  GOOGLE_MERCHANT_COLUMNS,
  META_CATALOG_COLUMNS,
  NAVER_EP_COLUMNS,
  buildGoogleMerchantRecord,
  buildMetaCatalogRecord,
  buildNaverEpRecord,
  classifyCompliance,
  fetchJson,
  googleRowsToTsv,
  naverRowsToTsv,
  naverShipping,
  rowsToTsv,
} from "./meta-catalog-lib.mjs";

const vitaminCategory = {
  name: "비타민보충제",
  code: "s202605141c848b6186556",
  label: "vitamin_supplements",
};

test("buildMetaCatalogRecord emits Meta-required fields with stable iHerb id", () => {
  const product = {
    prodNo: 82267,
    customProdCode: "iherb-12345",
    name: "[iHerb]Now Foods Magnesium Glycinate",
    price: 27580,
    prodStatus: "sale",
    productImages: ["https://cdn.example.com/main.jpg", "https://cdn.example.com/extra.jpg"],
    brand: "NOW Foods",
    maker: "NOW Foods",
    weight: 0.25,
    addTime: "2026-04-24T02:49:34.000Z",
  };

  const record = buildMetaCatalogRecord(product, vitaminCategory);

  assert.equal(record.id, "iherb-12345");
  assert.equal(record.title, "[iHerb]Now Foods Magnesium Glycinate");
  assert.equal(record.availability, "in stock");
  assert.equal(record.condition, "new");
  assert.equal(record.price, "27580 KRW");
  assert.equal(record.link, "https://www.onejikgu.co.kr/shop_view?idx=82267");
  assert.equal(record.image_link, "https://cdn.example.com/main.jpg");
  assert.equal(record.additional_image_link, "https://cdn.example.com/extra.jpg");
  assert.equal(record.brand, "NOW Foods");
  assert.equal(record.mpn, "iherb-12345");
  assert.equal(record.product_type, "iHerb > 비타민보충제");
  assert.equal(record.custom_label_0, "vitamin_supplements");
  assert.equal(record.custom_label_3, "price_20000_50000");
  assert.equal(record.custom_label_4, "safe");
});

test("buildGoogleMerchantRecord emits Google Merchant fields without guessed identifiers", () => {
  const product = {
    prodNo: 82267,
    customProdCode: "iherb-12345",
    name: "[iHerb]Now Foods Magnesium Glycinate",
    price: 27580,
    prodStatus: "sale",
    productImages: ["https://cdn.example.com/main.jpg", "https://cdn.example.com/extra.jpg"],
    brand: "NOW Foods",
    maker: "NOW Foods",
    weight: 0.25,
    addTime: "2026-04-24T02:49:34.000Z",
  };

  const record = buildGoogleMerchantRecord(product, vitaminCategory);

  assert.equal(record.id, "iherb-12345");
  assert.equal(record.title, "[iHerb]Now Foods Magnesium Glycinate");
  assert.equal(record.availability, "in_stock");
  assert.equal(record.condition, "new");
  assert.equal(record.price, "27580 KRW");
  assert.equal(record.link, "https://www.onejikgu.co.kr/shop_view?idx=82267");
  assert.equal(record.image_link, "https://cdn.example.com/main.jpg");
  assert.equal(record.additional_image_link, "https://cdn.example.com/extra.jpg");
  assert.equal(record.brand, "NOW Foods");
  assert.equal(record.identifier_exists, "no");
  assert.equal(record.mpn, "");
  assert.equal(record.product_type, "iHerb > 비타민보충제");
  assert.equal(record.custom_label_0, "vitamin_supplements");
  assert.equal(record.custom_label_4, "safe");
});

test("buildGoogleMerchantRecord maps soldout products to Google availability values", () => {
  const record = buildGoogleMerchantRecord(
    {
      prodNo: 82250,
      customProdCode: "iherb-67890",
      name: "Quality of Life Kinoko Gold",
      price: 86250,
      prodStatus: "soldout",
      productImages: ["https://cdn.example.com/main.jpg"],
      brand: "Quality of Life",
    },
    vitaminCategory
  );

  assert.equal(record.availability, "out_of_stock");
});

test("buildMetaCatalogRecord keeps soldout products in catalog as out of stock", () => {
  const record = buildMetaCatalogRecord(
    {
      prodNo: 82250,
      customProdCode: "iherb-67890",
      name: "Quality of Life Kinoko Gold",
      price: 86250,
      prodStatus: "soldout",
      productImages: ["https://cdn.example.com/main.jpg"],
      brand: "Quality of Life",
    },
    vitaminCategory
  );

  assert.equal(record.availability, "out of stock");
  assert.equal(record.custom_label_2, "out_of_stock");
});

test("buildMetaCatalogRecord returns null for invalid products", () => {
  assert.equal(
    buildMetaCatalogRecord(
      {
        prodNo: 1,
        customProdCode: "iherb-1",
        name: "No image",
        price: 1000,
        prodStatus: "sale",
        productImages: [],
      },
      vitaminCategory
    ),
    null
  );
});

test("classifyCompliance blocks high-risk substances and labels softer health claims", () => {
  assert.equal(classifyCompliance("Hemp CBD Oil 30ml"), "blocked");
  assert.equal(classifyCompliance("DHEA Hormone Support"), "blocked");
  assert.equal(classifyCompliance("Melatonin Sleep Support"), "sensitive");
  assert.equal(classifyCompliance("Vitamin C 1000mg"), "safe");
  assert.equal(classifyCompliance("헤어 젤 강력한 고정력"), "safe");
  assert.equal(classifyCompliance("실리콘 젖꼭지 치발기 보유"), "safe");
});

test("rowsToTsv writes stable columns and strips TSV-hostile characters", () => {
  const rows = [
    Object.fromEntries(META_CATALOG_COLUMNS.map((column) => [column, ""])) ,
  ];
  rows[0].id = "iherb-1";
  rows[0].title = "Line\tBreak\nTitle";

  const tsv = rowsToTsv(rows);
  const lines = tsv.split("\n");

  assert.equal(lines[0], META_CATALOG_COLUMNS.join("\t"));
  assert.equal(lines[1].split("\t").length, META_CATALOG_COLUMNS.length);
  assert.match(lines[1], /^iherb-1\tLine Break Title\t/);
});

test("buildNaverEpRecord emits Naver EP fields with shipping and search tags", () => {
  const product = {
    prodNo: 87114,
    customProdCode: "iherb-155802",
    name: "[iHerb]Cup4Cup 콘브레드 믹스 글루텐 무함유 400g",
    price: 15950,
    prodStatus: "sale",
    productImages: [
      "https://cdn.example.com/main.jpg",
      "https://cdn.example.com/extra1.jpg",
      "https://cdn.example.com/extra2.jpg",
    ],
    brand: "Cup4Cup",
    maker: "Cup4Cup",
  };

  const record = buildNaverEpRecord(product, vitaminCategory);

  assert.equal(record.id, "iherb-155802");
  assert.equal(record.title, "[iHerb]Cup4Cup 콘브레드 믹스 글루텐 무함유 400g");
  assert.equal(record.price_pc, "15950");
  assert.equal(record.normal_price, "");
  assert.equal(record.link, "https://www.onejikgu.co.kr/shop_view?idx=87114");
  assert.equal(record.mobile_link, record.link);
  assert.equal(record.image_link, "https://cdn.example.com/main.jpg");
  assert.equal(
    record.add_image_link,
    "https://cdn.example.com/extra1.jpg,https://cdn.example.com/extra2.jpg"
  );
  assert.equal(record.category_name1, "iHerb");
  assert.equal(record.category_name2, "비타민 영양제");
  assert.equal(record.condition, "신상품");
  assert.equal(record.import_flag, "Y");
  assert.equal(record.shipping, "6000");
  assert.equal(record.shipping_origin, "미국");
  assert.equal(record.brand, "Cup4Cup");
  assert.equal(record.maker, "Cup4Cup");
  assert.equal(record.origin, "미국");
  assert.equal(record.minimum_purchase_quantity, "1");
  assert.equal(record.search_tag, "Cup4Cup,iHerb,아이허브,해외직구,비타민 영양제,CATE83");
  assert.equal(record.compliance, "safe");
});

test("buildNaverEpRecord gives free shipping at or above the threshold", () => {
  assert.equal(naverShipping(39990), "6000");
  assert.equal(naverShipping(40000), "0");

  const record = buildNaverEpRecord(
    {
      prodNo: 90001,
      customProdCode: "iherb-90001",
      name: "[iHerb]California Gold Nutrition Omega-3",
      price: 41000,
      prodStatus: "sale",
      productImages: ["https://cdn.example.com/main.jpg"],
      brand: "California Gold Nutrition",
      maker: "California Gold Nutrition",
    },
    { name: "스포츠 보충제", code: "x", label: "sports_supplements" }
  );

  assert.equal(record.shipping, "0");
  assert.equal(record.add_image_link, "");
  assert.equal(record.category_name2, "스포츠 보충제");
  assert.equal(record.search_tag.endsWith(",CATE71"), true);
});

test("buildNaverEpRecord drops sold-out products from the sale-only feed", () => {
  assert.equal(
    buildNaverEpRecord(
      {
        prodNo: 82250,
        customProdCode: "iherb-67890",
        name: "Quality of Life Kinoko Gold",
        price: 86250,
        prodStatus: "soldout",
        productImages: ["https://cdn.example.com/main.jpg"],
        brand: "Quality of Life",
      },
      vitaminCategory
    ),
    null
  );
});

test("buildNaverEpRecord flags blocked compliance and defaults brand to iHerb", () => {
  const record = buildNaverEpRecord(
    {
      prodNo: 70001,
      customProdCode: "iherb-70001",
      name: "Hemp CBD Oil 30ml",
      price: 30000,
      prodStatus: "sale",
      productImages: ["https://cdn.example.com/main.jpg"],
    },
    vitaminCategory
  );

  assert.equal(record.compliance, "blocked");
  assert.equal(record.brand, "iHerb");
  assert.equal(record.maker, "iHerb");
});

test("naverRowsToTsv writes the published Naver EP columns and drops metadata", () => {
  const record = buildNaverEpRecord(
    {
      prodNo: 87114,
      customProdCode: "iherb-155802",
      name: "[iHerb]Cup4Cup 콘브레드 믹스",
      price: 15950,
      prodStatus: "sale",
      productImages: ["https://cdn.example.com/main.jpg"],
      brand: "Cup4Cup",
      maker: "Cup4Cup",
    },
    vitaminCategory
  );

  const tsv = naverRowsToTsv([record]);
  const lines = tsv.split("\n");

  assert.equal(lines[0], NAVER_EP_COLUMNS.join("\t"));
  assert.equal(lines[1].split("\t").length, NAVER_EP_COLUMNS.length);
  // `compliance` is internal routing metadata and must not leak into the EP.
  assert.equal(lines[1].includes("safe"), false);
});

test("fetchJson retries transient HTTP 500 then succeeds", async () => {
  let calls = 0;
  const delays = [];
  const fetchImpl = async () => {
    calls += 1;
    if (calls < 3) {
      return { ok: false, status: 500 };
    }
    return { ok: true, status: 200, json: async () => ({ statusCode: 200, data: { list: [] } }) };
  };

  const json = await fetchJson("http://admin/api/products", {
    fetchImpl,
    sleepImpl: async (ms) => {
      delays.push(ms);
    },
  });

  assert.equal(calls, 3);
  assert.deepEqual(delays, [500, 1000]);
  assert.deepEqual(json.data.list, []);
});

test("fetchJson surfaces HTTP 500 after exhausting retries", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: false, status: 500 };
  };

  await assert.rejects(
    fetchJson("http://admin/api/products", {
      retries: 2,
      fetchImpl,
      sleepImpl: async () => {},
    }),
    /HTTP 500/
  );
  assert.equal(calls, 3);
});

test("fetchJson does not retry non-transient HTTP 404", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: false, status: 404 };
  };

  await assert.rejects(
    fetchJson("http://admin/api/products", { fetchImpl, sleepImpl: async () => {} }),
    /HTTP 404/
  );
  assert.equal(calls, 1);
});

test("fetchJson retries transient statusCode in the JSON body", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls < 2) {
      return { ok: true, status: 200, json: async () => ({ statusCode: 503 }) };
    }
    return { ok: true, status: 200, json: async () => ({ statusCode: 200, data: { ok: true } }) };
  };

  const json = await fetchJson("http://admin/api/products", {
    fetchImpl,
    sleepImpl: async () => {},
  });

  assert.equal(calls, 2);
  assert.equal(json.data.ok, true);
});

test("fetchJson retries network errors thrown by fetch", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls < 2) {
      throw new Error("ECONNREFUSED");
    }
    return { ok: true, status: 200, json: async () => ({ statusCode: 200 }) };
  };

  await fetchJson("http://admin/api/products", { fetchImpl, sleepImpl: async () => {} });
  assert.equal(calls, 2);
});

test("googleRowsToTsv writes Google Merchant columns", () => {
  const rows = [
    Object.fromEntries(GOOGLE_MERCHANT_COLUMNS.map((column) => [column, ""])),
  ];
  rows[0].id = "iherb-1";
  rows[0].availability = "in_stock";

  const tsv = googleRowsToTsv(rows);
  const lines = tsv.split("\n");

  assert.equal(lines[0], GOOGLE_MERCHANT_COLUMNS.join("\t"));
  assert.equal(lines[1].split("\t").length, GOOGLE_MERCHANT_COLUMNS.length);
  assert.match(lines[1], /^iherb-1\t/);
});
