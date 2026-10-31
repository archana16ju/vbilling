import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TableStatus = 'FREE' | 'RUNNING' | 'BILL_PRINTED' | 'NEEDS_ATTENTION';

export type TableItem = {
  id: string;
  name: string; // e.g. "T1", "T2"
  floor: string; // e.g. "Ground floor", "First floor", "Terrace"
  capacity: number; // e.g. 2, 4, 6, 8
  type: string; // "Standard" | "AC" | "Booth" | "Outdoor" | "VIP"
  status: TableStatus;
  activeOrderId?: string;
  activeBillAmount?: number;
  guestCount?: number;
  waiterId?: string | null;
  waiterName?: string | null;
  servingStatus?: string;
  notes?: string;
  updatedAt?: number;
};

const DEFAULT_FLOORS = ['Ground floor', 'First floor', 'Terrace'];

const DEFAULT_TABLES: TableItem[] = [
  // Ground floor tables matching reference image
  { id: 't1', name: 'T1', floor: 'Ground floor', capacity: 2, type: 'Standard', status: 'FREE' },
  { id: 't2', name: 'T2', floor: 'Ground floor', capacity: 4, type: 'Standard', status: 'FREE' },
  { id: 't3', name: 'T3', floor: 'Ground floor', capacity: 4, type: 'Standard', status: 'FREE' },
  { id: 't4', name: 'T4', floor: 'Ground floor', capacity: 4, type: 'Standard', status: 'FREE' },
  { id: 't5', name: 'T5', floor: 'Ground floor', capacity: 2, type: 'Standard', status: 'FREE' },
  { id: 't6', name: 'T6', floor: 'Ground floor', capacity: 2, type: 'Standard', status: 'FREE' },
  { id: 't7', name: 'T7', floor: 'Ground floor', capacity: 6, type: 'Booth', status: 'FREE' },
  { id: 't8', name: 'T8', floor: 'Ground floor', capacity: 6, type: 'Booth', status: 'FREE' },
  { id: 't9', name: 'T9', floor: 'Ground floor', capacity: 2, type: 'Standard', status: 'FREE' },
  { id: 't10', name: 'T10', floor: 'Ground floor', capacity: 4, type: 'Standard', status: 'FREE' },
  { id: 't11', name: 'T11', floor: 'Ground floor', capacity: 4, type: 'AC', status: 'FREE' },
  { id: 't12', name: 'T12', floor: 'Ground floor', capacity: 8, type: 'VIP', status: 'FREE' },
  { id: 't13', name: 'T13', floor: 'Ground floor', capacity: 2, type: 'Standard', status: 'FREE' },
  { id: 't14', name: 'T14', floor: 'Ground floor', capacity: 2, type: 'Standard', status: 'FREE' },

  // First floor tables
  { id: 'f1', name: 'F1', floor: 'First floor', capacity: 2, type: 'AC', status: 'FREE' },
  { id: 'f2', name: 'F2', floor: 'First floor', capacity: 4, type: 'AC', status: 'FREE' },
  { id: 'f3', name: 'F3', floor: 'First floor', capacity: 4, type: 'AC', status: 'FREE' },
  { id: 'f4', name: 'F4', floor: 'First floor', capacity: 6, type: 'Booth', status: 'FREE' },
  { id: 'f5', name: 'F5', floor: 'First floor', capacity: 8, type: 'VIP', status: 'FREE' },

  // Terrace tables
  { id: 'r1', name: 'R1', floor: 'Terrace', capacity: 2, type: 'Outdoor', status: 'FREE' },
  { id: 'r2', name: 'R2', floor: 'Terrace', capacity: 4, type: 'Outdoor', status: 'FREE' },
  { id: 'r3', name: 'R3', floor: 'Terrace', capacity: 4, type: 'Outdoor', status: 'FREE' },
  { id: 'r4', name: 'R4', floor: 'Terrace', capacity: 6, type: 'Outdoor', status: 'FREE' },
];

