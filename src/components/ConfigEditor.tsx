import React, { ChangeEvent, useEffect } from 'react';
import { InlineField, Input, SecretInput, Select, InlineSwitch } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps, SelectableValue } from '@grafana/data';
import { NextGenDataSourceOptions, NextGenSecureJsonData } from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<NextGenDataSourceOptions, NextGenSecureJsonData> {}

const PROTOCOL_OPTIONS: Array<SelectableValue<'http' | 'https'>> = [
  { label: 'https', value: 'https' },
  { label: 'http', value: 'http' },
];

export function ConfigEditor(props: Props) {
  const { onOptionsChange, options } = props;
  const { jsonData, secureJsonFields, secureJsonData } = options;

  // The Protocol select below shows 'https' via a display fallback (`jsonData.protocol ?? 'https'`)
  // when nothing is saved yet, so it never prompts the user to actually pick one. Without this, the
  // datasource can be saved with jsonData.protocol genuinely undefined, which renders as the literal
  // string "<no value>" in the backend's Go route-URL template and breaks every request with a 502.
  useEffect(() => {
    if (!jsonData.protocol) {
      onOptionsChange({ ...options, jsonData: { ...jsonData, protocol: 'https' } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jsonData.protocol]);

  const onProtocolChange = (value: SelectableValue<'http' | 'https'>) => {
    onOptionsChange({ ...options, jsonData: { ...jsonData, protocol: value.value } });
  };

  const onHostChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({ ...options, jsonData: { ...jsonData, host: event.target.value } });
  };

  const onPortChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({ ...options, jsonData: { ...jsonData, port: event.target.value } });
  };

  const onSkipTlsVerifyChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({ ...options, jsonData: { ...jsonData, tlsSkipVerify: event.target.checked } });
  };

  const onApiKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({ ...options, secureJsonData: { apiKey: event.target.value } });
  };

  const onResetApiKey = () => {
    onOptionsChange({
      ...options,
      secureJsonFields: { ...options.secureJsonFields, apiKey: false },
      secureJsonData: { ...options.secureJsonData, apiKey: '' },
    });
  };

  return (
    <>
      <InlineField label="Protocol" labelWidth={16} interactive>
        <Select
          id="config-editor-protocol"
          options={PROTOCOL_OPTIONS}
          value={jsonData.protocol ?? 'https'}
          onChange={onProtocolChange}
          width={16}
        />
      </InlineField>
      <InlineField label="Host" labelWidth={16} interactive tooltip="Hostname or IP of the XorMon server">
        <Input
          id="config-editor-host"
          onChange={onHostChange}
          value={jsonData.host ?? ''}
          placeholder="xormon.example.com"
          width={40}
        />
      </InlineField>
      <InlineField label="Port" labelWidth={16} interactive>
        <Input
          id="config-editor-port"
          onChange={onPortChange}
          value={jsonData.port ?? ''}
          placeholder="8443"
          width={16}
        />
      </InlineField>
      <InlineField label="Skip TLS verify" labelWidth={16} interactive tooltip="Enable when the server uses a self-signed certificate">
        <InlineSwitch
          id="config-editor-skip-tls-verify"
          value={jsonData.tlsSkipVerify ?? false}
          onChange={onSkipTlsVerifyChange}
        />
      </InlineField>
      <InlineField label="API Key" labelWidth={16} interactive tooltip="Public API key (Settings > API keys in the XorMon app)">
        <SecretInput
          required
          id="config-editor-api-key"
          isConfigured={secureJsonFields?.apiKey}
          value={secureJsonData?.apiKey}
          placeholder="Enter your API key"
          width={40}
          onReset={onResetApiKey}
          onChange={onApiKeyChange}
        />
      </InlineField>
    </>
  );
}
