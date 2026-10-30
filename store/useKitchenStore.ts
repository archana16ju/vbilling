import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type KotItem = {
  id: string;
  name: string;
  quantity: number;
  completed?: boolean;
  notes?: string;
};

export type KotTicket = {
  id: string; // e.g. "-001"
  kotNumber: number; // e.g. 1
  orderType: 'Dine In' | 'Takeaway' | 'Delivery' | string;
  tableOrStation?: string; // e.g. "Table 1", "Tawa", "Counter"
  tableId?: string | null;
  waiterId?: string | null;
  waiterName?: string | null;
  servingStatus?: 'Pending' | 'Ready' | 'Picked Up' | 'Served' | string;
  items: KotItem[];
  status: 'PREPARING' | 'READY' | 'CANCELLED';
  notes?: string;
  createdAt: number;
  readyAt?: number;
  cancelledAt?: number;
  cancelReason?: string;
  cancelNote?: string;
  createdBy?: string;
};

interface KitchenState {
  tickets: KotTicket[];
  kotCounter: number;
  addTicket: (params: {
    orderId?: string;
    orderType: string;
    tableOrStation?: string;
    tableId?: string | null;
    waiterId?: string | null;
    waiterName?: string | null;
    items: { name: string; quantity: number; notes?: string }[];
    notes?: string;
    createdBy?: string;
  }) => KotTicket;
  toggleItemCompleted: (ticketId: string, itemIndex: number) => void;
  markTicketReady: (ticketId: string) => void;
  updateTicketServingStatus: (ticketId: string, servingStatus: string) => void;
  updateTicketWaiter: (ticketId: string, waiterId: string | null, waiterName: string | null) => void;
  cancelTicket: (ticketId: string, reason: string, note?: string) => void;
  clearCompletedTickets: () => void;
}

export const useKitchenStore = create<KitchenState>()(
  persist(
    (set, get) => ({
      tickets: [],
      kotCounter: 1,

      addTicket: ({ orderId, orderType, tableOrStation, tableId, waiterId, waiterName, items, notes, createdBy }) => {
        const currentCounter = get().kotCounter;
        const ticketId = orderId || `MM-${String(currentCounter).padStart(3, '0')}`;

        const newTicket: KotTicket = {
          id: ticketId,
          kotNumber: currentCounter,
          orderType: orderType || 'Dine In',
          tableOrStation: tableOrStation || 'Kitchen',
          tableId: tableId || null,
          waiterId: waiterId || null,
          waiterName: waiterName || null,
          servingStatus: 'Pending',
          items: items.map((i, idx) => ({
            id: `${ticketId}-${idx}`,
            name: i.name,
            quantity: i.quantity,
            completed: false,
            notes: i.notes,
          })),
          status: 'PREPARING',
          notes: notes,
          createdAt: Date.now(),
          createdBy: createdBy || 'Staff',
        };

        set((state) => ({
          tickets: [newTicket, ...state.tickets],
          kotCounter: state.kotCounter + 1,
        }));

        return newTicket;
      },

      toggleItemCompleted: (ticketId, itemIndex) => {
        set((state) => ({
          tickets: state.tickets.map((t) => {
            if (t.id !== ticketId) return t;
            const updatedItems = [...t.items];
            if (updatedItems[itemIndex]) {
              updatedItems[itemIndex] = {
                ...updatedItems[itemIndex],
                completed: !updatedItems[itemIndex].completed,
              };
            }
            return { ...t, items: updatedItems };
          }),
        }));
      },

      markTicketReady: (ticketId) => {
        set((state) => ({
          tickets: state.tickets.map((t) => {
            if (t.id !== ticketId) return t;
            return {
              ...t,
              status: 'READY',
              servingStatus: 'Ready',
              readyAt: Date.now(),
              items: t.items.map((item) => ({ ...item, completed: true })),
            };
          }),
        }));

        // Notify backend API about kitchen status update
        try {
          fetch('/api/dine-in-orders', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'updateKitchenStatus',
              orderId: ticketId,
              kitchenStatus: 'READY',
            }),
          }).catch(() => {});
        } catch {}
      },

      updateTicketServingStatus: (ticketId, servingStatus) => {
        set((state) => ({
          tickets: state.tickets.map((t) =>
            t.id === ticketId ? { ...t, servingStatus } : t
          ),
        }));
      },

      updateTicketWaiter: (ticketId, waiterId, waiterName) => {
        set((state) => ({
          tickets: state.tickets.map((t) =>
            t.id === ticketId ? { ...t, waiterId, waiterName } : t
          ),
        }));
      },

      cancelTicket: (ticketId, reason, note) => {
        set((state) => ({
          tickets: state.tickets.map((t) => {
            if (t.id !== ticketId) return t;
            return {
              ...t,
              status: 'CANCELLED',
              cancelledAt: Date.now(),
              cancelReason: reason,
              cancelNote: note,
            };
          }),
        }));
      },

      clearCompletedTickets: () => {
        set((state) => ({
          tickets: state.tickets.filter((t) => t.status === 'PREPARING'),
        }));
      },
    }),
    {
      name: 'kitchen-storage',
    }
  )
);
