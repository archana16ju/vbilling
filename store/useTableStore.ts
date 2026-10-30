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
  { id: 't9', name: 'T9', floor: 'Ground floor', capacity: 2, type: 'Standard', status: 'RUNNING' },
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
        set((state) => ({
          selectedTableId: table.id,
          selectedGuestCount: count,
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
        set((state) => ({
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
