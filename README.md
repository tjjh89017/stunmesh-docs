# stunmesh-docs

Source for [docs.stunmesh.dev](https://docs.stunmesh.dev) — the documentation site of [stunmesh-go](https://github.com/tjjh89017/stunmesh-go), built with [Docusaurus](https://docusaurus.io/).

Pushes to `main` are deployed automatically to GitHub Pages by the [deploy workflow](.github/workflows/deploy.yml).

## Local development

```bash
pnpm install
pnpm start        # dev server with live reload
pnpm build        # production build; broken links fail the build
```

## Contributing

Content lives under [`docs/`](docs/) as Markdown; the sidebar is defined in [`sidebars.js`](sidebars.js). Fixes and improvements are welcome — for behavior questions the source of truth is the [stunmesh-go repository](https://github.com/tjjh89017/stunmesh-go).

## Versioning

`docs/` is the current stunmesh-go release. It is labelled with its version (`versions.current.label` in [`docusaurus.config.js`](docusaurus.config.js)) and served at the site root. Older minor versions are frozen snapshots under `versioned_docs/`. There is no "Next" version.

Docs for a feature that is on stunmesh-go `main` but not yet released either wait in an open PR until the tag, or carry an admonition that is removed at release:

```md
:::caution Unreleased

Available on `main` only; not in vX.Y.Z.

:::
```

## Updating for a new stunmesh-go release

This repo is the last step after stunmesh-go, stunmesh-provisioner, stunmesh-openwrt, stunmesh-opnsense and stunmesh-android have released.

1. For a new minor version, first freeze the previous one: `pnpm docusaurus docs:version <previous X.Y>`. This snapshots `docs/` into `versioned_docs/version-<previous>` and prepends it to `versions.json`. Patch releases need no snapshot.
2. Update `docs/` for the new release, and set `versions.current.label` in `docusaurus.config.js` to the new `X.Y`. Mark the frozen version with `banner: 'unmaintained'` under `versions`.
3. Remove any `:::caution Unreleased` admonitions for features in this release.
4. Review [`docs/guides/openwrt.md`](docs/guides/openwrt.md) for the OpenWrt series in the feed URL, and any page that names a version.
5. Push to `main`; the [deploy workflow](.github/workflows/deploy.yml) publishes the site.
