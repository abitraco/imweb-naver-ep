# imweb-naver-ep

Public feed artifacts for onejikgu.co.kr.

## Meta iHerb Catalog

Generate the Meta catalog feed from the local imweb admin API:

```bash
node scripts/generate-meta-catalog.mjs
```

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
