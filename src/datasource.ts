import { BackendSrvRequest, getBackendSrv, isFetchError } from '@grafana/runtime';
import {
  CoreApp,
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MappingType,
  ValueMapping,
  createDataFrame,
  FieldType,
  ThresholdsMode,
} from '@grafana/data';
import { lastValueFrom } from 'rxjs';

import {
  ArchClass,
  ArchHwType,
  ArchItem,
  ArchMetric,
  ArchResponse,
  ArchSubsystem,
  CapacityItem,
  DEFAULT_QUERY,
  HealthStatusGroup,
  NextGenDataSourceOptions,
  NextGenQuery,
  QueryMetric,
  SearchResult,
  TimeseriesItemEntry,
  TimeseriesResponse,
  XormonUrlTableColumn,
} from './types';
import { toGrafanaUnit } from './unitMap';

const LICENSE_MESSAGE = 'The Xormon instance does not have a valid license.';

const SEVERITY_COLORS: Record<string, string> = {
  OK: 'green',
  WARNING: 'orange',
  ERROR: 'red',
  UNKNOWN: 'blue',
  IGNORED: 'purple',
  TEST: 'grey',
};

// Status column of exporter/alerting_table: 1 = the alerting group has a triggered alert.
const ALERT_STATUS_MAPPINGS: ValueMapping[] = [
  {
    type: MappingType.ValueToText,
    options: { '0': { text: '●', color: 'green' }, '1': { text: '●', color: 'red' } },
  },
];

const CAPACITY_THRESHOLDS = {
  mode: ThresholdsMode.Absolute,
  steps: [
    { value: -Infinity, color: 'green' },
    { value: 80, color: 'orange' },
    { value: 90, color: 'red' },
  ],
};

const SEVERITY_MAPPINGS: ValueMapping[] = [
  {
    type: MappingType.ValueToText,
    options: Object.fromEntries(Object.entries(SEVERITY_COLORS).map(([severity, color]) => [severity, { text: severity, color }])),
  },
];

export class DataSource extends DataSourceApi<NextGenQuery, NextGenDataSourceOptions> {
  baseUrl: string;

  constructor(instanceSettings: DataSourceInstanceSettings<NextGenDataSourceOptions>) {
    super(instanceSettings);
    // `/api` matches the proxy route defined in plugin.json, which forwards to
    // `{protocol}://{host}:{port}/api/public/v1` on the configured XorMon server.
    this.baseUrl = `${instanceSettings.url!}/api`;
  }

  getDefaultQuery(_: CoreApp): Partial<NextGenQuery> {
    return DEFAULT_QUERY;
  }

  filterQuery(query: NextGenQuery): boolean {
    const queryType = query.queryType ?? 'timeseries';
    if (queryType === 'health_status') {
      return true;
    }
    if (queryType === 'xormon_url') {
      switch (query.component) {
        case 'graph':
        case 'table':
          return !!query.url && (!!query.tab || !!query.tabId);
        case 'alerting_table':
          return !!query.guid;
        default:
          return false;
      }
    }
    const hasItems = query.allItems || !!query.itemIds?.length;
    if (queryType === 'capacity') {
      return hasItems && !!query.subsystem;
    }
    return queryType === 'timeseries' && hasItems && !!query.metrics?.length;
  }

  private async fetch<T>(options: BackendSrvRequest): Promise<T> {
    try {
      const result = await lastValueFrom(getBackendSrv().fetch<T>(options));
      return result.data;
    } catch (err) {
      // XorMon answers 402 Payment Required when its license (or the API license of a technology) isn't valid
      if (isFetchError(err) && err.status === 402) {
        throw new Error(LICENSE_MESSAGE);
      }
      throw err;
    }
  }

  private async get<T>(path: string): Promise<T> {
    return this.fetch<T>({ url: `${this.baseUrl}${path}`, method: 'GET' });
  }

  private async post<T>(path: string, data: unknown): Promise<T> {
    return this.fetch<T>({ url: `${this.baseUrl}${path}`, method: 'POST', data });
  }

  // exporter/capacity_table and exporter/alerting_table answer with a ';' separated CSV, not JSON.
  private async postText(path: string, data: unknown): Promise<string> {
    return this.fetch<string>({ url: `${this.baseUrl}${path}`, method: 'POST', data, responseType: 'text' });
  }

