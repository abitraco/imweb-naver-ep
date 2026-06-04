# imweb-naver-ep

Public feed artifacts for onejikgu.co.kr.

## Naver Shopping EP

Generate the Naver Shopping EP feed from the local imweb admin API:

```bash
node scripts/generate-naver-ep.mjs
```

Outputs:

- `ep.txt` — the tab-delimited Naver Shopping EP feed.
- `ep-excluded.txt` — blocked-keyword review list, not for upload.

The Naver EP is a **sale-only** feed: sold-out products are dropped rather than
carried as out of stock. It uses stable `iherb-*` IDs from `customProdCode`,
sets `condition=신상품` / `import_flag=Y` / `origin=미국`, charges a flat
`6000` KRW shipping fee below `40000` KRW (free above), and builds `search_tag`
as `브랜드,iHerb,아이허브,해외직구,카테고리,CATE코드`. Compliance-blocked
products (CBD/THC/DHEA/성기능 등) are routed to `ep-excluded.txt` unless
`--include-blocked` is passed.

```text
https://abitraco.github.io/imweb-naver-ep/ep.txt
```

### Resilient admin fetches

All three generators share a `fetchJson` helper (`scripts/meta-catalog-lib.mjs`)
that retries transient admin API failures — HTTP `408/425/429/500/502/503/504`,
JSON-body `statusCode` faults, and network errors — with exponential backoff
before failing. This prevents a single flaky `/api/products` page (the HTTP 500
that previously aborted Naver EP generation) from killing the whole run.

## Meta iHerb Catalog

Generate the Meta catalog feed from the local imweb admin API:

```bash
node scripts/generate-meta-catalog.mjs
```

The local imweb scheduler (`/Users/chance/DEV/imweb/sync-scheduler.sh`) regenerates
and publishes the Naver, Meta, and Google public feed files together every 6
hours when any generated file changes.

Outputs:

- `meta-catalog.tsv` — upload this to Meta Commerce Manager as the scheduled data feed.
- `meta-catalog-excluded.tsv` — blocked-keyword review list, not for upload.

Recommended scheduled feed URL after this repo is pushed and GitHub Pages refreshes:

```text
https://abitraco.github.io/imweb-naver-ep/meta-catalog.tsv
```

The feed keeps sold-out products as `availability=out of stock`, uses stable
`iherb-*` IDs from `customProdCode`, and labels product sets with:

- `custom_label_0`: iHerb category bucket
- `custom_label_1`: margin placeholder (`margin_unknown`)
- `custom_label_2`: stock bucket
- `custom_label_3`: price bucket
- `custom_label_4`: compliance bucket (`safe` / `sensitive`)

## Google Merchant iHerb Feed

Generate the Google Merchant Center tab-delimited product file from the same
iHerb category scan:

```bash
node scripts/generate-google-merchant.mjs
```

Outputs:

- `google-merchant.tsv` — add this to Google Merchant Center as a product file
  URL or scheduled fetch.
- `google-merchant-excluded.tsv` — blocked-keyword review list, not for upload.

Recommended product file URL after this repo is pushed and GitHub Pages refreshes:

```text
https://abitraco.github.io/imweb-naver-ep/google-merchant.tsv
```

The feed uses Google Merchant values such as `availability=in_stock` /
`out_of_stock`, keeps prices as `KRW`, and sets `identifier_exists=no` instead
of inventing manufacturer identifiers that are not present in the source data.
