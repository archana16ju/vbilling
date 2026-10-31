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
  syncFromApiOrders: (apiOrders: any[]) => void;
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

        // Notify backend API about kitchen status update
        try {
          fetch('/api/dine-in-orders', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'updateKitchenStatus',
              orderId: ticketId,
              kitchenStatus: 'CANCELLED',
            }),
          }).catch(() => {});
        } catch {}
      },

      clearCompletedTickets: () => {
        set((state) => ({
          tickets: state.tickets.filter((t) => t.status === 'PREPARING'),
        }));
      },

      syncFromApiOrders: (apiOrders) => {
        if (!Array.isArray(apiOrders) || apiOrders.length === 0) return;

        set((state) => {
          const existingMap = new Map<string, KotTicket>();
          for (const t of state.tickets) {
            existingMap.set(t.id, t);
          }

          let maxKotNum = state.kotCounter;
          const updatedOrNewTickets: KotTicket[] = [...state.tickets];

          for (let i = 0; i < apiOrders.length; i++) {
            const o = apiOrders[i];
            const ticketId = o.kotId || o.orderNumber || o.id;
            if (!ticketId) continue;

            const numMatch = (o.orderNumber || o.kotId || ticketId).match(/\d+/);
            const kotNumber = numMatch ? parseInt(numMatch[0], 10) : i + 1;
            if (kotNumber >= maxKotNum) {
              maxKotNum = kotNumber + 1;
            }

            const rawItems = Array.isArray(o.items) ? o.items : [];
            const parsedItems: KotItem[] = rawItems.map((item: any, idx: number) => ({
              id: `${ticketId}-${idx}`,
              name: item.name || 'Item',
              quantity: Number(item.quantity) || 1,
              completed: o.kitchenStatus === 'READY',
              notes: item.notes || undefined,
            }));

            const existing = existingMap.get(ticketId);

            if (existing) {
              // Update status and details while preserving locally checked items
              const mergedItems = parsedItems.map((pi, idx) => {
                const exItem = existing.items[idx];
                return {
                  ...pi,
                  completed: exItem !== undefined ? exItem.completed : pi.completed,
                };
              });

              const idx = updatedOrNewTickets.findIndex((t) => t.id === ticketId);
              if (idx !== -1) {
                updatedOrNewTickets[idx] = {
                  ...existing,
                  status: (o.kitchenStatus as any) || existing.status,
                  servingStatus: o.servingStatus || existing.servingStatus,
                  tableOrStation: o.tableName || existing.tableOrStation,
                  waiterId: o.waiterId || existing.waiterId,
                  waiterName: o.waiterName || existing.waiterName,
                  items: mergedItems,
                };
              }
            } else {
              // Add new ticket from API
              const newTicket: KotTicket = {
                id: ticketId,
                kotNumber: kotNumber,
                orderType: 'Dine In',
                tableOrStation: o.tableName || 'Kitchen',
                tableId: o.tableId || null,
                waiterId: o.waiterId || null,
                waiterName: o.waiterName || null,
                servingStatus: o.servingStatus || 'Pending',
                items: parsedItems,
                status: (o.kitchenStatus as any) || 'PREPARING',
                notes: o.notes || undefined,
                createdAt: o.createdAt ? new Date(o.createdAt).getTime() : Date.now(),
                createdBy: o.createdBy || 'Cashier',
              };
              updatedOrNewTickets.push(newTicket);
              existingMap.set(ticketId, newTicket);
            }
          }

          // Sort: PREPARING first (newest to oldest), then others
          updatedOrNewTickets.sort((a, b) => {
            if (a.status === 'PREPARING' && b.status !== 'PREPARING') return -1;
            if (a.status !== 'PREPARING' && b.status === 'PREPARING') return 1;
            return b.createdAt - a.createdAt;
          });

          return {
            tickets: updatedOrNewTickets,
            kotCounter: Math.max(state.kotCounter, maxKotNum),
          };
        });
      },
    }),
    {
      name: 'kitchen-storage',
    }
  )
);
