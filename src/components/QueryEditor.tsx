import React, { ChangeEvent, useEffect, useState } from 'react';
import { Button, Checkbox, ColorPicker, InlineField, InlineFieldRow, Input, LoadingPlaceholder, MultiSelect, Select } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { DataSource } from '../datasource';
import { ArchHwType, ArchItem, ArchMetric, ArchSubsystem, NextGenDataSourceOptions, NextGenQuery, QueryMetric, QueryType } from '../types';
import { XormonUrlEditor } from './XormonUrlEditor';

type Props = QueryEditorProps<DataSource, NextGenQuery, NextGenDataSourceOptions>;

// For these classes, architecture items don't meaningfully group by hw_type (or a single query
// should span all of them), so the cascade goes straight from Class to Subsystem — the backend
// merges subsystems/metrics/items across every hw_type of the class when hw_type is omitted.
const SKIP_HW_TYPE_CLASSES = ['storage', 'san', 'lan'];

const TYPE_OPTIONS: Array<SelectableValue<QueryType>> = [
  { label: 'Timeseries', value: 'timeseries' },
  { label: 'Health Status', value: 'health_status' },
  { label: 'Capacity', value: 'capacity' },
  { label: 'XorMon URL', value: 'xormon_url', description: 'Graph or table of a XorMon page, imported from XorMon' },
];

const CAPACITY_CLASS_OPTIONS: Array<SelectableValue<string>> = [{ label: 'Storage', value: 'storage' }];

const CAPACITY_SUBSYSTEM_OPTIONS: Array<SelectableValue<string>> = [
  { label: 'Device', value: 'device' },
  { label: 'Pool', value: 'pool' },
  { label: 'Volume', value: 'volume' },
];

const SEVERITY_OPTIONS: Array<SelectableValue<string>> = [
  { label: 'OK', value: 'OK' },
  { label: 'Warning', value: 'WARNING' },
  { label: 'Error', value: 'ERROR' },
  { label: 'Unknown', value: 'UNKNOWN' },
  { label: 'Test', value: 'TEST' },
];

