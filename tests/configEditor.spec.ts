import { test, expect } from '@grafana/plugin-e2e';

// The plugin has no backend: "Save & test" runs in the browser and calls the XorMon API through the datasource
// proxy (GET /api/architecture/classes). No XorMon server runs in CI, so the call is mocked.
const CLASSES_PATH = '/api/architecture/classes';

test('smoke: should render config editor', async ({ createDataSourceConfigPage, readProvisionedDataSource, page }) => {
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  await createDataSourceConfigPage({ type: ds.type });
  await expect(page.getByRole('combobox', { name: 'Protocol' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Host' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Port' })).toBeVisible();
});

test('"Save & test" should display success alert box when XorMon answers', async ({
  createDataSourceConfigPage,
  readProvisionedDataSource,
  selectors,
  page,
}) => {
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  const configPage = await createDataSourceConfigPage({ type: ds.type });
  const path = `${selectors.apis.DataSource.proxy(configPage.datasource.uid, configPage.datasource.id.toString())}${CLASSES_PATH}`;
  await page.route(`**${path}`, (route) =>
    route.fulfill({ status: 200, json: { statusCode: 200, data: [{ class: 'storage', label: 'Storage' }] } })
  );

  await expect(configPage.saveAndTest({ path })).toBeOK();
  await expect(configPage).toHaveAlert('success');
});

test('"Save & test" should report an invalid XorMon license', async ({
  createDataSourceConfigPage,
  readProvisionedDataSource,
  selectors,
  page,
}) => {
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  const configPage = await createDataSourceConfigPage({ type: ds.type });
  const path = `${selectors.apis.DataSource.proxy(configPage.datasource.uid, configPage.datasource.id.toString())}${CLASSES_PATH}`;
  await page.route(`**${path}`, (route) =>
    route.fulfill({ status: 402, json: { statusCode: 402, error: 'Payment Required' } })
  );

  await expect(configPage.saveAndTest({ path })).not.toBeOK();
  await expect(configPage).toHaveAlert('error', { hasText: 'The Xormon instance does not have a valid license.' });
});
