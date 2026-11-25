import { DataSourceJsonData } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

export type QueryType = 'timeseries' | 'health_status' | 'capacity' | 'xormon_url';

/** Component of a XorMon page a "XorMon URL" query reads. */
export type XormonUrlComponent = 'graph' | 'table' | 'alerting_table';

export type GraphInterval = 'day' | 'week' | 'month' | 'year';

/**
 * Column of a capacity table, stored on import (server-nest GrafanaPanels.ts TableColumn).
 * `name` matches the CSV header returned by exporter/capacity_table.
 */
export interface XormonUrlTableColumn {
  name: string;
  number: boolean;
  shortcut?: string;
  thermometer?: boolean;
}

export interface ArchClass {
  class: string;
  label: string;
}

export interface ArchHwType {
  hw_type: string;
  label: string;
}

export interface ArchSubsystem {
  subsystem: string;
  label: string;
}

export interface ArchItem {
  item_id: string;
  label: string;
  hw_type?: string;
  subsystem?: string;
}

export interface ArchMetric {
  metric: string;
  label: string;
  shortcut?: string;
  unit?: string;
}

export interface ArchResponse<T> {
  statusCode: number;
  data: T;
}

export interface SearchResult {
  metadata: { start: number; end: number; max: number; page: number; info?: string };
  items: ArchItem[];
}

export interface HealthStatusDevice {
  class: string;
  hw_type: string;
  hw_type_label: string;
  label: string;
  item_id: string;
  updatedAt: number;
  note: string;
  status: string;
  data: number;
  connection: number;
  ignored: boolean;
  ignore_reason: string | null;
  url: string;
}

export interface HealthStatusGroup {
  status: string;
  count: number;
  devices: HealthStatusDevice[];
}

export interface CapacityItem {
  item_id: string;
  label: string;
  parent?: string;
  // Items with no recent capacity data come back with this missing entirely.
  data?: {
    capacity_free?: number | null;
    capacity_used?: number | null;
    capacity_total?: number | null;
    data_reduction_ratio?: number | null;
    dedupe_ratio?: number | null;
    virtual_capacity_total?: number | null;
    capacity_oversubscr?: number | null;
  };
}

export interface QueryMetric {
  metric: string;
  label: string;
  shortcut?: string;
  unit?: string;
  color?: string;
  // Styling of a "XorMon URL" graph, taken from the XorMon graph on import.
  stacked?: boolean;
  chartType?: 'line' | 'area';
  /** drawn below the X axis */
  negativeY?: boolean;
}

export interface NextGenQuery extends DataQuery {
  queryType?: QueryType;
  class?: string;
  hwType?: string;
  subsystem?: string;
  itemIds?: string[];
  /** All items matching class/hwType/subsystem (and parent filter, if any), resolved fresh at query time instead of a fixed id list. */
  allItems?: boolean;
  filterByParents?: boolean;
  parentSubsystem?: string;
  parentItemIds?: string[];
  metrics: QueryMetric[];
  healthSeverities?: string[];

  // "XorMon URL": a graph / table of a XorMon page, imported from XorMon (server-nest GrafanaXormonPanels.ts).
  // url + tab/subtab/tabId (+ graphId/tableId) identify the component, which XorMon looks up on every query
  // (exporter/dashboard_graph, exporter/capacity_table), so a changed page graph shows its current items and metrics.
  // A graph's metrics stored on import only carry the XorMon styling (label, color, stacking, ...).
  component?: XormonUrlComponent;
  url?: string;
  tab?: string;
  subtab?: string;
  tabId?: string;
  /** graph within the tab; the first graph of the tab when missing */
  graphId?: string;
  /** capacity table within the tab */
  tableId?: string;
  /** interval the graph was imported with (the panel's relative time is set from it) */
  interval?: GraphInterval;
  /** Grafana dashboard uid an alerting table belongs to */
  guid?: string;
  columns?: XormonUrlTableColumn[];
}

export const DEFAULT_QUERY: Partial<NextGenQuery> = {
  queryType: 'timeseries',
  itemIds: [],
  metrics: [],
};

export interface TimeseriesItemEntry {
  item_id: string;
  label: string;
  parent?: string;
  /** "<metric> [<shortcut>]" when the metric has a unit shortcut */
  metric: string;
  metric_label?: string;
  unit?: string;
  unit_shortcut?: string | null;
  timeseries: Record<string, number | string | null>;
}

export interface TimeseriesResponse {
  metadata: { total: number; interval: number };
  items: TimeseriesItemEntry[];
}

/**
 * These are options configured for each DataSource instance
 */
export interface NextGenDataSourceOptions extends DataSourceJsonData {
  protocol?: 'http' | 'https';
  host?: string;
  port?: string;
  tlsSkipVerify?: boolean;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface NextGenSecureJsonData {
  apiKey?: string;
}
