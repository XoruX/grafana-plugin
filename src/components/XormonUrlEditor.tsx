import React, { ChangeEvent } from 'react';
import { InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { GraphInterval, NextGenQuery, XormonUrlComponent } from '../types';

const COMPONENT_OPTIONS: Array<SelectableValue<XormonUrlComponent>> = [
  { label: 'Graph', value: 'graph' },
  { label: 'Capacity table', value: 'table' },
  { label: 'Alerting table', value: 'alerting_table' },
];

const INTERVAL_OPTIONS: Array<SelectableValue<GraphInterval>> = [
  { label: 'Day', value: 'day' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Year', value: 'year' },
];

interface Props {
  query: NextGenQuery;
  onChange: (query: NextGenQuery) => void;
  onRunQuery: () => void;
}

/**
 * "XorMon URL" query: a graph or table of a XorMon page. These queries are created by importing the component
 * from XorMon; the editor shows (and allows to adjust) what identifies it.
 */
export function XormonUrlEditor({ query, onChange, onRunQuery }: Props) {
  const { component = 'graph', url, tab, subtab, tabId, graphId, tableId, interval, guid } = query;

  const onText =
    (key: 'url' | 'tab' | 'subtab' | 'tabId' | 'graphId' | 'tableId' | 'guid') =>
    (event: ChangeEvent<HTMLInputElement>) =>
      onChange({ ...query, [key]: event.currentTarget.value || undefined });

  const onComponentChange = (value: SelectableValue<XormonUrlComponent>) => {
    onChange({ ...query, component: value.value });
    onRunQuery();
  };

  const onIntervalChange = (value: SelectableValue<GraphInterval> | null) => {
    onChange({ ...query, interval: value?.value });
    onRunQuery();
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Component" labelWidth={16}>
          <Select options={COMPONENT_OPTIONS} value={component} onChange={onComponentChange} width={30} />
        </InlineField>
      </InlineFieldRow>

      {component === 'alerting_table' ? (
        <InlineFieldRow>
          <InlineField
            label="Dashboard UID"
            labelWidth={16}
            grow
            tooltip="Grafana dashboard the alerting groups were imported to from XorMon"
          >
            <Input value={guid ?? ''} onChange={onText('guid')} onBlur={onRunQuery} />
          </InlineField>
        </InlineFieldRow>
      ) : (
        <>
          <InlineFieldRow>
            <InlineField label="URL" labelWidth={16} grow tooltip="XorMon page the component is on">
              <Input value={url ?? ''} onChange={onText('url')} onBlur={onRunQuery} />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField label="Tab" labelWidth={16}>
              <Input value={tab ?? ''} onChange={onText('tab')} onBlur={onRunQuery} width={30} />
            </InlineField>
            <InlineField label="Subtab" labelWidth={16}>
              <Input value={subtab ?? ''} onChange={onText('subtab')} onBlur={onRunQuery} width={30} />
            </InlineField>
            <InlineField
              label="Tab ID"
              labelWidth={16}
              tooltip="Finds the tab when it has been renamed since the import"
            >
              <Input value={tabId ?? ''} onChange={onText('tabId')} onBlur={onRunQuery} width={30} />
            </InlineField>
          </InlineFieldRow>

          {component === 'graph' ? (
            <>
              <InlineFieldRow>
                <InlineField
                  label="Graph ID"
                  labelWidth={16}
                  tooltip="Graph within the tab; the first graph of the tab when empty"
                >
                  <Input
                    value={graphId ?? ''}
                    onChange={onText('graphId')}
                    onBlur={onRunQuery}
                    width={30}
                    placeholder="First graph"
                  />
                </InlineField>
                <InlineField
                  label="Interval"
                  labelWidth={16}
                  tooltip="Interval the graph was imported with; the panel's relative time was set from it. Data follow the panel's time range."
                >
                  <Select
                    options={INTERVAL_OPTIONS}
                    value={interval ?? null}
                    onChange={onIntervalChange}
                    width={30}
                    isClearable
                    placeholder="None"
                  />
                </InlineField>
              </InlineFieldRow>
            </>
          ) : (
            <InlineFieldRow>
              <InlineField label="Table ID" labelWidth={16} tooltip="Capacity table within the tab">
                <Input value={tableId ?? ''} onChange={onText('tableId')} onBlur={onRunQuery} width={30} />
              </InlineField>
            </InlineFieldRow>
          )}
        </>
      )}
    </>
  );
}
