"""Compare the released and patched controller on the disposable site."""

import json
import os
import sys
import traceback
from pathlib import Path
from secrets import token_hex

import frappe
from frappe.utils import add_days, nowdate


def check_order(expected_error):
    reference = f'QA-EMPTY-{token_hex(5)}'
    fixtures = json.loads(Path('/qa/fixtures/sales.json').read_text(encoding='utf-8'))
    order = frappe.new_doc(
        'Sales Order',
        customer=fixtures['customer']['name'],
        company=fixtures['company']['name'],
        currency=fixtures['company']['currency'],
        order_type='Sales',
        transaction_date=nowdate(),
        delivery_date=add_days(nowdate(), 7),
        selling_price_list='Standard Selling',
        po_no=reference,
        ignore_pricing_rule=1,
        items=[],
    )
    try:
        order.insert()
    except expected_error as error:
        if expected_error is TypeError:
            traceback.print_exc()
        elif 'Please add at least one item.' not in str(error):
            raise AssertionError('The validation error must describe the missing items') from error
    else:
        raise AssertionError('An order without items was accepted')
    finally:
        frappe.db.rollback()
    if frappe.db.exists('Sales Order', {'po_no': reference}):
        raise AssertionError('ERPNext persisted the rejected order')
    print(f'Confirmed rejection with {expected_error.__name__} and no persisted order')


if __name__ == '__main__':
    os.chdir('/home/frappe/frappe-bench/sites')
    frappe.init(site='frontend')
    frappe.connect()
    try:
        frappe.set_user('qa-sales-operator@example.invalid')
        check_order({'baseline': TypeError, 'patched': frappe.MandatoryError}[sys.argv[1]])
    finally:
        frappe.destroy()
