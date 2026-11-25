/**
 * Maps XorMon's metric `unit` values (server-nest/common/constants/subsystemMetricsResponse.constants.ts UNIT)
 * to Grafana's built-in value-format IDs, so the panel auto-scales values with SI/IEC prefixes
 * (e.g. 14000 B/s -> 14 KB/s) instead of showing the raw number with a literal suffix.
 *
 * Units with no confident 1:1 Grafana format (mostly small hardware counters) are intentionally
 * left out; callers should fall back to the metric's `shortcut` as a plain text suffix for those.
 */
const UNIT_TO_GRAFANA: Record<string, string> = {
  bytes: 'decbytes',
  bytes_per_second: 'Bps',
  megabytes_per_second: 'MBs',
  bit: 'decbits',
  bits_per_second: 'bps',
  io_per_second: 'iops',
  IOPS: 'iops',
  hertz: 'hertz',
  percent: 'percent',
  millisecond: 'ms',
  second: 's',
  days: 'd',
  watt: 'watt',
  voltage: 'volt',
  temperature: 'celsius',
  OPS: 'ops',
  transactions_per_sec: 'ops',
  requests_per_second: 'reqps',
  packets_per_second: 'pps',
  rpm: 'rpm',
  decibel_milliwatts: 'dBm',
  sfp_power: 'dBm',
  sfp_power_out: 'dBm',
  sfp_power_in: 'dBm',
  quantity: 'short',
  count: 'short',
};

export function toGrafanaUnit(unit?: string, shortcut?: string): string | undefined {
  if (unit && UNIT_TO_GRAFANA[unit]) {
    return UNIT_TO_GRAFANA[unit];
  }
  return shortcut;
}
