import { expect } from '@playwright/test';

const input = field => `input[data-fieldname="${field}"]:visible`;

export class SalesOrderPage {
  constructor(page, site) {
    this.page = page;
    this.site = site;
    this.grid = page.locator('[data-fieldname="items"] .form-grid:visible');
    this.rows = this.grid.locator('.grid-body .grid-row');
    this.action = name => page.locator('.page-actions:visible').getByRole('button', { name, exact: true });
  }

  async signIn() {
    await this.page.goto(`${this.site.baseURL}/login`);
    await this.page.locator('#login_email').fill(this.site.username);
    await this.page.locator('#login_password').fill(this.site.password);
    await this.page.locator('.form-login').getByRole('button', { name: 'Continue', exact: true }).click();
    await this.page.waitForURL(url => url.pathname.startsWith('/desk'));
  }

  async open(name) {
    await this.page.goto(`${this.site.baseURL}/desk/sales-order/${encodeURIComponent(name)}`);
    await this.grid.waitFor();
  }

  async startNew() {
    await this.page.goto(`${this.site.baseURL}/desk/sales-order`);
    await this.action('Add Sales Order').click();
    await this.grid.waitFor();
  }

  async selectLink(control, value, optionText) {
    await control.fill(value);
    const option = this.page.getByRole('listbox').getByRole('option').filter({ hasText: optionText });
    await expect(option).toBeVisible();
    await option.click();
  }

  async changeField(field, value, scope = this.page) {
    const control = scope.locator(input(field));
    await control.fill(value);
    await control.press('Tab');
  }

  async selectCustomer() {
    await this.selectLink(this.page.locator(input('customer')), this.site.customer, this.site.customer);
    await expect(this.page.locator(input('customer'))).toHaveValue(this.site.customer);
    await this.page.evaluate(() => new Promise(resolve => globalThis.frappe.after_ajax(resolve)));
  }

  async setDeliveryDate(isoDate, scope = this.page) {
    const displayedDate = await this.page.evaluate(
      value => globalThis.frappe.datetime.str_to_user(value, false, true), isoDate,
    );
    await this.changeField('delivery_date', displayedDate, scope);
  }

  async setReference(reference) {
    await this.page.getByRole('tab', { name: 'More Info', exact: true }).click();
    const section = this.page.locator('[data-fieldname="additional_info_section"]');
    await expect(section).toBeVisible();
    const control = section.locator(input('po_no'));
    if (!await control.isVisible()) await section.locator('.section-head').click();
    await this.changeField('po_no', reference);
  }

  async addItem(item, quantity, deliveryDate) {
    if (await this.rows.count() === 0) {
      await this.grid.getByRole('button', { name: 'Add row', exact: true }).click();
    }
    await expect(this.rows).toHaveCount(1);
    const row = this.rows.first();
    await row.locator('.btn-open-row').click();
    const editor = row.locator('.form-in-grid:visible');
    await this.selectLink(editor.locator(input('item_code')), item.code, item.label);
    // The browser applies link selection and price-list results asynchronously.
    await expect.poll(() => this.page.evaluate(() => globalThis.cur_frm?.doc?.items?.[0]?.item_code), {
      message: 'The item selected in the row editor should be the order line item',
    }).toBe(item.code);
    const qty = editor.locator(input('qty'));
    await qty.fill(String(quantity));
    await qty.press('Tab');
    await expect.poll(() => this.page.evaluate(() => globalThis.cur_frm?.doc?.items?.[0]?.rate), {
      message: 'The row should show the selected item price from Standard Selling',
    }).toBe(item.rateCents / 100);
    await this.setDeliveryDate(deliveryDate, editor);
    await editor.locator('.grid-collapse-row').click();
    await expect(editor).toBeHidden();
  }

  async setQuantity(quantity) {
    const row = this.rows.first();
    await row.locator('.btn-open-row').click();
    const editor = row.locator('.form-in-grid:visible');
    await this.changeField('qty', String(quantity), editor);
    await expect.poll(() => this.page.evaluate(() => globalThis.cur_frm?.doc?.items?.[0]?.qty)).toBe(quantity);
    await editor.locator('.grid-collapse-row').click();
    await expect(editor).toBeHidden();
  }

  async save() {
    await this.action('Save').click();
  }

  async submit() {
    await this.action('Submit').click();
    const confirmation = this.page.getByRole('dialog').filter({ hasText: /Permanently Submit/i });
    await confirmation.getByRole('button', { name: 'Yes', exact: true }).click();
    await expect(confirmation).toBeHidden();
  }
}
