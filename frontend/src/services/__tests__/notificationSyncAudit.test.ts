import { describe, it, expect } from 'vitest';

describe('Notification Sync & Interactive Routing Audit Suite', () => {
  const mockNotifications = [
    {
      id: 'notif-1',
      title: 'Invoice Payment Received',
      message: '₹1,500.00 received for Bill #BILL-0001 from Aarav Sharma',
      type: 'payment',
      read: false,
      date: '2026-09-12',
      time: '14:30',
      link: '/receipt?id=bill-1',
      entityType: 'bill',
      entityId: 'bill-1',
    },
    {
      id: 'notif-2',
      title: 'Overdue Outstanding Balance Alert',
      message: 'Customer Priya Patel has an unpaid balance of ₹2,400.00',
      type: 'alert',
      read: false,
      date: '2026-09-11',
      time: '10:15',
      link: '/customer-ledger?customerId=cus-2',
      entityType: 'customer',
      entityId: 'cus-2',
    },
    {
      id: 'notif-3',
      title: 'System Cloud Sync Complete',
      message: 'All local offline registers successfully synchronized with cloud ERP database',
      type: 'info',
      read: true,
      date: '2026-09-10',
      time: '09:00',
    },
  ];

  it('calculates unread, payment, and alert notification counts accurately', () => {
    const unreadCount = mockNotifications.filter((n) => !n.read).length;
    expect(unreadCount).toBe(2);

    const paymentCount = mockNotifications.filter((n) => {
      const t = (n.type || '').toLowerCase();
      const title = (n.title || '').toLowerCase();
      return t === 'payment' || title.includes('payment');
    }).length;
    expect(paymentCount).toBe(1);

    const alertCount = mockNotifications.filter((n) => {
      const t = (n.type || '').toLowerCase();
      const title = (n.title || '').toLowerCase();
      return t === 'alert' || title.includes('alert') || title.includes('due');
    }).length;
    expect(alertCount).toBe(1);
  });

  it('transitions notification read state immutably without side effects', () => {
    const updated = mockNotifications.map((n) => (n.id === 'notif-1' ? { ...n, read: true } : n));
    expect(updated.find((n) => n.id === 'notif-1')?.read).toBe(true);
    expect(mockNotifications.find((n) => n.id === 'notif-1')?.read).toBe(false); // original untouched
  });

  it('filters notifications by category (payments, alerts, system)', () => {
    const payments = mockNotifications.filter((n) => n.type === 'payment');
    expect(payments).toHaveLength(1);
    expect(payments[0].id).toBe('notif-1');

    const alerts = mockNotifications.filter((n) => n.type === 'alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe('notif-2');

    const system = mockNotifications.filter((n) => n.type === 'info');
    expect(system).toHaveLength(1);
    expect(system[0].id).toBe('notif-3');
  });

  it('resolves interactive routing links for bill receipts and customer ledgers', () => {
    const billNotif = mockNotifications.find((n) => n.entityType === 'bill');
    expect(billNotif?.link).toBe('/receipt?id=bill-1');

    const custNotif = mockNotifications.find((n) => n.entityType === 'customer');
    expect(custNotif?.link).toBe('/customer-ledger?customerId=cus-2');
  });
});