interface TableState {
  tables: TableItem[];
  floors: string[];
  selectedTableId: string | null;
  selectedGuestCount: number;
  assignedWaiter: { id: string; name: string } | null;
  isTableModalOpen: boolean;
  isDeliveryModalOpen: boolean;
  orderType: 'Dine In' | 'Takeaway' | 'Delivery';
  deliveryInfo: {
    customerName: string;
    customerPhone: string;
    deliveryAddress: string;
    deliveryNotes?: string;
    platform?: 'Delivery' | 'Zomato' | 'Swiggy' | string;
    onlineOrderId?: string;
    deliveryPersonId?: string | null;
    deliveryPersonName?: string | null;
    deliveryPersonPhone?: string | null;
    companyId?: string | null;
  };

  setIsTableModalOpen: (open: boolean) => void;
  setIsDeliveryModalOpen: (open: boolean) => void;
  setAssignedWaiter: (waiter: { id: string; name: string } | null) => void;
  clearAssignedWaiter: () => void;
  setTableWaiter: (tableId: string, waiterId: string | null, waiterName: string | null) => void;
  setDeliveryInfo: (info: {
    customerName: string;
    customerPhone: string;
    deliveryAddress: string;
    deliveryNotes?: string;
    platform?: 'Delivery' | 'Zomato' | 'Swiggy' | string;
    onlineOrderId?: string;
    deliveryPersonId?: string | null;
    deliveryPersonName?: string | null;
    deliveryPersonPhone?: string | null;
    companyId?: string | null;
  }) => void;
  clearDeliveryInfo: () => void;
  setOrderType: (type: 'Dine In' | 'Takeaway' | 'Delivery') => void;
  selectTable: (table: TableItem, guestCount?: number) => void;
  clearSelectedTable: () => void;
  addTable: (table: Omit<TableItem, 'id'>) => TableItem;
  updateTable: (id: string, updates: Partial<TableItem>) => void;
  deleteTable: (id: string) => void;
  setTableStatus: (id: string, status: TableStatus) => void;
  addFloor: (floorName: string) => void;
  deleteFloor: (floorName: string) => void;
  setSelectedTableId: (id: string | null) => void;
  setSelectedGuestCount: (count: number) => void;
  occupyTable: (tableId: string, orderId?: string, amount?: number, guestCount?: number, waiterId?: string | null, waiterName?: string | null) => void;
  releaseTable: (tableId: string) => void;
  syncTablesFromOrders: (activeOrders: Array<{
    id: string;
    table_id?: string | null;
    tableId?: string | null;
    table_name?: string | null;
    tableName?: string | null;
    serving_status?: string | null;
    servingStatus?: string | null;
    guest_count?: number | null;
    guestCount?: number | null;
    waiter_id?: string | null;
    waiterId?: string | null;
    waiter_name?: string | null;
    waiterName?: string | null;
    total_amount?: number | null;
    totalAmount?: number | null;
  }>) => void;
  resetToDefaults: () => void;
}