  async getClasses(): Promise<ArchClass[]> {
    const res = await this.get<ArchResponse<ArchClass[]>>('/architecture/classes');
    return res.data;
  }

  async getHwTypes(cls: string): Promise<ArchHwType[]> {
    const res = await this.get<ArchResponse<ArchHwType[]>>(`/architecture/class/${encodeURIComponent(cls)}/hw_types`);
    return res.data;
  }

  // hwType is optional: omitting it returns subsystems merged across every hw_type of the class
  // (used for classes like storage/san/lan where the cascade skips HW Type selection entirely).
  async getSubsystems(cls: string, hwType?: string): Promise<ArchSubsystem[]> {
    const query = new URLSearchParams({ class: cls });
    if (hwType) {
      query.set('hw_type', hwType);
    }
    const res = await this.get<ArchResponse<ArchSubsystem[]>>(`/architecture/v1/subsystems?${query.toString()}`);
    return res.data;
  }

  // hwType is optional for the same reason as getSubsystems above; metrics are merged across
  // every hw_type of the class when it's omitted.
  async getMetrics(cls: string, subsystem: string, hwType?: string): Promise<ArchMetric[]> {
    const query = new URLSearchParams({ class: cls, subsystem });
    if (hwType) {
      query.set('hw_type', hwType);
    }
    const res = await this.get<ArchResponse<ArchMetric[]>>(`/architecture/v1/metrics?${query.toString()}`);
    return res.data;
  }

  async getParentSubsystems(cls: string, subsystem: string): Promise<ArchSubsystem[]> {
    const res = await this.get<ArchResponse<ArchSubsystem[]>>(
      `/architecture/class/${encodeURIComponent(cls)}/subsystems/${encodeURIComponent(subsystem)}/parents`
    );
    return res.data;
  }

  async searchItems(params: { cls: string; hwType?: string; subsystem?: string; parents?: string[]; limit?: number }): Promise<ArchItem[]> {
    const query = new URLSearchParams({ class: params.cls, limit: String(params.limit ?? 1000) });
    if (params.hwType) {
      query.set('hw_type', params.hwType);
    }
    if (params.subsystem) {
      query.set('subsystem', params.subsystem);
    }
    if (params.parents?.length) {
      query.set('parents', params.parents.join(','));
    }
    const res = await this.get<ArchResponse<SearchResult>>(`/architecture/search?${query.toString()}`);
    return res.data.items;
  }

  async getHealthStatus(): Promise<HealthStatusGroup[]> {
    const res = await this.get<ArchResponse<HealthStatusGroup[]>>('/health_status/');
    return res.data;
  }

  // Unlike the other /exporter endpoints, this one returns a bare JSON array, not an {statusCode, data} envelope.
  async getCapacity(uuids: string[], subsystem: string): Promise<CapacityItem[]> {
    return this.post<CapacityItem[]>('/exporter/capacity', { uuids, subsystem, format: 'json' });
  }

  async query(options: DataQueryRequest<NextGenQuery>): Promise<DataQueryResponse> {
    const targets = options.targets.filter((t) => this.filterQuery(t));
    const timeseriesTargets = targets.filter((t) => (t.queryType ?? 'timeseries') === 'timeseries');
    const healthStatusTargets = targets.filter((t) => t.queryType === 'health_status');
    const capacityTargets = targets.filter((t) => t.queryType === 'capacity');
    const xormonUrlTargets = targets.filter((t) => t.queryType === 'xormon_url');

    const [timeseriesFrames, healthStatusFrames, capacityFrames, xormonUrlFrames] = await Promise.all([
      this.queryTimeseries(timeseriesTargets, options),
      Promise.all(healthStatusTargets.map((target) => this.queryHealthStatus(target))),
      Promise.all(capacityTargets.map((target) => this.queryCapacity(target))),
      Promise.all(xormonUrlTargets.map((target) => this.queryXormonUrl(target, options))),
    ]);

    return { data: [...timeseriesFrames, ...healthStatusFrames, ...capacityFrames, ...xormonUrlFrames.flat()] };
  }

  // "All items" is resolved fresh on every query instead of a fixed id list captured at edit time,
  // so the panel picks up items added/removed after the query was built.
  private async resolveItemIds(target: NextGenQuery): Promise<string[]> {
    if (!target.allItems) {
      return target.itemIds ?? [];
    }
    const items = await this.searchItems({
      cls: target.class!,
      hwType: target.hwType,
      subsystem: target.subsystem,
      parents: target.filterByParents ? target.parentItemIds : undefined,
    });
    return items.map((i) => i.item_id);
  }

