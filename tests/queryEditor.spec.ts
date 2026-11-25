import { test, expect } from '@grafana/plugin-e2e';

// No XorMon server runs in CI, so the XorMon API calls going through the datasource proxy are mocked.
const proxied = (path: string) => new RegExp(`/api/datasources/proxy/uid/[^/]+/api${path}/?(\\?.*)?$`);

test.beforeEach(async ({ page }) => {
  await page.route(proxied('/architecture/classes'), (route) =>
    route.fulfill({ status: 200, json: { statusCode: 200, data: [{ class: 'storage', label: 'Storage' }] } })
  );
  await page.route(proxied('/health_status'), (route) =>
    route.fulfill({
      status: 200,
      json: {
        statusCode: 200,
        data: [
          {
            status: 'ERROR',
            count: 1,
            devices: [
              {
                class: 'storage',
                hw_type: 'eseries',
                hw_type_label: 'E-series',
                label: 'Lenovo DE2000',
                item_id: 'device-1',
                updatedAt: 1764072000000,
                note: 'Storage array status is needsAttn',
                status: 'ERROR',
                data: 1,
                connection: 1,
              },
            ],
          },
        ],
      },
    })
  );
});

test('smoke: should render query editor', async ({ panelEditPage, readProvisionedDataSource }) => {
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  await panelEditPage.datasource.set(ds.name);
  await expect(panelEditPage.getQueryEditorRow('A').getByRole('combobox', { name: 'Type', exact: true })).toBeVisible();
});

test('health status query should return the devices', async ({
  panelEditPage,
  readProvisionedDataSource,
  selectors,
}) => {
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  await panelEditPage.datasource.set(ds.name);
  await panelEditPage.setVisualization('Table');

  await panelEditPage.getQueryEditorRow('A').getByRole('combobox', { name: 'Type', exact: true }).click();
  await panelEditPage
    .getByGrafanaSelector(selectors.components.Select.option)
    .filter({ hasText: 'Health Status' })
    .click();

  await expect(panelEditPage.panel.fieldNames).toContainText(['Severity', 'Label', 'Technology', 'Note', 'Updated At']);
  await expect(panelEditPage.panel.data).toContainText(['Lenovo DE2000']);
});
