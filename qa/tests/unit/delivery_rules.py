"""Unit checks for the shipped Sales Order controller, without HTTP or DB writes."""

import unittest
from types import SimpleNamespace
from unittest.mock import patch

from erpnext.selling.doctype.sales_order.sales_order import SalesOrder


class RejectedDelivery(Exception):
    pass


def order(today, delivery, line_dates, *, order_type='Sales', skip=0):
    rows = [SimpleNamespace(delivery_date=date) for date in line_dates]
    doc = SimpleNamespace(
        order_type=order_type, skip_delivery_note=skip,
        transaction_date=today, delivery_date=delivery,
        get=lambda field: rows if field == 'items' else None,
        validate_sales_mntc_quotation=lambda: None,
    )
    return doc, rows


class DeliveryRules(unittest.TestCase):
    def setUp(self):
        module = 'erpnext.selling.doctype.sales_order.sales_order'
        self.enterContext(patch(f'{module}._', side_effect=lambda text: text))
        self.enterContext(patch(f'{module}.frappe.throw', side_effect=RejectedDelivery))
        self.enterContext(patch(f'{module}.frappe.msgprint', side_effect=RejectedDelivery))

    def test_header_follows_latest_line_date(self):
        doc, _ = order('2030-03-01', None, ['2030-03-08', '2030-03-12'])
        SalesOrder.validate_delivery_date(doc)
        self.assertEqual(doc.delivery_date, '2030-03-12')

    def test_header_date_fills_blank_line(self):
        doc, rows = order('2030-03-01', '2030-03-08', [None])
        SalesOrder.validate_delivery_date(doc)
        self.assertEqual(rows[0].delivery_date, '2030-03-08')

    def test_same_day_is_valid(self):
        doc, rows = order('2030-03-01', '2030-03-01', ['2030-03-01'])
        SalesOrder.validate_delivery_date(doc)
        self.assertEqual(rows[0].delivery_date, '2030-03-01')

    def test_one_past_line_is_rejected_even_with_a_future_header(self):
        doc, _ = order('2030-03-01', '2030-03-08', ['2030-02-28', '2030-03-08'])
        with self.assertRaisesRegex(RejectedDelivery, 'Expected Delivery Date should be after'):
            SalesOrder.validate_delivery_date(doc)

    def test_order_without_dates_is_rejected(self):
        doc, _ = order('2030-03-01', None, [None])
        with self.assertRaisesRegex(RejectedDelivery, 'Please enter Delivery Date'):
            SalesOrder.validate_delivery_date(doc)

    def test_skip_delivery_note_allows_no_delivery_date(self):
        doc, _ = order('2030-03-01', None, [None], skip=1)
        SalesOrder.validate_delivery_date(doc)
        self.assertIsNone(doc.delivery_date)


if __name__ == '__main__':
    unittest.main(verbosity=2)