  private fetchTimeseries(itemIds: string[], metrics: QueryMetric[], options: DataQueryRequest<NextGenQuery>): Promise<TimeseriesResponse> {
    return this.post<TimeseriesResponse>('/exporter/timeseries', {
      uuids: itemIds,
      metric: metrics.map((m) => m.metric),
      start: Math.floor(options.range.from.valueOf() / 1000),
      end: Math.floor(options.range.to.valueOf() / 1000),
      format: 'json',
      overrideInterval: Math.max(1, Math.round(options.intervalMs / 60000)),
    });
  }

  // entry.metric is "<metric> [<shortcut>]" when the metric has a unit shortcut, so match on the prefix.
  private findQueryMetric(metrics: QueryMetric[], entryMetric: string): QueryMetric | undefined {
    return metrics.find((m) => entryMetric === m.metric || entryMetric.startsWith(`${m.metric} [`));
  }

  private toPoints(timeseries: TimeseriesItemEntry['timeseries']): Array<[number, number | null]> {
    return Object.entries(timeseries)
      .map(([ts, value]) => [new Date(ts).getTime(), value === null ? null : Number(value)] as [number, number | null])
      .sort((a, b) => a[0] - b[0]);
  }

  private async queryTimeseries(targets: NextGenQuery[], options: DataQueryRequest<NextGenQuery>): Promise<DataFrame[]> {
    const data = await Promise.all(
      targets.map(async (target) => {
        const itemIds = await this.resolveItemIds(target);
        const response = await this.fetchTimeseries(itemIds, target.metrics, options);

        return (response.items ?? []).map((entry) => {
          const queryMetric = this.findQueryMetric(target.metrics, entry.metric);
          const points = this.toPoints(entry.timeseries);

          // With a single selected item, a metric's color is a deliberate per-metric choice; with several
          // items, that color would be shared indistinctly across each item's series, so leave it to Grafana's palette.
          const fixedColor = itemIds.length === 1 ? queryMetric?.color : undefined;
          const displayName = `${entry.label} · ${queryMetric?.label ?? entry.metric}`;

          return createDataFrame({
            refId: target.refId,
            name: displayName,
            fields: [
              { name: 'Time', values: points.map((p) => p[0]), type: FieldType.time },
              {
                name: displayName,
                values: points.map((p) => p[1]),
                type: FieldType.number,
                config: {
                  displayNameFromDS: displayName,
                  unit: toGrafanaUnit(queryMetric?.unit, queryMetric?.shortcut),
                  color: fixedColor ? { mode: 'fixed', fixedColor } : undefined,
                  // metrics are collected at different native resolutions (1m/5m/...), so gaps between
                  // points at the query's resolution are expected — connect across them instead of breaking the line.
                  custom: { spanNulls: true },
                },
              },
            ],
          });
        });
      })
    );

    return data.flat();
  }

  private async queryHealthStatus(target: NextGenQuery): Promise<DataFrame> {
    const groups = await this.getHealthStatus();
    const severities = target.healthSeverities?.length ? target.healthSeverities : groups.map((g) => g.status);
    const rows = groups
      .filter((g) => severities.includes(g.status))
      .flatMap((g) => g.devices.map((d) => ({ ...d, severity: g.status })))
      .filter((r) => !r.ignored);

    return createDataFrame({
      refId: target.refId,
      fields: [
        {
          name: 'Severity',
          values: rows.map((r) => r.severity),
          type: FieldType.string,
          config: { mappings: SEVERITY_MAPPINGS, custom: { cellOptions: { type: 'color-background' } } },
        },
        { name: 'Label', values: rows.map((r) => r.label), type: FieldType.string },
        { name: 'Technology', values: rows.map((r) => r.hw_type_label ?? r.hw_type), type: FieldType.string },
        { name: 'Note', values: rows.map((r) => r.note), type: FieldType.string },
        { name: 'Updated At', values: rows.map((r) => r.updatedAt), type: FieldType.time },
      ],
    });
  }

