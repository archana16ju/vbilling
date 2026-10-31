import { getSession } from '@/lib/auth-session';
import { getDineInOrders, DineInOrder } from '@/lib/actions/dine-in';
import AssignedOrdersClient from './AssignedOrdersClient';

export default async function AssignedOrdersPage() {
  const session = await getSession();
  const res = await getDineInOrders();
  const initialOrders: DineInOrder[] = res.success && Array.isArray(res.orders) ? res.orders : [];

  return (
    <AssignedOrdersClient
      initialOrders={initialOrders}
      initialSession={
        session
          ? {
              username: session.username,
              role: session.role,
              companyName: session.companyName,
            }
          : null
      }
    />
  );
}
