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

## License

Documentation is licensed under the same terms as stunmesh-go (GPL-2.0-or-later).