  private async queryCapacity(target: NextGenQuery): Promise<DataFrame> {
    const itemIds = await this.resolveItemIds(target);
    // Passing `subsystem` alongside `uuids` (not just uuids) keeps the backend's hw_type-specific
    // remaps correct (e.g. 3PAR pools report allocated/used differently) instead of only relying on uuids.
    const rows = itemIds.length ? await this.getCapacity(itemIds, target.subsystem!) : [];

    const total = (r: CapacityItem) => r.data?.capacity_total ?? null;
    const used = (r: CapacityItem) => r.data?.capacity_used ?? null;
    const usedPercent = (r: CapacityItem) => {
      const t = total(r);
      const u = used(r);
      return u != null && t ? (u / t) * 100 : null;
    };
    const bytesUnit = toGrafanaUnit('bytes');

    return createDataFrame({
      refId: target.refId,
      fields: [
        { name: 'Label', values: rows.map((r) => r.label), type: FieldType.string },
        ...(target.subsystem === 'device'
          ? []
          : [{ name: 'Parent', values: rows.map((r) => r.parent ?? ''), type: FieldType.string }]),
        { name: 'Capacity Total', values: rows.map(total), type: FieldType.number, config: { unit: bytesUnit } },
        { name: 'Capacity Used', values: rows.map(used), type: FieldType.number, config: { unit: bytesUnit } },
        {
          name: 'Capacity Free',
          values: rows.map((r) => r.data?.capacity_free ?? null),
          type: FieldType.number,
          config: { unit: bytesUnit },
        },
        {
          name: 'Used %',
          values: rows.map(usedPercent),
          type: FieldType.number,
          config: {
            unit: 'percent',
            min: 0,
            max: 100,
            thresholds: CAPACITY_THRESHOLDS,
            custom: { cellOptions: { type: 'gauge', mode: 'gradient' } },
          },
        },
        {
          name: 'Virtual Capacity Total',
          values: rows.map((r) => r.data?.virtual_capacity_total ?? null),
          type: FieldType.number,
          config: { unit: bytesUnit },
        },
        {
          name: 'Data Reduction Ratio',
          values: rows.map((r) => r.data?.data_reduction_ratio ?? null),
          type: FieldType.number,
        },
        { name: 'Dedupe Ratio', values: rows.map((r) => r.data?.dedupe_ratio ?? null), type: FieldType.number },
        {
          name: 'Oversubscription',
          values: rows.map((r) => r.data?.capacity_oversubscr ?? null),
          type: FieldType.number,
        },
      ],
    });
  }

  private async queryXormonUrl(target: NextGenQuery, options: DataQueryRequest<NextGenQuery>): Promise<DataFrame[]> {
    switch (target.component) {
      case 'graph':
        return this.queryXormonUrlGraph(target, options);
      case 'table':
        return [await this.queryXormonUrlCapacityTable(target)];
      case 'alerting_table':
        return [await this.queryXormonUrlAlertingTable(target)];
      default:
        return [];
    }
  }

  /**
   * A XorMon page graph, looked up by XorMon on every query (url + tab/subtab/tabId + graphId), so the panel follows
   * the page graph's current items and metrics; graphs summing/averaging their items come back as one "Total" series
   * per metric. The time range is Grafana's — a graph imported with an interval has it set as the panel's relative time.
   * The metrics stored with the query only style the series the way XorMon draws them.
   */
  private async queryXormonUrlGraph(target: NextGenQuery, options: DataQueryRequest<NextGenQuery>): Promise<DataFrame[]> {
    const response = await this.post<TimeseriesResponse>('/exporter/dashboard_graph', {
      url: target.url,
      tab: target.tab,
      subtab: target.subtab,
      tabId: target.tabId,
      id: target.graphId,
      interval: target.interval,
      start: Math.floor(options.range.from.valueOf() / 1000),
      end: Math.floor(options.range.to.valueOf() / 1000),
      format: 'json',
    });
    const entries = response.items ?? [];

    // A metric's color is XorMon's choice for a single series; with several items it'd be shared by all of them.
    const singleSeriesPerMetric = new Set(entries.map((e) => e.item_id)).size <= 1;
    const metrics = target.metrics ?? [];

    return entries.map((entry) => {
      const metric = this.findQueryMetric(metrics, entry.metric);
      const metricLabel = metric?.label ?? entry.metric_label ?? entry.metric;
      const label = `${entry.label} · ${metricLabel}`;
      const points = this.toPoints(entry.timeseries);

      return createDataFrame({
        refId: target.refId,
        name: label,
        fields: [
          { name: 'Time', values: points.map((p) => p[0]), type: FieldType.time },
          {
            name: label,
            values: points.map((p) => p[1]),
            type: FieldType.number,
            config: {
              displayNameFromDS: label,
              unit: toGrafanaUnit(metric?.unit ?? entry.unit, metric?.shortcut ?? entry.unit_shortcut ?? undefined),
              color: singleSeriesPerMetric && metric?.color ? { mode: 'fixed', fixedColor: metric.color } : undefined,
              custom: {
                spanNulls: true,
                fillOpacity: metric?.chartType === 'area' ? 80 : 0,
                stacking: { mode: metric?.stacked ? 'normal' : 'none', group: 'A' },
                transform: metric?.negativeY ? 'negative-Y' : undefined,
              },
            },
          },
        ],
      });
    });
  }

