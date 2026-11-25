import { DataSourcePlugin } from '@grafana/data';
import { DataSource } from './datasource';
import { ConfigEditor } from './components/ConfigEditor';
import { QueryEditor } from './components/QueryEditor';
import { NextGenQuery, NextGenDataSourceOptions } from './types';

export const plugin = new DataSourcePlugin<DataSource, NextGenQuery, NextGenDataSourceOptions>(DataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
