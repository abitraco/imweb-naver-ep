#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  IHERB_CATEGORIES,
  buildMetaCatalogRecord,
  productSortKey,
  rowsToTsv,
} from "./meta-catalog-lib.mjs";

const DEFAULT_ADMIN_URL = "http://127.0.0.1:3030";
const DEFAULT_OUTPUT = path.resolve(process.cwd(), "meta-catalog.tsv");
const DEFAULT_EXCLUDED_OUTPUT = path.resolve(process.cwd(), "meta-catalog-excluded.tsv");
const PAGE_SIZE = 100;
const REQUEST_DELAY_MS = 150;

function parseArgs(argv) {
  const options = {
    adminUrl: process.env.IMWEB_ADMIN_URL || DEFAULT_ADMIN_URL,
    output: process.env.META_CATALOG_OUTPUT || DEFAULT_OUTPUT,
    excludedOutput: process.env.META_CATALOG_EXCLUDED_OUTPUT || DEFAULT_EXCLUDED_OUTPUT,
    includeBlocked: process.env.META_CATALOG_INCLUDE_BLOCKED === "1",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--admin-url") options.adminUrl = argv[++i];
    else if (arg === "--output") options.output = argv[++i];
    else if (arg === "--excluded-output") options.excludedOutput = argv[++i];
    else if (arg === "--include-blocked") options.includeBlocked = true;
    else if (arg === "--help") {
      console.log(`Usage: node scripts/generate-meta-catalog.mjs [options]

Options:
  --admin-url <url>          Local imweb admin URL. Default: ${DEFAULT_ADMIN_URL}
  --output <path>            Meta catalog TSV output. Default: meta-catalog.tsv
  --excluded-output <path>   Blocked review TSV output. Default: meta-catalog-excluded.tsv
  --include-blocked          Include compliance=blocked rows in main catalog
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  options.adminUrl = options.adminUrl.replace(/\/+$/, "");
  return options;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} HTTP ${response.status}`);
  }
  const json = await response.json();
  if (json.statusCode && json.statusCode !== 200) {
    throw new Error(`GET ${url} statusCode=${json.statusCode}`);
  }
  return json;
}

async function fetchProductsForCategory(adminUrl, category) {
  const firstUrl = new URL(`${adminUrl}/api/products`);
  firstUrl.searchParams.set("page", "1");
  firstUrl.searchParams.set("limit", String(PAGE_SIZE));
  firstUrl.searchParams.set("categoryCode", category.code);

  const first = await fetchJson(firstUrl);
  const firstData = first.data || {};
  const totalCount = Number(firstData.totalCount || 0);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const products = [...(firstData.list || [])];

  for (let page = 2; page <= totalPages; page += 1) {
    const url = new URL(`${adminUrl}/api/products`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("categoryCode", category.code);

    const json = await fetchJson(url);
    products.push(...(json.data?.list || []));
    await sleep(REQUEST_DELAY_MS);
  }

  return { totalCount, products };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const seen = new Set();
  const rows = [];
  const excludedRows = [];
  const summary = {
    adminUrl: options.adminUrl,
    output: options.output,
    excludedOutput: options.excludedOutput,
    includeBlocked: options.includeBlocked,
    scanned: 0,
    included: 0,
    excluded: 0,
    skippedInvalid: 0,
    duplicateSkipped: 0,
    byCategory: {},
    byAvailability: {},
    byCompliance: {},
  };

  for (const category of IHERB_CATEGORIES) {
    const { totalCount, products } = await fetchProductsForCategory(options.adminUrl, category);
    const categoryRecords = [];
    const categoryExcluded = [];
    let skippedInvalid = 0;
    let duplicateSkipped = 0;

    for (const product of products) {
      summary.scanned += 1;
      const record = buildMetaCatalogRecord(product, category);
      if (!record) {
        skippedInvalid += 1;
        summary.skippedInvalid += 1;
        continue;
      }
      if (seen.has(record.id)) {
        duplicateSkipped += 1;
        summary.duplicateSkipped += 1;
        continue;
      }
      seen.add(record.id);

      const wrapped = { record, sortKey: productSortKey(product) };
      if (record.custom_label_4 === "blocked" && !options.includeBlocked) {
        categoryExcluded.push(wrapped);
        continue;
      }
      categoryRecords.push(wrapped);
    }

    categoryRecords.sort((a, b) => b.sortKey - a.sortKey);
    categoryExcluded.sort((a, b) => b.sortKey - a.sortKey);
    rows.push(...categoryRecords.map((item) => item.record));
    excludedRows.push(...categoryExcluded.map((item) => item.record));

    summary.byCategory[category.name] = {
      sourceTotal: totalCount,
      scanned: products.length,
      included: categoryRecords.length,
      excluded: categoryExcluded.length,
      skippedInvalid,
      duplicateSkipped,
    };
    console.error(
      `[meta-catalog] ${category.name}(${category.code}) source=${totalCount} included=${categoryRecords.length} excluded=${categoryExcluded.length} invalid=${skippedInvalid} duplicate=${duplicateSkipped}`
    );
  }

  for (const row of rows) {
    summary.byAvailability[row.availability] = (summary.byAvailability[row.availability] || 0) + 1;
    summary.byCompliance[row.custom_label_4] = (summary.byCompliance[row.custom_label_4] || 0) + 1;
  }

  summary.included = rows.length;
  summary.excluded = excludedRows.length;

  await mkdir(path.dirname(options.output), { recursive: true });
  await writeFile(options.output, rowsToTsv(rows), "utf8");
  await writeFile(options.excludedOutput, rowsToTsv(excludedRows), "utf8");

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
