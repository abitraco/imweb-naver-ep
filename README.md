# imweb-naver-ep

Public feed artifacts for onejikgu.co.kr.

## Meta iHerb Catalog

Generate the Meta catalog feed from the local imweb admin API:

```bash
node scripts/generate-meta-catalog.mjs
```

The local imweb scheduler (`/Users/chance/DEV/imweb/sync-scheduler.sh`) regenerates
and publishes the Naver, Meta, and Google public feed files together at 09:00 and
17:00 local time, when any generated file changes.

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