export function QueryEditor({ query, onChange, onRunQuery, datasource }: Props) {
  const [classes, setClasses] = useState<Array<SelectableValue<string>>>([]);
  const [hwTypes, setHwTypes] = useState<Array<SelectableValue<string>>>([]);
  const [subsystems, setSubsystems] = useState<Array<SelectableValue<string>>>([]);
  const [items, setItems] = useState<ArchItem[]>([]);
  const [metrics, setMetrics] = useState<ArchMetric[]>([]);
  const [parentSubsystems, setParentSubsystems] = useState<Array<SelectableValue<string>>>([]);
  const [parentItems, setParentItems] = useState<ArchItem[]>([]);
  const [loading, setLoading] = useState<{ [k: string]: boolean }>({});

  const {
    queryType = 'timeseries',
    class: cls,
    hwType,
    subsystem,
    itemIds = [],
    allItems = false,
    filterByParents = false,
    parentSubsystem,
    parentItemIds = [],
    metrics: selectedMetrics = [],
    healthSeverities = [],
  } = query;
  const parentItemIdsKey = parentItemIds.join(',');
  const skipHwType = !!cls && SKIP_HW_TYPE_CLASSES.includes(cls);

  // Capacity is always scoped to class=storage. The Class field displays this fixed value regardless
  // of query.class, so make sure the underlying query actually has it set — otherwise a query loaded
  // with queryType "capacity" but no class (e.g. hand-edited JSON, or an older saved query) would show
  // "Storage" while every downstream call (HW Type, Items) silently fails because cls is undefined.
  useEffect(() => {
    if (queryType === 'capacity' && cls !== 'storage') {
      onChange({ ...query, class: 'storage' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryType, cls]);

  useEffect(() => {
    setLoading((l) => ({ ...l, classes: true }));
    datasource
      .getClasses()
      .then((res) => setClasses(res.map((c) => ({ label: c.label, value: c.class }))))
      .finally(() => setLoading((l) => ({ ...l, classes: false })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!cls || skipHwType) {
      setHwTypes([]);
      return;
    }
    setLoading((l) => ({ ...l, hwTypes: true }));
    datasource
      .getHwTypes(cls)
      .then((res: ArchHwType[]) => setHwTypes(res.map((h) => ({ label: h.label, value: h.hw_type }))))
      .finally(() => setLoading((l) => ({ ...l, hwTypes: false })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls, skipHwType]);

  useEffect(() => {
    // Capacity uses a fixed subsystem list (see CAPACITY_SUBSYSTEM_OPTIONS) instead of fetching one.
    if (!cls || queryType === 'capacity' || (!skipHwType && !hwType)) {
      setSubsystems([]);
      return;
    }
    setLoading((l) => ({ ...l, subsystems: true }));
    datasource
      .getSubsystems(cls, skipHwType ? undefined : hwType)
      .then((res: ArchSubsystem[]) => setSubsystems(res.map((s) => ({ label: s.label, value: s.subsystem }))))
      .finally(() => setLoading((l) => ({ ...l, subsystems: false })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls, hwType, queryType, skipHwType]);

  useEffect(() => {
    // Capacity has no metric selection — it always returns the same fixed set of capacity fields.
    if (!cls || !subsystem || queryType === 'capacity' || (!skipHwType && !hwType)) {
      setMetrics([]);
      return;
    }
    setLoading((l) => ({ ...l, metrics: true }));
    datasource
      .getMetrics(cls, subsystem, skipHwType ? undefined : hwType)
      .then(setMetrics)
      .finally(() => setLoading((l) => ({ ...l, metrics: false })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls, hwType, subsystem, queryType, skipHwType]);

  useEffect(() => {
    if (!cls || !subsystem || (!skipHwType && !hwType)) {
      setItems([]);
      return;
    }
    if (filterByParents && !parentItemIds.length) {
      setItems([]);
      return;
    }
    setLoading((l) => ({ ...l, items: true }));
    datasource
      .searchItems({
        cls,
        hwType: skipHwType ? undefined : hwType,
        subsystem,
        parents: filterByParents ? parentItemIds : undefined,
      })
      .then(setItems)
      .finally(() => setLoading((l) => ({ ...l, items: false })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls, hwType, subsystem, filterByParents, parentItemIdsKey, skipHwType]);

  useEffect(() => {
    if (!filterByParents || !cls || !subsystem) {
      setParentSubsystems([]);
      return;
    }
    setLoading((l) => ({ ...l, parentSubsystems: true }));
    datasource
      .getParentSubsystems(cls, subsystem)
      .then((res) => setParentSubsystems(res.map((s) => ({ label: s.label, value: s.subsystem }))))
      .finally(() => setLoading((l) => ({ ...l, parentSubsystems: false })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterByParents, cls, subsystem]);

  useEffect(() => {
    if (!filterByParents || !cls || !parentSubsystem || (!skipHwType && !hwType)) {
      setParentItems([]);
      return;
    }
    setLoading((l) => ({ ...l, parentItems: true }));
    datasource
      .searchItems({ cls, hwType: skipHwType ? undefined : hwType, subsystem: parentSubsystem })
      .then(setParentItems)
      .finally(() => setLoading((l) => ({ ...l, parentItems: false })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterByParents, cls, hwType, parentSubsystem, skipHwType]);

  const onQueryTypeChange = (value: SelectableValue<QueryType>) => {
    const newType = value.value!;
    onChange({
      ...query,
      queryType: newType,
      // Switching types starts the architecture cascade over — Capacity is always scoped to class=storage.
      class: newType === 'capacity' ? 'storage' : undefined,
      hwType: undefined,
      subsystem: undefined,
      itemIds: [],
      allItems: false,
      metrics: [],
      filterByParents: false,
      parentSubsystem: undefined,
      parentItemIds: [],
      component: newType === 'xormon_url' ? (query.component ?? 'graph') : undefined,
    });
    onRunQuery();
  };

  const onHealthSeveritiesChange = (values: Array<SelectableValue<string>>) => {
    onChange({ ...query, healthSeverities: values.map((v) => v.value!) });
    onRunQuery();
  };

  const onClassChange = (value: SelectableValue<string>) => {
    onChange({
      ...query,
      class: value.value,
      hwType: undefined,
      subsystem: undefined,
      itemIds: [],
      allItems: false,
      metrics: [],
      parentSubsystem: undefined,
      parentItemIds: [],
    });
    onRunQuery();
  };

  const onHwTypeChange = (value: SelectableValue<string>) => {
    onChange({ ...query, hwType: value.value, subsystem: undefined, itemIds: [], allItems: false, metrics: [] });
    onRunQuery();
  };

  const onSubsystemChange = (value: SelectableValue<string>) => {
    onChange({
      ...query,
      subsystem: value.value,
      itemIds: [],
      allItems: false,
      metrics: [],
      parentSubsystem: undefined,
      parentItemIds: [],
    });
    onRunQuery();
  };

  const onItemsChange = (values: Array<SelectableValue<string>>) => {
    onChange({ ...query, itemIds: values.map((v) => v.value!), allItems: false });
    onRunQuery();
  };

  const onSelectAllItems = () => {
    onChange({ ...query, itemIds: [], allItems: true });
    onRunQuery();
  };

  const onClearAllItems = () => {
    onChange({ ...query, allItems: false });
    onRunQuery();
  };

  const onFilterByParentsChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...query,
      filterByParents: event.target.checked,
      parentSubsystem: undefined,
      parentItemIds: [],
      itemIds: [],
      allItems: false,
    });
    onRunQuery();
  };

  const onParentSubsystemChange = (value: SelectableValue<string>) => {
    onChange({ ...query, parentSubsystem: value.value, parentItemIds: [], itemIds: [] });
    onRunQuery();
  };

  const onParentItemsChange = (values: Array<SelectableValue<string>>) => {
    onChange({ ...query, parentItemIds: values.map((v) => v.value!), itemIds: [] });
    onRunQuery();
  };

  const onSelectAllParentItems = () => {
    onChange({ ...query, parentItemIds: parentItems.map((i) => i.item_id), itemIds: [] });
    onRunQuery();
  };

  const onMetricsChange = (values: Array<SelectableValue<string>>) => {
    const newMetrics: QueryMetric[] = values.map((v) => {
      const existing = selectedMetrics.find((m) => m.metric === v.value);
      if (existing) {
        return existing;
      }
      const meta = metrics.find((m) => m.metric === v.value);
      return { metric: v.value!, label: meta?.label ?? v.value!, shortcut: meta?.shortcut, unit: meta?.unit };
    });
    onChange({ ...query, metrics: newMetrics });
    onRunQuery();
  };

  const onMetricColorChange = (metric: string, color: string) => {
    onChange({
      ...query,
      metrics: selectedMetrics.map((m) => (m.metric === metric ? { ...m, color } : m)),
    });
    onRunQuery();
  };

  const selectedUnit = selectedMetrics.find((m) => m.unit)?.unit;
  const metricOptions: Array<SelectableValue<string>> = metrics.map((m) => ({
    label: m.label,
    value: m.metric,
    description: m.shortcut ?? m.unit,
    isDisabled: !!selectedUnit && !!m.unit && m.unit !== selectedUnit,
  }));

  // A single selected item makes each metric's color a deliberate, meaningful choice; with several
  // items (or "all items", whose count isn't known until query time) that color would be shared
  // indistinctly across all of them, so Grafana's palette takes over instead.
  const showMetricColors = !allItems && itemIds.length === 1 && selectedMetrics.length > 0;

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Type" labelWidth={16}>
          <Select options={TYPE_OPTIONS} value={queryType} onChange={onQueryTypeChange} width={30} />
        </InlineField>
      </InlineFieldRow>

      {queryType === 'xormon_url' && <XormonUrlEditor query={query} onChange={onChange} onRunQuery={onRunQuery} />}

      {queryType === 'health_status' && (
        <InlineFieldRow>
          <InlineField label="Severities" labelWidth={16} grow tooltip="Leave empty to include all severities">
            <MultiSelect
              options={SEVERITY_OPTIONS}
              value={healthSeverities}
              onChange={onHealthSeveritiesChange}
              placeholder="All severities"
            />
          </InlineField>
        </InlineFieldRow>
      )}

      {(queryType === 'timeseries' || queryType === 'capacity') && (
        <>
          <InlineFieldRow>
            <InlineField label="Class" labelWidth={16}>
              {queryType === 'capacity' ? (
                <Select options={CAPACITY_CLASS_OPTIONS} value="storage" onChange={() => {}} width={30} disabled />
              ) : loading.classes ? (
                <LoadingPlaceholder text="" />
              ) : (
                <Select options={classes} value={cls} onChange={onClassChange} width={30} placeholder="Select class" />
              )}
            </InlineField>
            {!skipHwType && (
              <InlineField label="HW Type" labelWidth={16}>
                {loading.hwTypes ? (
                  <LoadingPlaceholder text="" />
                ) : (
                  <Select
                    options={hwTypes}
                    value={hwType}
                    onChange={onHwTypeChange}
                    width={30}
                    placeholder="Select HW type"
                    disabled={!cls}
                  />
                )}
              </InlineField>
            )}
            <InlineField label="Subsystem" labelWidth={16}>
              {queryType === 'capacity' ? (
                <Select
                  options={CAPACITY_SUBSYSTEM_OPTIONS}
                  value={subsystem}
                  onChange={onSubsystemChange}
                  width={30}
                  placeholder="Select subsystem"
                  disabled={skipHwType ? !cls : !hwType}
                />
              ) : loading.subsystems ? (
                <LoadingPlaceholder text="" />
              ) : (
                <Select
                  options={subsystems}
                  value={subsystem}
                  onChange={onSubsystemChange}
                  width={30}
                  placeholder="Select subsystem"
                  disabled={skipHwType ? !cls : !hwType}
                />
              )}
            </InlineField>
          </InlineFieldRow>

          {queryType === 'timeseries' && (
            <>
              <InlineFieldRow>
                <InlineField
                  label="Filter by parents"
                  labelWidth={22}
                  tooltip="Pick items indirectly, by selecting one or more parent items first"
                >
                  <Checkbox value={filterByParents} onChange={onFilterByParentsChange} disabled={!subsystem} />
                </InlineField>
              </InlineFieldRow>

              {filterByParents && (
                <>
                  <InlineFieldRow>
                    <InlineField label="Parent Subsystem" labelWidth={16}>
                      {loading.parentSubsystems ? (
                        <LoadingPlaceholder text="" />
                      ) : (
                        <Select
                          options={parentSubsystems}
                          value={parentSubsystem}
                          onChange={onParentSubsystemChange}
                          width={30}
                          placeholder="Select parent subsystem"
                        />
                      )}
                    </InlineField>
                  </InlineFieldRow>

                  <InlineFieldRow>
                    <InlineField label="Parent Items" labelWidth={16} grow>
                      {loading.parentItems ? (
                        <LoadingPlaceholder text="" />
                      ) : (
                        <MultiSelect
                          options={parentItems.map((i) => ({ label: i.label, value: i.item_id }))}
                          value={parentItemIds}
                          onChange={onParentItemsChange}
                          placeholder="Select parent items"
                          disabled={!parentSubsystem}
                        />
                      )}
                    </InlineField>
                    <Button variant="secondary" onClick={onSelectAllParentItems} disabled={!parentItems.length}>
                      Select all
                    </Button>
                  </InlineFieldRow>
                </>
              )}
            </>
          )}

          <InlineFieldRow>
            <InlineField
              label="Items"
              labelWidth={16}
              grow
              tooltip={allItems ? 'Resolved to every matching item again each time the query runs' : undefined}
            >
              {loading.items ? (
                <LoadingPlaceholder text="" />
              ) : allItems ? (
                <Input value="All items" disabled />
              ) : (
                <MultiSelect
                  options={items.map((i) => ({ label: i.label, value: i.item_id }))}
                  value={itemIds}
                  onChange={onItemsChange}
                  placeholder="Select items"
                  disabled={!subsystem || (filterByParents && !parentItemIds.length)}
                />
              )}
            </InlineField>
            <Button variant="secondary" onClick={allItems ? onClearAllItems : onSelectAllItems} disabled={!allItems && !items.length}>
              {allItems ? 'Choose specific items' : 'Select all'}
            </Button>
          </InlineFieldRow>

          {queryType === 'timeseries' && (
            <>
              <InlineFieldRow>
                <InlineField label="Metrics" labelWidth={16} grow tooltip="All selected metrics must share the same unit">
                  {loading.metrics ? (
                    <LoadingPlaceholder text="" />
                  ) : (
                    <MultiSelect
                      options={metricOptions}
                      value={selectedMetrics.map((m) => m.metric)}
                      onChange={onMetricsChange}
                      placeholder="Select metrics"
                      disabled={!subsystem}
                    />
                  )}
                </InlineField>
              </InlineFieldRow>

              {showMetricColors && (
                <InlineFieldRow>
                  {selectedMetrics.map((m) => (
                    <InlineField key={m.metric} label={m.label} labelWidth={16}>
                      <ColorPicker color={m.color ?? 'green'} onChange={(color) => onMetricColorChange(m.metric, color)} />
                    </InlineField>
                  ))}
                </InlineFieldRow>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
