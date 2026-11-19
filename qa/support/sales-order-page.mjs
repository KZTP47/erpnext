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
    await this.page.getByRole('option').filter({ hasText: optionText }).click();
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

  async setDeliveryDate(isoDate) {
    const displayedDate = await this.page.evaluate(
      value => globalThis.frappe.datetime.str_to_user(value, false, true), isoDate,
    );
    await this.changeField('delivery_date', displayedDate);
  }

  async setReference(reference) {
    await this.page.getByRole('tab', { name: 'More Info', exact: true }).click();
    const section = this.page.locator('[data-fieldname="additional_info_section"]');
    const control = section.locator(input('po_no'));
    if (!await control.isVisible()) await section.locator('.section-head').click();
    await this.changeField('po_no', reference);
  }

  async addItem(item, quantity) {
    if (await this.rows.count() === 0) {
      await this.grid.getByRole('button', { name: 'Add row', exact: true }).click();
    }
    await expect(this.rows).toHaveCount(1);
    const row = this.rows.first();
    await row.locator('.data-row > .grid-static-col[data-fieldname="item_code"]').click();
    await this.selectLink(row.locator(input('item_code')), item.code, item.label);
    // ERPNext fills the item price asynchronously after selecting the link.
    await this.page.waitForFunction(({ code, rate }) => globalThis.cur_frm?.doc?.items?.some(
      line => line.item_code === code && Number(line.rate) === rate,
    ), { code: item.code, rate: item.rateCents / 100 });
    await this.setQuantity(quantity, row);
  }

  async setQuantity(quantity, row = this.rows.first()) {
    await row.locator('.data-row > .grid-static-col[data-fieldname="qty"]').click();
    const control = row.locator(input('qty'));
    await control.fill(String(quantity));
    await control.press('Tab');
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
