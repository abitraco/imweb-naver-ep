#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  IHERB_CATEGORIES,
  buildNaverEpRecord,
  fetchJson,
  naverRowsToTsv,
  productSortKey,
  sleep,
} from "./meta-catalog-lib.mjs";

const DEFAULT_ADMIN_URL = "http://127.0.0.1:3030";
const DEFAULT_OUTPUT = path.resolve(process.cwd(), "ep.txt");
const DEFAULT_EXCLUDED_OUTPUT = path.resolve(process.cwd(), "ep-excluded.txt");
const PAGE_SIZE = 100;
const REQUEST_DELAY_MS = 150;

function parseArgs(argv) {
  const options = {
    adminUrl: process.env.IMWEB_ADMIN_URL || DEFAULT_ADMIN_URL,
    output: process.env.NAVER_EP_OUTPUT || DEFAULT_OUTPUT,
    excludedOutput: process.env.NAVER_EP_EXCLUDED_OUTPUT || DEFAULT_EXCLUDED_OUTPUT,
    includeBlocked: process.env.NAVER_EP_INCLUDE_BLOCKED === "1",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--admin-url") options.adminUrl = argv[++i];
    else if (arg === "--output") options.output = argv[++i];
    else if (arg === "--excluded-output") options.excludedOutput = argv[++i];
    else if (arg === "--include-blocked") options.includeBlocked = true;
    else if (arg === "--help") {
      console.log(`Usage: node scripts/generate-naver-ep.mjs [options]

Options:
  --admin-url <url>          Local imweb admin URL. Default: ${DEFAULT_ADMIN_URL}
  --output <path>            Naver EP output. Default: ep.txt
  --excluded-output <path>   Blocked review output. Default: ep-excluded.txt
  --include-blocked          Include compliance=blocked rows in main EP
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  options.adminUrl = options.adminUrl.replace(/\/+$/, "");
  return options;
}

const logRetry = ({ url, attempt, reason }) => {
  console.error(`[naver-ep] retry ${reason} (attempt ${attempt + 1})`);
};

async function fetchProductsForCategory(adminUrl, category) {
  const firstUrl = new URL(`${adminUrl}/api/products`);
  firstUrl.searchParams.set("page", "1");
  firstUrl.searchParams.set("limit", String(PAGE_SIZE));
  firstUrl.searchParams.set("categoryCode", category.code);

  const first = await fetchJson(firstUrl, { onRetry: logRetry });
  const firstData = first.data || {};
  const totalCount = Number(firstData.totalCount || 0);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const products = [...(firstData.list || [])];

  for (let page = 2; page <= totalPages; page += 1) {
    const url = new URL(`${adminUrl}/api/products`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("categoryCode", category.code);

    const json = await fetchJson(url, { onRetry: logRetry });
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
    byShipping: {},
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
      const record = buildNaverEpRecord(product, category);
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
      if (record.compliance === "blocked" && !options.includeBlocked) {
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
      `[naver-ep] ${category.name}(${category.code}) source=${totalCount} included=${categoryRecords.length} excluded=${categoryExcluded.length} invalid=${skippedInvalid} duplicate=${duplicateSkipped}`
    );
  }

  for (const row of rows) {
    summary.byShipping[row.shipping] = (summary.byShipping[row.shipping] || 0) + 1;
    summary.byCompliance[row.compliance] = (summary.byCompliance[row.compliance] || 0) + 1;
  }

  summary.included = rows.length;
  summary.excluded = excludedRows.length;

  await mkdir(path.dirname(options.output), { recursive: true });
  await writeFile(options.output, naverRowsToTsv(rows), "utf8");
  await writeFile(options.excludedOutput, naverRowsToTsv(excludedRows), "utf8");

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
