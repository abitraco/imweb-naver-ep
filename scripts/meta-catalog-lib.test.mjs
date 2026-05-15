import assert from "node:assert/strict";
import test from "node:test";

import {
  GOOGLE_MERCHANT_COLUMNS,
  META_CATALOG_COLUMNS,
  buildGoogleMerchantRecord,
  buildMetaCatalogRecord,
  classifyCompliance,
  googleRowsToTsv,
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
