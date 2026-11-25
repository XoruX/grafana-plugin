# Contributing

Bugs and feature requests go to the [issue tracker](https://github.com/XoruX/grafana-plugin/issues).

## Development

The plugin is a frontend-only Grafana data source plugin scaffolded with
[`@grafana/create-plugin`](https://grafana.com/developers/plugin-tools/). Don't edit the `.config` folder, it is
managed by the Grafana plugin tools.

Requirements: Node.js 24 (`.nvmrc`) and Docker (for the development Grafana instance).

1. Install dependencies

   ```bash
   npm install
   ```

2. Build the plugin in development mode and rebuild on changes

   ```bash
   npm run dev
   ```

3. Build the plugin in production mode

   ```bash
   npm run build
   ```

4. Type check, lint and run the unit tests

   ```bash
   npm run typecheck
   npm run lint
   npm run test:ci
   ```

5. Start a Grafana instance with the plugin (Docker)

   ```bash
   npm run server
   ```

   To provision a XorMon data source in it, put your API key into a `.env` file (it is gitignored):

   ```bash
   NEXTGEN_API_KEY=<your-api-key>
   ```

   The data source (`provisioning/datasources/datasources.yml`) points at `https://host.docker.internal:8443`.

6. Run the E2E tests (Playwright) against the running Grafana instance

   ```bash
   npm run e2e
   ```

## Validating the plugin

Before a release, run the [Grafana plugin validator](https://github.com/grafana/plugin-validator) on the built
plugin:

```bash
npm run build
cp -r dist xorux-xormon-datasource
zip -qr xorux-xormon-datasource.zip xorux-xormon-datasource
SKIP_LLM_REVIEW=1 npx @grafana/plugin-validator@latest -sourceCodeUri file://. xorux-xormon-datasource.zip
```

## Releasing

1. Update `CHANGELOG.md`.
2. Bump the version and push the tag:

   ```bash
   npm version <major|minor|patch>
   git push origin main --follow-tags
   ```

3. The [release workflow](.github/workflows/release.yml) builds, signs and attests the plugin and creates a draft
   GitHub release with the plugin archive. It needs the `GRAFANA_ACCESS_POLICY_TOKEN` repository secret (a Grafana
   Cloud access policy token with the `plugins:write` scope).
