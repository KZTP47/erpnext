"""Configure the fresh `frontend` site created by the pinned Compose stack."""

import json
import os
from pathlib import Path
from secrets import token_hex

import erpnext
import frappe
from frappe.desk.page.setup_wizard.setup_wizard import setup_complete
from frappe.utils import nowdate
from frappe.utils.password import update_password

FIXTURES = json.loads(Path('/qa/fixtures/sales.json').read_text(encoding='utf-8'))
OPERATOR = 'qa-sales-operator@example.invalid'
BENCH = '/home/frappe/frappe-bench'


def ensure_company():
    company = FIXTURES['company']
    if frappe.is_setup_complete():
        if not frappe.db.exists('Company', company['name']):
            raise RuntimeError('Refusing to seed an existing site without the synthetic QA company')
        return

    year = nowdate()[:4]
    result = setup_complete({
        'company_name': company['name'],
        'company_abbr': company['abbreviation'],
        'country': company['country'],
        'currency': company['currency'],
        'timezone': company['timezone'],
        'language': 'English',
        'chart_of_accounts': 'Standard',
        'fy_start_date': f'{year}-01-01',
        'fy_end_date': f'{year}-12-31',
        'enable_telemetry': 0,
        'allow_recording_first_session': 0,
    })
    if result.get('status') != 'ok' or not frappe.db.exists('Company', company['name']):
        raise RuntimeError('ERPNext setup wizard did not create the synthetic QA company')


def ensure_catalog():
    customer = FIXTURES['customer']
    if not frappe.db.exists('Customer', customer['name']):
        frappe.get_doc({
            'doctype': 'Customer',
            'customer_name': customer['name'],
            'customer_type': customer['type'],
            'customer_group': customer['group'],
            'territory': FIXTURES['company']['country'],
        }).insert()

    for item in FIXTURES['items']:
        if not frappe.db.exists('Item', item['code']):
            frappe.get_doc({
                'doctype': 'Item',
                'item_code': item['code'],
                'item_name': item['label'],
                'is_stock_item': 0,
                'is_sales_item': 1,
                'item_group': 'Products',
                'stock_uom': 'Nos',
            }).insert()
        if not frappe.db.exists('Item Price', {'item_code': item['code'], 'price_list': 'Standard Selling'}):
            frappe.get_doc({
                'doctype': 'Item Price',
                'item_code': item['code'],
                'price_list': 'Standard Selling',
                'price_list_rate': item['rateCents'] / 100,
            }).insert()


def prepare_operator():
    if not frappe.db.exists('User', OPERATOR):
        frappe.get_doc({
            'doctype': 'User',
            'email': OPERATOR,
            'first_name': 'Synthetic Sales Operator',
            'user_type': 'System User',
            'language': 'en',
            'send_welcome_email': 0,
            'roles': [{'role': 'Sales User'}, {'role': 'Sales Manager'}],
        }).insert()
    user = frappe.get_doc('User', OPERATOR)
    assigned_roles = {row.role for row in user.roles}
    for role in ('Sales User', 'Sales Manager'):
        if role not in assigned_roles:
            user.append('roles', {'role': role})
    user.api_key = user.api_key or token_hex(8)[:15]
    secret = token_hex(8)[:15]
    user.api_secret = secret
    user.save()
    password = token_hex(18)
    update_password(OPERATOR, password)
    return {'username': OPERATOR, 'password': password, 'apiKey': user.api_key, 'apiSecret': secret}


def main():
    if erpnext.__version__ != '17.0.0-dev':
        raise RuntimeError(f'Expected ERPNext 17.0.0-dev, found {erpnext.__version__}')
    # Match Bench's working directory so Frappe resolves ../logs correctly.
    os.chdir(f'{BENCH}/sites')
    frappe.init(site='frontend')
    frappe.connect()
    try:
        frappe.set_user('Administrator')
        ensure_company()
        frappe.db.set_single_value('System Settings', 'date_format', 'yyyy-mm-dd')
        frappe.db.set_single_value('System Settings', 'enable_onboarding', 0)
        ensure_catalog()
        selling_settings = frappe.get_single('Selling Settings')
        selling_settings.selling_price_list = 'Standard Selling'
        selling_settings.save()
        # The fixture totals describe tax-free orders in this synthetic company.
        frappe.db.set_value('Sales Taxes and Charges Template', {
            'company': FIXTURES['company']['name'], 'is_default': 1,
        }, 'is_default', 0)
        actor = prepare_operator()
        frappe.db.commit()
        print('QA_SITE=' + json.dumps({
            **actor,
            'company': FIXTURES['company']['name'],
            'customer': FIXTURES['customer']['name'],
            'today': nowdate(),
            'erpnextVersion': erpnext.__version__,
        }))
    finally:
        frappe.destroy()


if __name__ == '__main__':
    main()