export const useTableStore = create<TableState>()(
  persist(
    (set, get) => ({
      tables: DEFAULT_TABLES,
      floors: DEFAULT_FLOORS,
      selectedTableId: null,
      selectedGuestCount: 1,
      assignedWaiter: null,
      isTableModalOpen: false,
      isDeliveryModalOpen: false,
      orderType: 'Dine In',
      deliveryInfo: {
        customerName: '',
        customerPhone: '',
        deliveryAddress: '',
        deliveryNotes: '',
        platform: 'Delivery',
        onlineOrderId: '',
        deliveryPersonId: null,
        deliveryPersonName: null,
        deliveryPersonPhone: null,
        companyId: null,
      },

      setIsTableModalOpen: (open) => set({ isTableModalOpen: open }),
      setIsDeliveryModalOpen: (open) => set({ isDeliveryModalOpen: open }),
      setAssignedWaiter: (waiter) => set({ assignedWaiter: waiter }),
      clearAssignedWaiter: () => set({ assignedWaiter: null }),
      setTableWaiter: (tableId, waiterId, waiterName) => {
        set((state) => ({
          assignedWaiter:
            state.selectedTableId === tableId
              ? waiterId
                ? { id: waiterId, name: waiterName || '' }
                : null
              : state.assignedWaiter,
          tables: state.tables.map((t) =>
            t.id === tableId
              ? { ...t, waiterId, waiterName, updatedAt: Date.now() }
              : t
          ),
        }));
      },
      setDeliveryInfo: (info) => set({ deliveryInfo: { platform: 'Delivery', ...info } }),
      clearDeliveryInfo: () => set({
        deliveryInfo: {
          customerName: '',
          customerPhone: '',
          deliveryAddress: '',
          deliveryNotes: '',
          platform: 'Delivery',
          onlineOrderId: '',
          deliveryPersonId: null,
          deliveryPersonName: null,
          deliveryPersonPhone: null,
          companyId: null,
        },
      }),

      setOrderType: (type) => {
        set({ orderType: type });
        if (type === 'Dine In') {
          set({ isTableModalOpen: true });
        } else if (type === 'Delivery') {
          set({ isDeliveryModalOpen: true });
        }
      },

      selectTable: (table, guestCount) => {
        const count = guestCount || get().selectedGuestCount || 1;
        const currentTable = get().tables.find((t) => t.id === table.id) || table;
        const waiter = currentTable.waiterId
          ? { id: currentTable.waiterId, name: currentTable.waiterName || '' }
          : get().assignedWaiter;

        set((state) => ({
          selectedTableId: table.id,
          selectedGuestCount: count,
          assignedWaiter: waiter,
          isTableModalOpen: false,
          orderType: 'Dine In',
          tables: state.tables.map((t) =>
            t.id === table.id
              ? {
                  ...t,
                  status: 'RUNNING',
                  guestCount: count,
                  updatedAt: Date.now(),
                }
              : t
          ),
        }));
      },

      clearSelectedTable: () => {
        const currentSelectedId = get().selectedTableId;
        set((state) => ({
          selectedTableId: null,
          selectedGuestCount: 1,
          tables: currentSelectedId
            ? state.tables.map((t) =>
                t.id === currentSelectedId ? { ...t, status: 'FREE', guestCount: undefined } : t
              )
            : state.tables,
        }));
      },

      addTable: (data) => {
        const id = `tbl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const newTable: TableItem = {
          ...data,
          id,
          updatedAt: Date.now(),
        };

        // If the floor does not exist, add it
        const currentFloors = get().floors;
        const newFloors = currentFloors.includes(data.floor)
          ? currentFloors
          : [...currentFloors, data.floor];

        set((state) => ({
          tables: [...state.tables, newTable],
          floors: newFloors,
        }));

        return newTable;
      },

      updateTable: (id, updates) => {
        set((state) => ({
          tables: state.tables.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t
          ),
        }));
      },

      deleteTable: (id) => {
        set((state) => ({
          tables: state.tables.filter((t) => t.id !== id),
          selectedTableId: state.selectedTableId === id ? null : state.selectedTableId,
        }));
      },

      setTableStatus: (id, status) => {
        set((state) => ({
          tables: state.tables.map((t) =>
            t.id === id ? { ...t, status, updatedAt: Date.now() } : t
          ),
        }));
      },

      addFloor: (floorName) => {
        const trimmed = floorName.trim();
        if (!trimmed) return;
        set((state) => ({
          floors: state.floors.includes(trimmed) ? state.floors : [...state.floors, trimmed],
        }));
      },

      deleteFloor: (floorName) => {
        set((state) => ({
          floors: state.floors.filter((f) => f !== floorName),
          tables: state.tables.filter((t) => t.floor !== floorName),
        }));
      },

      setSelectedTableId: (id) => {
        set({ selectedTableId: id });
      },

      setSelectedGuestCount: (count) => {
        set({ selectedGuestCount: Math.max(1, count) });
      },

      occupyTable: (tableId, orderId, amount, guestCount, waiterId, waiterName) => {
        set((state) => ({
          tables: state.tables.map((t) =>
            t.id === tableId
              ? {
                  ...t,
                  status: 'RUNNING',
                  activeOrderId: orderId || t.activeOrderId,
                  activeBillAmount: amount !== undefined ? amount : t.activeBillAmount,
                  guestCount: guestCount || t.guestCount || 1,
                  waiterId: waiterId !== undefined ? waiterId : t.waiterId,
                  waiterName: waiterName !== undefined ? waiterName : t.waiterName,
                  updatedAt: Date.now(),
                }
              : t
          ),
        }));
      },

      releaseTable: (tableId) => {
        const currentTable = get().tables.find((t) => t.id === tableId);
        if (currentTable) {
          fetch('/api/dine-in-orders', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'releaseTable',
              tableId: currentTable.id,
              tableName: currentTable.name,
            }),
          }).catch(() => {});
        }

        set((state) => ({
          selectedTableId: state.selectedTableId === tableId ? null : state.selectedTableId,
          tables: state.tables.map((t) =>
            t.id === tableId
              ? {
                  ...t,
                  status: 'FREE',
                  activeOrderId: undefined,
                  activeBillAmount: undefined,
                  guestCount: undefined,
                  waiterId: undefined,
                  waiterName: undefined,
                  servingStatus: undefined,
                  updatedAt: Date.now(),
                }
              : t
          ),
        }));
      },

      syncTablesFromOrders: (activeOrders) => {
        const clean = (s?: string | null) => (s || '').toLowerCase().replace(/^(table\s*|tbl[-_]?)/, '').trim();

        set((state) => {
          const updatedTables = state.tables.map((table) => {
            const matchingOrder = activeOrders.find((ord) => {
              const ordTableId = ord.tableId || ord.table_id;
              const ordTableName = ord.tableName || ord.table_name;
              if (!ordTableId && !ordTableName) return false;

              const tableIdClean = clean(table.id);
              const tableNameClean = clean(table.name);
              const ordIdClean = clean(ordTableId);
              const ordNameClean = clean(ordTableName);

              return (
                table.id === ordTableId ||
                table.name === ordTableId ||
                table.name === ordTableName ||
                `Table ${table.name}` === ordTableName ||
                tableIdClean === ordIdClean ||
                tableNameClean === ordIdClean ||
                tableNameClean === ordNameClean ||
                tableIdClean === ordNameClean
              );
            });

            if (matchingOrder) {
              const serving = matchingOrder.servingStatus || matchingOrder.serving_status || 'Pending';
              const isBillPrinted = serving === 'Ready';
              const guestCount = Number(matchingOrder.guestCount || matchingOrder.guest_count) || table.guestCount || 1;
              const waiterId = matchingOrder.waiterId || matchingOrder.waiter_id || table.waiterId || null;
              const waiterName = matchingOrder.waiterName || matchingOrder.waiter_name || table.waiterName || null;
              const amount = Number(matchingOrder.totalAmount || matchingOrder.total_amount) || table.activeBillAmount;

              return {
                ...table,
                status: (isBillPrinted ? 'BILL_PRINTED' : 'RUNNING') as TableStatus,
                activeOrderId: matchingOrder.id,
                activeBillAmount: amount,
                guestCount,
                waiterId,
                waiterName,
                servingStatus: serving,
                updatedAt: Date.now(),
              };
            } else {
              // If table is currently active in terminal selection, keep it
              if (state.selectedTableId === table.id) {
                return table;
              }

              // If table was marked running from a previous order that is now finished, free it
              if (table.activeOrderId || table.status === 'RUNNING' || table.status === 'BILL_PRINTED') {
                return {
                  ...table,
                  status: 'FREE' as TableStatus,
                  activeOrderId: undefined,
                  activeBillAmount: undefined,
                  guestCount: undefined,
                  waiterId: undefined,
                  waiterName: undefined,
                  servingStatus: undefined,
                  updatedAt: Date.now(),
                };
              }

              return table;
            }
          });

          return { tables: updatedTables };
        });
      },

      resetToDefaults: () => {
        set({
          tables: DEFAULT_TABLES,
          floors: DEFAULT_FLOORS,
          selectedTableId: null,
          selectedGuestCount: 1,
        });
      },
    }),
    {
      name: 'tables-storage',
    }
  )
);