  /** Splits a ';' separated CSV of exporter/capacity_table / exporter/alerting_table into header and rows. */
  private parseCsv(csv: string): { header: string[]; rows: string[][] } {
    const lines = (csv ?? '').split('\n').filter((line) => line.length > 0);
    const [header = '', ...rows] = lines;
    return { header: header.split(';'), rows: rows.map((row) => row.split(';')) };
  }

  private toNumber(value: string | undefined): number | null {
    if (value === undefined || value === '') {
      return null;
    }
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  }

  // the units the Infinity panels used to set on capacity table columns
  private capacityColumnUnit(column: XormonUrlTableColumn): string {
    if (column.name.includes('Days')) {
      return 'd';
    }
    if (column.name.includes('[%]') || column.thermometer || column.name.includes('Rate')) {
      return 'percent';
    }
    if (column.shortcut === 'ratio') {
      return 'short';
    }
    return 'bytes';
  }

  private async queryXormonUrlCapacityTable(target: NextGenQuery): Promise<DataFrame> {
    const csv = await this.postText('/exporter/capacity_table', {
      url: target.url,
      tab: target.tab,
      subtab: target.subtab,
      tabId: target.tabId,
      id: target.tableId,
    });
    const { header, rows } = this.parseCsv(csv);
    const columns = target.columns ?? [];

    return createDataFrame({
      refId: target.refId,
      fields: header.map((name, index) => {
        const column = columns.find((c) => c.name === name);
        const values = rows.map((row) => row[index]);
        if (!column?.number) {
          return { name, values, type: FieldType.string };
        }
        return {
          name,
          values: values.map((v) => this.toNumber(v)),
          type: FieldType.number,
          config: column.thermometer
            ? {
                unit: this.capacityColumnUnit(column),
                min: 0,
                max: 100,
                thresholds: CAPACITY_THRESHOLDS,
                custom: { cellOptions: { type: 'gauge', mode: 'gradient' } },
              }
            : { unit: this.capacityColumnUnit(column) },
        };
      }),
    });
  }

  private async queryXormonUrlAlertingTable(target: NextGenQuery): Promise<DataFrame> {
    const csv = await this.postText('/exporter/alerting_table', { guid: target.guid });
    const { header, rows } = this.parseCsv(csv);

    return createDataFrame({
      refId: target.refId,
      fields: header.map((name, index) => {
        const values = rows.map((row) => row[index]);
        if (name === 'Status') {
          return {
            name,
            values,
            type: FieldType.string,
            config: { mappings: ALERT_STATUS_MAPPINGS, custom: { cellOptions: { type: 'color-text' } } },
          };
        }
        if (name === 'Last Trigger') {
          // unix seconds, empty when no alert of the group has triggered
          return {
            name,
            values: values.map((v) => {
              const seconds = this.toNumber(v);
              return seconds === null ? null : seconds * 1000;
            }),
            type: FieldType.time,
          };
        }
        return { name, values, type: FieldType.string };
      }),
    });
  }

  /**
   * Checks whether we can connect to the API.
   */
  async testDatasource() {
    try {
      await this.getClasses();
      return {
        status: 'success',
        message: 'Success',
      };
    } catch (err) {
      let message = 'Cannot connect to API';
      if (typeof err === 'string') {
        message = err;
      } else if (err instanceof Error) {
        message = err.message;
      } else if (isFetchError(err)) {
        message = 'Fetch error: ' + (err.statusText ? err.statusText : message);
        if (err.data?.error?.code) {
          message += ': ' + err.data.error.code + '. ' + err.data.error.message;
        }
      }
      return {
        status: 'error',
        message,
      };
    }
  }
}
