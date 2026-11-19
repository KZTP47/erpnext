import { expect } from '@playwright/test';

const input = field => `input[data-fieldname="${field}"]:visible`;

export class SalesOrderPage {
  constructor(page, site) {
    this.page = page;
    this.site = site;
    this.grid = page.locator('[data-fieldname="items"] .form-grid:visible');
    this.primary = name => page.locator('.page-actions:visible').getByRole('button', { name, exact: true });
  }

  async signIn() {
    await this.page.goto(`${this.site.baseURL}/login`);
    await this.page.locator('#login_email').fill(this.site.username);
    await this.page.locator('#login_password').fill(this.site.password);
    await this.page.getByRole('button', { name: 'Login', exact: true }).click();
    await this.page.waitForURL(url => url.pathname.startsWith('/desk'));
  }

  async open(name) {
    await this.page.goto(`${this.site.baseURL}/desk/sales-order/${encodeURIComponent(name)}`);
    await this.grid.waitFor();
  }

  async startNew() {
    await this.page.goto(`${this.site.baseURL}/desk/sales-order`);
    await this.primary('Add Sales Order').click();
    await this.grid.waitFor();
  }

  async selectLink(control, value, optionText) {
    await control.fill(value);
    await this.page.locator('.awesomplete li:visible').filter({ hasText: optionText }).first().click();
  }

  async changeField(field, value) {
    const control = this.page.locator(input(field));
    await control.fill(value);
    await control.press('Tab');
  }

  async selectCustomer() {
    await this.selectLink(this.page.locator(input('customer')), this.site.customer, this.site.customer);
    await expect(this.page.locator(input('customer'))).toHaveValue(this.site.customer);
  }

  async addItem(item, quantity) {
    await this.grid.getByRole('button', { name: 'Add Row', exact: true }).click();
    const row = this.grid.locator('.grid-body .grid-row').last();
    await row.locator('.data-row [data-fieldname="item_code"]').click();
    await this.selectLink(row.locator(input('item_code')), item.code, item.label);
    await this.setQuantity(quantity);
  }

  async setQuantity(quantity) {
    const row = this.grid.locator('.grid-body .grid-row').first();
    await row.locator('.data-row [data-fieldname="qty"]').click();
    const control = row.locator(input('qty'));
    await control.fill(String(quantity));
    await control.press('Tab');
  }

  async save() {
    await this.primary('Save').click();
  }

  async submit() {
    await this.primary('Submit').click();
    const confirmation = this.page.getByRole('dialog').filter({ hasText: /Permanently Submit/i });
    await confirmation.getByRole('button', { name: 'Yes', exact: true }).click();
    await expect(confirmation).toBeHidden();
  }
}
