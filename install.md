# Installing the XorMon Data Source Plugin for Grafana

The XorMon plugin lets you query live metrics and health status directly from your XorMon
server inside Grafana — no need to pre-import dashboards, the data updates the same way any
other Grafana panel does.

## Requirements

- Grafana **12.3.0** or newer.
- Network access from the machine running Grafana to your XorMon server (default port `8443`, HTTPS).
- A XorMon **API key** — generate one in the XorMon application under **User → Profile -> API Keys**.

## 1. Download

Grab the latest release archive:

```
https://download.xormon.com/ng/xorux-xormon-datasource-<version>.tar.gz
```

for example, version 1.0.0:

```
https://download.xormon.com/ng/xorux-xormon-datasource-1.0.0.tar.gz
```

## 2. Install the plugin

Extract the archive into Grafana's plugins directory. On a standard Linux install this is
`/var/lib/grafana/plugins` (check the `plugins` path under `[paths]` in your `grafana.ini` if
you're not sure):

```bash
tar -xzf xorux-xormon-datasource-<version>.tar.gz -C /var/lib/grafana/plugins/
```

This creates a `xorux-xormon-datasource/` folder inside the plugins directory.

### Running Grafana in Docker?

Extract the archive on the host first, then bind-mount the resulting folder into the
container's plugins directory instead of copying it into the image. The plugin isn't signed
yet, so also set `GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS` (this replaces step 3 below —
skip straight to step 4):

```bash
tar -xzf xorux-xormon-datasource-<version>.tar.gz

docker run -d \
  -p 3000:3000 \
  -v "$(pwd)/xorux-xormon-datasource:/var/lib/grafana/plugins/xorux-xormon-datasource" \
  -e "GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=xorux-xormon-datasource" \
  grafana/grafana
```

Or with Docker Compose:

```yaml
services:
  grafana:
    image: grafana/grafana:latest
    ports:
      - '3000:3000'
    volumes:
      - ./xorux-xormon-datasource:/var/lib/grafana/plugins/xorux-xormon-datasource
    environment:
      GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS: xorux-xormon-datasource
```

```bash
docker compose up -d
```

> If your XorMon server runs on the same machine as Docker, `localhost` inside the container
> refers to the container itself, not the host. Use `host.docker.internal` as the **Host**
> field in step 5 instead, and (on Linux only) add `--add-host=host.docker.internal:host-gateway`
> to `docker run`, or `extra_hosts: ["host.docker.internal:host-gateway"]` under the `grafana`
> service in Compose.

## 3. Allow the plugin to load

This plugin isn't signed yet, so Grafana needs to be told to trust it explicitly. Add its ID
to the unsigned-plugins allow list, either in `grafana.ini`:

```ini
[plugins]
allow_loading_unsigned_plugins = xorux-xormon-datasource
```

or via an environment variable:

```bash
GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=xorux-xormon-datasource
```

(if you're running Grafana in Docker, you already set this above).

## 4. Restart Grafana

```bash
systemctl restart grafana-server
```

Running in Docker instead?

```bash
docker restart <container-name>
# or, with Docker Compose:
docker compose restart grafana
```

## 5. Configure the data source

Add the XorMon data source and build your first panel as described in
[Getting started](https://github.com/XoruX/grafana-plugin#getting-started).
