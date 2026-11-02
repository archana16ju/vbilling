'use client';

import { useTerminalStore, Sale } from '@/store/useTerminalStore';
import { usePrinterDesignStore } from '@/store/usePrinterDesignStore';
import {
  calculateSubtotal,
  calculateDiscount,
  calculateTotalTax,
  calculateGlobalTotal,
  calculateTotalDiscount,
  calculateRoundOff,
} from '@/lib/calculations';
import CartItem from './CartItem';
import EnhancedCashModal from './EnhancedCashModal';
import TableSelectionModal from './TableSelectionModal';
import QuickCustomerModal from './QuickCustomerModal';
import DeliveryConfirmationModal, { DeliveryConfirmationData } from './DeliveryConfirmationModal';
import { useKitchenStore } from '@/store/useKitchenStore';
import { useTableStore } from '@/store/useTableStore';
import { useShortcutsStore } from '@/store/useShortcutsStore';
import { recordSale } from '@/lib/actions/db';
import {
  Trash2,
  CreditCard,
  Banknote,
  Wallet,
  PauseCircle,
  X,
  Receipt,
  ChefHat,
  UtensilsCrossed,
  FileText,
  User,
  Check,
  Percent,
  Plus,
  Send,
} from 'lucide-react';
import { useState, useEffect } from 'react';

export default function CartPanel() {
  const {
    cart,
    clearCart,
    completeSale,
    discountValue,
    isDiscountPercentage,
    setDiscount,
    heldCarts = [],
    holdCart,
    recallCart,
    deleteHeldCart,
    addOfflineSale,
    enableCashChange,
    generateNextBillId,
    isBackendOnline,
    enableDiscount,
    completedBillHtml,
    setCompletedBillHtml,
    rawMaterials,
    orderNote,
    setOrderNote,
    selectedCustomer,
    setSelectedCustomer,
    updateQuantity,
    removeFromCart,
  } = useTerminalStore();

  const shortcutsStore = useShortcutsStore();
  const showShortcutBadges = false;

  const [selectedCartItemId, setSelectedCartItemId] = useState<string | null>(null);

  const {
    orderType,
    setOrderType,
    tables,
    selectedTableId,
    selectedGuestCount,
    assignedWaiter,
    clearAssignedWaiter,
    releaseTable,
    occupyTable,
    isTableModalOpen,
    setIsTableModalOpen,
    selectTable,
  } = useTableStore();

  const selectedTable = tables.find((t) => t.id === selectedTableId) || null;
  const printerDesign = usePrinterDesignStore();

  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [tempDiscount, setTempDiscount] = useState('');
  const [tempIsPercentage, setTempIsPercentage] = useState(true);

  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'UPI' | 'Pay Later'>('Cash');
  const [mounted, setMounted] = useState(false);
  const [showHoldModal, setShowHoldModal] = useState(false);

  // Modals for Customer & Order Note
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [tempOrderNote, setTempOrderNote] = useState('');

  // Payment & status states
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [amountReceivedStr, setAmountReceivedStr] = useState('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // WhatsApp / Delivery Confirmation overlay state
  const [deliveryConfirmData, setDeliveryConfirmData] = useState<DeliveryConfirmationData | null>(null);
  const printerDesignForWA = usePrinterDesignStore();

  const cartSafe = Array.isArray(cart) ? cart : [];

  // Auto-select first cart item or keep valid selection
  useEffect(() => {
    if (cartSafe.length > 0) {
      if (!selectedCartItemId || !cartSafe.some((i) => i.product.id === selectedCartItemId)) {
        setSelectedCartItemId(cartSafe[0].product.id);
      }
    } else {
      setSelectedCartItemId(null);
    }
  }, [cartSafe, selectedCartItemId]);

  // Calculations
  const subtotal = calculateSubtotal(cartSafe);
  const itemDiscounts = calculateTotalDiscount(cartSafe);
  const globalDiscountAmount = calculateDiscount(subtotal, discountValue, isDiscountPercentage);
  const totalDiscountAmount = itemDiscounts + globalDiscountAmount;
  const totalTax = calculateTotalTax(cartSafe);
  const exactTotal = calculateGlobalTotal(subtotal, totalDiscountAmount, totalTax);
  const { roundOffAmount, grandTotal } = calculateRoundOff(
    exactTotal,
    printerDesign.showRoundOff,
    printerDesign.roundOffMethod,
    printerDesign.roundOffBelow,
    printerDesign.roundOffAbove
  );
  const total = grandTotal;


  // Open DeliveryConfirmationModal (WhatsApp send) after a paid bill is completed
  const openDeliveryConfirmation = (data: {
    billId: string;
    total: number;
    items: Array<{ name: string; quantity: number; price: number }>;
    customerName?: string;
    customerPhone?: string;
    paymentMethod?: string;
  }) => {
    setDeliveryConfirmData({
      billId: data.billId,
      status: 'unassigned',
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      total: data.total,
      paymentMethod: data.paymentMethod,
      items: data.items,
    });
  };

  // Checkout execution
  const handlePaymentSubmit = async (
    opts: {
      isCashModal?: boolean;
      finalAmount?: number;
      paymentMethodOverride?: string;
      isBillOnly?: boolean;
      keepTableOccupied?: boolean;
      isSendToKitchen?: boolean;
      preGeneratedBillId?: string;
    } = {}
  ) => {
    if (cartSafe.length === 0 || isProcessing) return;

    // Validate Raw Materials before checkout
    const CONVERSION_RATES: Record<string, number> = {
      'kg->g': 1000,
      'g->kg': 0.001,
      'liter->ml': 1000,
      'ml->liter': 0.001,
      'tsp->ml': 5,
      'ml->tsp': 0.2,
      'tbsp->ml': 15,
      'ml->tbsp': 1 / 15,
      'cup->ml': 240,
      'ml->cup': 1 / 240,
      'tbsp->tsp': 3,
      'tsp->tbsp': 1 / 3,
      'cup->tbsp': 16,
      'tbsp->cup': 1 / 16,
      'cup->tsp': 48,
      'tsp->cup': 1 / 48,
    };
    const insufficientItems: string[] = [];
    const requiredMaterials: Record<string, number> = {};

    for (const item of cartSafe) {
      if (item.product.rawMaterials && item.product.rawMaterials.length > 0) {
        for (const rm of item.product.rawMaterials) {
          const material = rawMaterials?.find((m) => m.id === rm.rawMaterialId);
          if (material) {
            const requiredInRecipeUnit = rm.quantity * item.quantity;
            let finalQty = requiredInRecipeUnit;
            if (rm.unit !== material.unit) {
              const rate = CONVERSION_RATES[`${rm.unit}->${material.unit}`];
              if (rate) finalQty = requiredInRecipeUnit * rate;
            }
            requiredMaterials[material.id] = (requiredMaterials[material.id] || 0) + finalQty;
          }
        }
      }
    }

    for (const [matId, requiredQty] of Object.entries(requiredMaterials)) {
      const material = rawMaterials?.find((m) => m.id === matId);
      if (material && material.currentStock < requiredQty) {
        insufficientItems.push(
          `${material.name} (Need: ${requiredQty.toFixed(2)} ${material.unit}, Have: ${material.currentStock.toFixed(2)} ${material.unit})`
        );
      }
    }

    if (insufficientItems.length > 0) {
      alert(`Cannot process checkout. Insufficient Raw Materials:\n\n${insufficientItems.join('\n')}`);
      return;
    }

    setIsProcessing(true);
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const isLocalMode = process.env.NEXT_PUBLIC_LOCAL_DB_MODE === 'mysql';

    const finalMethod =
      opts.paymentMethodOverride ||
      (opts.isBillOnly ? 'Bill Only' : opts.isCashModal ? 'Cash' : paymentMethod);
    const finalCashReceived = opts.isBillOnly
      ? 0
      : opts.finalAmount !== undefined
        ? opts.finalAmount
        : total;
    const finalChangeReturned =
      opts.isCashModal && !opts.isBillOnly && finalCashReceived >= total
        ? finalCashReceived - total
        : 0;

    const fullSaleData = {
      items: cartSafe,
      subtotal,
      discount: totalDiscountAmount,
      discountValue: discountValue,
      isDiscountPercentage,
      tax: totalTax,
      cgst: totalTax / 2,
      sgst: totalTax / 2,
      roundOff: roundOffAmount,
      total,
      paymentMethod: finalMethod,
      cashReceived: finalCashReceived,
      changeReturned: finalChangeReturned,
      tableId: selectedTable?.id || undefined,
      tableName: selectedTable ? `Table ${selectedTable.name}` : undefined,
      waiterId: (assignedWaiter?.id || selectedTable?.waiterId) || undefined,
      waiterName: (assignedWaiter?.name || selectedTable?.waiterName) || undefined,
      orderType: orderType || 'Dine In',
      orderNote: orderNote || undefined,
      customerName: selectedCustomer ? selectedCustomer.name : undefined,
      customerPhone: selectedCustomer ? selectedCustomer.phone : undefined,
      paymentStatus: opts.isBillOnly ? 'unpaid' : 'paid',
      servingStatus: opts.isSendToKitchen ? 'Pending' : (orderType === 'Dine In' ? 'Served' : 'Completed'),
    };

    try {
      const billId = opts.preGeneratedBillId || generateNextBillId();

      // Local MySQL direct persistence
      if (isLocalMode) {
        try {
          const res: any = await recordSale({
            ...fullSaleData,
            id: billId,
            timestamp: Date.now(),
          });
          if (res && res.success) {
            const saleDataToComplete = res.sale || { ...fullSaleData, id: billId, timestamp: Date.now() };
            const completedSale = { ...saleDataToComplete, syncStatus: 'COMPLETED' as const };
            completeSale(completedSale, billId);
            if (selectedTable) {
              if (opts.keepTableOccupied) {
                occupyTable(
                  selectedTable.id,
                  billId,
                  subtotal,
                  selectedGuestCount,
                  assignedWaiter?.id || selectedTable.waiterId,
                  assignedWaiter?.name || selectedTable.waiterName
                );
              } else {
                releaseTable(selectedTable.id);
                clearAssignedWaiter?.();
              }
            } else if (!opts.keepTableOccupied) {
              clearAssignedWaiter?.();
            }
            setShowCashModal(false);
            setAmountReceivedStr('');
            showActionNotification(
              opts.isSendToKitchen
                ? `Order sent to Kitchen & recorded in Sales (#${billId})!`
                : opts.isBillOnly
                  ? `Bill Only generated: #${billId}`
                  : `Sale completed: #${billId}`
            );
            // Show WhatsApp send modal for paid bills
            if (!opts.isBillOnly && !opts.isSendToKitchen) {
              const waItems = cartSafe.map((i) => ({
                name: i.product.name,
                quantity: i.quantity,
                price: i.product.price,
              }));
              openDeliveryConfirmation({
                billId,
                total,
                items: waItems,
                customerName: fullSaleData.customerName,
                customerPhone: fullSaleData.customerPhone,
                paymentMethod: finalMethod,
              });
            }
            return;
          }
        } catch (localErr) {
          console.warn('Direct local MySQL recordSale fallback to offline:', localErr);
        }
      }

      // Online API fallback
      let isOnlineFlowFailed = false;
      if (isOnline && isBackendOnline && !isLocalMode) {
        try {
          const liveApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://skbriyani.vseyal.com';
          const res = await fetch(`${liveApiUrl}/api/db/recordSale`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...fullSaleData, id: billId, timestamp: Date.now() }),
          });
          if (res.ok) {
            const result: any = await res.json();
            if (result && result.success) {
              const saleDataToComplete = result.sale || { ...fullSaleData, id: billId, timestamp: Date.now() };
              const completedSale = { ...saleDataToComplete, syncStatus: 'COMPLETED' as const };
              completeSale(completedSale, billId);
              if (selectedTable) {
                if (opts.keepTableOccupied) {
                  occupyTable(
                    selectedTable.id,
                    billId,
                    subtotal,
                    selectedGuestCount,
                    assignedWaiter?.id || selectedTable.waiterId,
                    assignedWaiter?.name || selectedTable.waiterName
                  );
                } else {
                  releaseTable(selectedTable.id);
                  clearAssignedWaiter?.();
                }
              } else if (!opts.keepTableOccupied) {
                clearAssignedWaiter?.();
              }
              setShowCashModal(false);
              setAmountReceivedStr('');
              showActionNotification(
                opts.isSendToKitchen
                  ? `Order sent to Kitchen & recorded in Sales (#${billId})!`
                  : opts.isBillOnly
                    ? `Bill Only generated: #${billId}`
                    : `Sale completed: #${billId}`
              );
              // Show WhatsApp send modal for paid bills
              if (!opts.isBillOnly && !opts.isSendToKitchen) {
                const waItems = cartSafe.map((i) => ({
                  name: i.product.name,
                  quantity: i.quantity,
                  price: i.product.price,
                }));
                openDeliveryConfirmation({
                  billId,
                  total,
                  items: waItems,
                  customerName: fullSaleData.customerName,
                  customerPhone: fullSaleData.customerPhone,
                  paymentMethod: finalMethod,
                });
              }
              return;
            }
          }
          isOnlineFlowFailed = true;
        } catch {
          isOnlineFlowFailed = true;
        }
      }

      // Offline storage path
      if (!isOnline || !isBackendOnline || isOnlineFlowFailed || isLocalMode) {
        const offlineSale = {
          ...fullSaleData,
          id: billId,
          timestamp: Date.now(),
          syncStatus: 'PENDING_SYNC' as const,
        };

        addOfflineSale(offlineSale as Sale);
        completeSale(offlineSale as Sale, billId);
        if (selectedTable) {
          if (opts.keepTableOccupied) {
            occupyTable(
              selectedTable.id,
              billId,
              subtotal,
              selectedGuestCount,
              assignedWaiter?.id || selectedTable.waiterId,
              assignedWaiter?.name || selectedTable.waiterName
            );
          } else {
            releaseTable(selectedTable.id);
            clearAssignedWaiter?.();
          }
        } else if (!opts.keepTableOccupied) {
          clearAssignedWaiter?.();
        }
        setShowCashModal(false);
        setAmountReceivedStr('');
        showActionNotification(
          opts.isSendToKitchen
            ? `Order sent to Kitchen & recorded in Sales (#${billId})!`
            : opts.isBillOnly
              ? `Bill Only saved: #${billId}`
              : `Sale completed: #${billId}`
        );
        // Show WhatsApp send modal for offline paid bills
        if (!opts.isBillOnly && !opts.isSendToKitchen) {
          const waItems = cartSafe.map((i) => ({
            name: i.product.name,
            quantity: i.quantity,
            price: i.product.price,
          }));
          openDeliveryConfirmation({
            billId,
            total,
            items: waItems,
            customerName: fullSaleData.customerName,
            customerPhone: fullSaleData.customerPhone,
            paymentMethod: finalMethod,
          });
        }
      }
    } catch (e) {
      console.error('Failure during checkout:', e);
      alert('Transaction failed! Please check logs.');
    } finally {
      setIsProcessing(false);
    }
  };

  const showActionNotification = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 3000);
  };

  const handleCheckout = () => {
    if (cartSafe.length === 0 || isProcessing) return;
    if (paymentMethod === 'Cash' && enableCashChange) {
      setShowCashModal(true);
      return;
    }
    handlePaymentSubmit();
  };

  const handleBillOnly = () => {
    if (cartSafe.length === 0 || isProcessing) return;
    handlePaymentSubmit({ isBillOnly: true, paymentMethodOverride: 'Bill Only' });
  };

  const handleSendToKitchen = async () => {
    if (cartSafe.length === 0 || isProcessing) return;

    const billId = generateNextBillId();
    const ticketItems = cartSafe.map((item) => ({
      name: item.product.name,
      quantity: item.quantity,
      price: item.product.price,
      notes: '',
    }));

    const effectiveWaiterId = assignedWaiter?.id || selectedTable?.waiterId || null;
    const effectiveWaiterName = assignedWaiter?.name || selectedTable?.waiterName || null;
    const tableName = selectedTable ? `Table ${selectedTable.name}` : 'Dine In';

    // 1. Create KOT ticket in kitchen store
    useKitchenStore.getState().addTicket({
      orderId: billId,
      orderType: orderType || 'Dine In',
      tableOrStation: tableName,
      tableId: selectedTable?.id,
      waiterId: effectiveWaiterId,
      waiterName: effectiveWaiterName,
      items: ticketItems,
      notes: orderNote || undefined,
    });

    // 2. Persist to backend database for Orders Collection & Waiter station
    fetch('/api/dine-in-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: billId,
        orderNumber: billId,
        kotId: billId,
        billId: billId,
        tableId: selectedTable?.id || null,
        tableName: tableName,
        waiterId: effectiveWaiterId,
        waiterName: effectiveWaiterName,
        guestCount: selectedGuestCount || 1,
        items: ticketItems,
        totalAmount: subtotal,
        kitchenStatus: 'PREPARING',
        servingStatus: 'Pending',
        notes: orderNote || null,
      }),
    }).catch((err) => console.error('Failed to save dine-in order:', err));

    // 3. Record as an unsettled bill in the Sales collection ('Bill Only') and keep table occupied
    await handlePaymentSubmit({
      isBillOnly: true,
      paymentMethodOverride: 'Bill Only',
      keepTableOccupied: true,
      isSendToKitchen: true,
      preGeneratedBillId: billId,
    });
  };

  const handleSendBillAndSettle = () => {
    if (cartSafe.length === 0 || isProcessing) return;
    handleSendToKitchen();
    handleCheckout();
  };

  const handleHoldBill = () => {
    if (cartSafe.length === 0) return;
    holdCart();
    showActionNotification('Bill placed on hold');
  };

  // Keyboard shortcut listener
  useEffect(() => {
    setMounted(true);

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      // Do NOT process cart/receipt shortcuts while typing in input fields
      if (isInput) return;

      // 1. Quantity Increase: '+' or '='
      if (shortcutsStore.isActionTriggered('cart_qty_increase', e)) {
        e.preventDefault();
        if (selectedCartItemId) {
          const item = cartSafe.find((i) => i.product.id === selectedCartItemId);
          if (item) {
            updateQuantity(item.product.id, (item.quantity || 1) + 1);
          }
        }
        return;
      }

      // 2. Quantity Decrease: '-'
      if (shortcutsStore.isActionTriggered('cart_qty_decrease', e)) {
        e.preventDefault();
        if (selectedCartItemId) {
          const item = cartSafe.find((i) => i.product.id === selectedCartItemId);
          if (item) {
            const newQty = (item.quantity || 1) - 1;
            if (newQty <= 0) {
              removeFromCart(item.product.id);
            } else {
              updateQuantity(item.product.id, newQty);
            }
          }
        }
        return;
      }

      // 3. Remove selected item: Delete
      if (shortcutsStore.isActionTriggered('cart_item_remove', e)) {
        e.preventDefault();
        if (selectedCartItemId) {
          removeFromCart(selectedCartItemId);
        }
        return;
      }

      // 4. Previous receipt line: Ctrl + ↑
      if (shortcutsStore.isActionTriggered('cart_prev_line', e)) {
        e.preventDefault();
        if (cartSafe.length > 0) {
          const idx = cartSafe.findIndex((i) => i.product.id === selectedCartItemId);
          const prevIdx = (idx - 1 + cartSafe.length) % cartSafe.length;
          setSelectedCartItemId(cartSafe[prevIdx].product.id);
        }
        return;
      }

      // 5. Next receipt line: Ctrl + ↓
      if (shortcutsStore.isActionTriggered('cart_next_line', e)) {
        e.preventDefault();
        if (cartSafe.length > 0) {
          const idx = cartSafe.findIndex((i) => i.product.id === selectedCartItemId);
          const nextIdx = (idx + 1) % cartSafe.length;
          setSelectedCartItemId(cartSafe[nextIdx].product.id);
        }
        return;
      }

      // 6. Send to Kitchen: F9
      if (shortcutsStore.isActionTriggered('cart_send_kitchen', e)) {
        e.preventDefault();
        handleSendToKitchen();
        return;
      }

      // 7. Bill Only: F10
      if (shortcutsStore.isActionTriggered('cart_bill_only', e)) {
        e.preventDefault();
        handleBillOnly();
        return;
      }

      // 8. Send, Bill and Settle: F11
      if (shortcutsStore.isActionTriggered('cart_send_bill_settle', e)) {
        e.preventDefault();
        handleSendBillAndSettle();
        return;
      }

      // 9. Bill and Settle: F12
      if (shortcutsStore.isActionTriggered('cart_bill_settle', e)) {
        e.preventDefault();
        handleCheckout();
        return;
      }

      // 10. Apply discount: Ctrl + D
      if (shortcutsStore.isActionTriggered('cart_apply_discount', e)) {
        e.preventDefault();
        setTempDiscount(discountValue.toString());
        setTempIsPercentage(isDiscountPercentage);
        setIsDiscountModalOpen(true);
        return;
      }

      // 11. Guest name and phone: Ctrl + G
      if (shortcutsStore.isActionTriggered('cart_guest_info', e)) {
        e.preventDefault();
        setIsCustomerModalOpen(true);
        return;
      }

      // 12. Add order note: Ctrl + N
      if (shortcutsStore.isActionTriggered('cart_order_note', e)) {
        e.preventDefault();
        setTempOrderNote(orderNote || '');
        setIsNoteModalOpen(true);
        return;
      }

      // 13. Change order type: Ctrl + T
      if (shortcutsStore.isActionTriggered('cart_order_type', e)) {
        e.preventDefault();
        const types = ['Dine In', 'Takeaway', 'Delivery'] as const;
        const curIdx = types.indexOf(orderType as any);
        const nextType = types[(curIdx + 1) % types.length];
        setOrderType(nextType);
        return;
      }

      // 14. Choose a table: Ctrl + M
      if (shortcutsStore.isActionTriggered('cart_choose_table', e)) {
        e.preventDefault();
        setIsTableModalOpen(true);
        return;
      }

      // 15. Hold this bill: Ctrl + H
      if (shortcutsStore.isActionTriggered('cart_hold_bill', e)) {
        e.preventDefault();
        handleHoldBill();
        return;
      }

      // 16. Recall held bill: Ctrl + Shift + H
      if (shortcutsStore.isActionTriggered('cart_recall_bill', e)) {
        e.preventDefault();
        setShowHoldModal(true);
        return;
      }

      // 17. Start a new order: Ctrl + Shift + N
      if (shortcutsStore.isActionTriggered('cart_new_order', e)) {
        e.preventDefault();
        clearCart();
        return;
      }

      // 18. Clear receipt: Ctrl + Delete
      if (shortcutsStore.isActionTriggered('cart_clear_receipt', e)) {
        e.preventDefault();
        clearCart();
        return;
      }

      // 19. Payment Methods: Alt + 1, Alt + 2, Alt + 3, Alt + 4
      if (shortcutsStore.isActionTriggered('pay_cash', e)) {
        e.preventDefault();
        setPaymentMethod('Cash');
        return;
      }
      if (shortcutsStore.isActionTriggered('pay_upi', e)) {
        e.preventDefault();
        setPaymentMethod('UPI');
        return;
      }
      if (shortcutsStore.isActionTriggered('pay_card', e)) {
        e.preventDefault();
        setPaymentMethod('Card');
        return;
      }
      if (shortcutsStore.isActionTriggered('pay_later', e)) {
        e.preventDefault();
        setPaymentMethod('Pay Later');
        return;
      }

      // 20. Exact amount / Complete Payment: Enter
      if (shortcutsStore.isActionTriggered('pay_complete', e)) {
        e.preventDefault();
        handleCheckout();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    cartSafe,
    selectedCartItemId,
    subtotal,
    discountValue,
    isDiscountPercentage,
    totalTax,
    paymentMethod,
    isProcessing,
    orderType,
    orderNote,
    shortcutsStore,
  ]);

  if (!mounted) return <div className="h-full bg-zinc-950 text-white" />;

  return (
    <div className="flex h-full w-full flex-col bg-zinc-950 text-white select-none">
      {/* Action Notification Toast */}
      {actionSuccessMsg && (
        <div className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 text-center animate-in fade-in duration-150 shadow-md">
          {actionSuccessMsg}
        </div>
      )}

      {/* Cart Top Header */}
      <div className="border-b border-zinc-800 p-4 bg-zinc-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <h2 className="text-base font-black text-white">Current Order</h2>
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-bold border"
              style={{
                backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                borderColor: 'var(--theme-active-border, rgba(219,39,119,0.3))',
                color: 'var(--theme-badge-text, #F472B6)',
              }}
            >
              {cartSafe.reduce((acc, i) => acc + i.quantity, 0)} items
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={clearCart}
              disabled={cartSafe.length === 0}
              className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs font-bold text-zinc-400 hover:text-rose-400 hover:border-rose-800 hover:bg-rose-950/30 transition disabled:opacity-40 cursor-pointer"
              title="Clear receipt"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-2">
        {cartSafe.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center text-zinc-500">
            <CreditCard className="mb-3 h-9 w-12 stroke-[1.2] opacity-30 text-zinc-400" />
            <p className="text-sm font-bold text-zinc-400">Cart is empty</p>
            <p className="text-xs text-zinc-600 mt-1 max-w-[200px]">
              Scan a barcode or search products to begin
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {cartSafe.map((item) => (
              <CartItem
                key={item.product.id}
                item={item}
                isSelected={selectedCartItemId === item.product.id}
                onSelect={() => setSelectedCartItemId(item.product.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quick Action Buttons: + Note and + Customer (as shown in reference image) */}
      <div className="border-t border-zinc-800/80 bg-zinc-950/70 p-3 pt-2.5 pb-2.5">
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => {
              setTempOrderNote(orderNote || '');
              setIsNoteModalOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/90 hover:bg-zinc-800 hover:border-zinc-700 py-2.5 px-3 text-xs font-bold text-zinc-300 hover:text-white transition cursor-pointer shadow-sm active:scale-98"
            title="Order Note"
          >
            <Plus className="h-3.5 w-3.5 text-zinc-400" />
            <span className="truncate max-w-[110px]">
              {orderNote ? `Note: ${orderNote}` : 'Note'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsCustomerModalOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/90 hover:bg-zinc-800 hover:border-zinc-700 py-2.5 px-3 text-xs font-bold text-zinc-300 hover:text-white transition cursor-pointer shadow-sm active:scale-98"
            title="Customer"
          >
            <Plus className="h-3.5 w-3.5 text-zinc-400" />
            <span className="truncate max-w-[110px]">
              {selectedCustomer ? selectedCustomer.name : 'Customer'}
            </span>
          </button>
        </div>
      </div>

      {/* Calculation & Checkout Footer */}
      <div className="border-t border-zinc-800 bg-zinc-900/80 p-3">
        {/* Totals Breakdown */}
        <div className="mb-2 space-y-0.5 text-xs">
          <div className="flex justify-between text-zinc-400">
            <span>Subtotal</span>
            <span className="font-mono font-bold text-zinc-200">₹{subtotal.toFixed(2)}</span>
          </div>

          <div
            className={`flex justify-between text-zinc-400 p-1 -mx-1 rounded cursor-pointer hover:bg-zinc-800/60 transition ${enableDiscount ? '' : 'opacity-70'
              }`}
            onClick={() => {
              if (!enableDiscount) return;
              setTempDiscount(discountValue.toString());
              setTempIsPercentage(isDiscountPercentage);
              setIsDiscountModalOpen(true);
            }}
            title="Click to edit discount"
          >
            <span className="flex items-center gap-1">
              <span>Discounts</span>
            </span>
            <span className="font-mono font-bold text-rose-400">
              -₹{totalDiscountAmount.toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between text-zinc-400">
            <span>Tax (CGST + SGST)</span>
            <span className="font-mono font-bold text-zinc-200">₹{totalTax.toFixed(2)}</span>
          </div>

          {printerDesign.showRoundOff && (
            <div className="flex justify-between text-zinc-400">
              <span>Round Off</span>
              <span className="font-mono font-bold text-zinc-200">
                {roundOffAmount >= 0 ? '+' : '-'}₹{Math.abs(roundOffAmount).toFixed(2)}
              </span>
            </div>
          )}

          <div className="my-1.5 border-t border-zinc-800 border-dashed" />


          <div className="flex items-baseline justify-between text-base font-black text-white">
            <span>Grand Total</span>
            <span
              className="text-base font-mono font-black"
              style={{ color: 'var(--theme-accent, #DB2777)' }}
            >
              ₹{total.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Payment Method Selector Tabs */}
        <div className="mb-2 grid grid-cols-3 gap-1.5">
          {/* Cash Tab */}
          <button
            type="button"
            onClick={() => setPaymentMethod('Cash')}
            className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 px-1.5 transition-all cursor-pointer ${paymentMethod === 'Cash'
              ? 'bg-theme-bar border-theme text-white shadow-lg shadow-theme-glow font-bold'
              : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white'
              }`}
          >
            <Banknote className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Cash</span>
          </button>

          {/* Card Tab */}
          <button
            type="button"
            onClick={() => setPaymentMethod('Card')}
            className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 transition-all cursor-pointer ${paymentMethod === 'Card'
              ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30 font-bold'
              : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white'
              }`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Card</span>
          </button>

          {/* UPI Tab */}
          <button
            type="button"
            onClick={() => setPaymentMethod('UPI')}
            className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 transition-all cursor-pointer ${paymentMethod === 'UPI'
              ? 'bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-600/30 font-bold'
              : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white'
              }`}
          >
            <Wallet className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">UPI</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="space-y-1.5">
          {/* Quick Hold & Bill Only Row */}
          <div className="grid grid-cols-2 gap-1">
            {/* Hold Button */}
            <button
              type="button"
              onClick={() => {
                if (cartSafe.length > 0) {
                  handleHoldBill();
                } else if (heldCarts && heldCarts.length > 0) {
                  setShowHoldModal(true);
                }
              }}
              disabled={cartSafe.length === 0 && (!heldCarts || heldCarts.length === 0)}
              className="relative flex items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 py-1.5 px-2 text-[11px] font-bold text-zinc-300 hover:bg-zinc-800 hover:text-white transition disabled:opacity-40 cursor-pointer"
              title="Hold Bill"
            >
              {heldCarts && heldCarts.length > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[5px] font-black text-white">
                  {heldCarts.length}
                </span>
              )}
              <PauseCircle className="h-3.5 w-3.5 text-orange-400" />
              <span>Hold</span>
            </button>

            {/* Bill Only Button */}
            <button
              type="button"
              onClick={handleBillOnly}
              disabled={cartSafe.length === 0 || isProcessing}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-800/60 bg-amber-950/40 py-2.5 px-3 text-xs font-bold text-amber-300 hover:bg-amber-900/60 transition disabled:opacity-40 cursor-pointer"
              title="Bill Only"
            >
              <Receipt className="h-2 w-3.5 text-amber-400" />
              <span>Bill Only</span>
            </button>
          </div>

          {/* Primary Checkout Button: Bill and Settle */}
          <button
            type="button"
            onClick={handleCheckout}
            disabled={cartSafe.length === 0 || isProcessing}
            className="w-full flex items-center justify-center gap-1 rounded-xl bg-theme-bar hover:opacity-95 active:scale-98 py-2 px-3 text-sm font-black text-white transition disabled:opacity-40 shadow-theme-glow border border-theme cursor-pointer"
            title="Bill and Settle"
          >
            <Check className="h-4 w-4" />
            <span>{isProcessing ? 'Processing...' : 'Bill and Settle'}</span>
          </button>

          {/* Send to Kitchen Button (Full Width) */}
          <button
            type="button"
            onClick={handleSendToKitchen}
            disabled={cartSafe.length === 0}
            className="w-full flex items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 active:scale-98 py-3 px-4 text-xs font-black text-white transition disabled:opacity-40 shadow-md shadow-amber-600/30 cursor-pointer"
            title="Send to Kitchen"
          >
            <ChefHat className="h-5 w-4 text-amber-200" />
            <span>Send to Kitchen</span>
          </button>
        </div>
      </div>

      {/* Discount Modal */}
      {isDiscountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-[400px] rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl text-white">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-black text-white">Apply Discount</h2>
              <button
                onClick={() => setIsDiscountModalOpen(false)}
                className="rounded-full p-1.5 hover:bg-zinc-800 text-zinc-500 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-5">
              <div className="mb-3 flex rounded-xl border border-zinc-800 bg-zinc-950 p-1">
                <button
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition cursor-pointer ${tempIsPercentage
                    ? 'bg-theme-bar border border-theme text-white shadow-lg shadow-theme-glow font-black'
                    : 'text-zinc-400 hover:text-white'
                    }`}
                  onClick={() => setTempIsPercentage(true)}
                >
                  Percentage (%)
                </button>
                <button
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition cursor-pointer ${!tempIsPercentage
                    ? 'bg-theme-bar border border-theme text-white shadow-lg shadow-theme-glow font-black'
                    : 'text-zinc-400 hover:text-white'
                    }`}
                  onClick={() => setTempIsPercentage(false)}
                >
                  Amount (₹)
                </button>
              </div>

              <div className="relative">
                <input
                  type="number"
                  value={tempDiscount}
                  onChange={(e) => setTempDiscount(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 pl-8 text-sm text-white outline-none focus:border-theme transition font-mono"
                  placeholder="0.00"
                  autoFocus
                />
                <span className="absolute left-3 top-3 text-zinc-400 text-xs font-mono">
                  {tempIsPercentage ? '%' : '₹'}
                </span>
              </div>
            </div>

            <div className="flex gap-1">
              <button
                onClick={() => {
                  setDiscount(0, true);
                  setIsDiscountModalOpen(false);
                }}
                className="flex-1 rounded-xl border border-rose-500/30 bg-rose-950/40 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-900/50 transition cursor-pointer"
              >
                Clear
              </button>
              <button
                onClick={() => {
                  setDiscount(parseFloat(tempDiscount) || 0, tempIsPercentage);
                  setIsDiscountModalOpen(false);
                }}
                className="flex-[2] rounded-xl bg-theme-bar border border-theme py-2.5 text-xs font-black text-white hover:opacity-95 shadow-theme-glow transition cursor-pointer"
              >
                Apply Discount
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Held Bills Modal */}
      {showHoldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-[500px] rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl text-white">
            <div className="mb-5 flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-base font-black text-white">
                Held Bills ({heldCarts.length})
              </h2>
              <button
                onClick={() => setShowHoldModal(false)}
                className="rounded-full p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {heldCarts.length === 0 ? (
              <div className="py-8 text-center text-zinc-500 text-xs">
                No bills currently on hold
              </div>
            ) : (
              <div className="max-h-[360px] overflow-y-auto space-y-2.5 no-scrollbar">
                {heldCarts.map((cart) => (
                  <div
                    key={cart.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/80 p-3.5 hover:border-zinc-700 transition"
                  >
                    <div>
                      <div className="font-bold text-sm text-zinc-100">{cart.id}</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        {cart.items.length} items •{' '}
                        {new Date(cart.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          recallCart(cart.id);
                          setShowHoldModal(false);
                        }}
                        className="rounded-lg bg-theme-bar border border-theme px-3.5 py-1.5 text-xs font-bold text-white hover:opacity-95 shadow-sm cursor-pointer"
                      >
                        Recall
                      </button>
                      <button
                        onClick={() => deleteHeldCart(cart.id)}
                        className="rounded-lg border border-rose-500/30 bg-rose-950/40 p-1.5 text-rose-400 hover:bg-rose-900/50 transition cursor-pointer"
                        title="Delete held bill"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Enhanced Cash Modal with keypad and shortcuts */}
      {showCashModal && (
        <EnhancedCashModal
          isOpen={showCashModal}
          onClose={() => {
            setShowCashModal(false);
            setAmountReceivedStr('');
            setIsProcessing(false);
          }}
          total={total}
          onCompleteSale={({ paymentMethod: m, amountReceived, isBillOnly }) => {
            handlePaymentSubmit({
              isCashModal: true,
              finalAmount: amountReceived,
              paymentMethodOverride: m,
              isBillOnly,
            });
          }}
          isProcessing={isProcessing}
        />
      )}

      {/* Table Selection Modal (Ctrl + M) */}
      <TableSelectionModal
        isOpen={isTableModalOpen}
        onClose={() => setIsTableModalOpen(false)}
        onSelectTable={(table, count) => {
          selectTable(table, count);
          setIsTableModalOpen(false);
        }}
        selectedTableId={selectedTableId}
      />

      {/* Quick Customer Modal (Ctrl + G) */}
      <QuickCustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        currentSelectedId={selectedCustomer?.id}
        onSelectCustomer={(cust) => {
          setSelectedCustomer(cust);
          setIsCustomerModalOpen(false);
        }}
      />

      {/* Order Note Modal (Ctrl + N) */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-white">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-1">
                <FileText className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-black text-white">Order Note</h3>
              </div>
              <button
                onClick={() => setIsNoteModalOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Kitchen / Preparation Instructions
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Less spicy, pack gravy separately..."
                value={tempOrderNote}
                onChange={(e) => setTempOrderNote(e.target.value)}
                autoFocus
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-xs text-white placeholder:text-zinc-500 focus:border-theme focus:outline-none transition resize-none font-sans"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-1 border-t border-zinc-800 pt-3">
              <button
                type="button"
                onClick={() => {
                  setOrderNote('');
                  setIsNoteModalOpen(false);
                }}
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrderNote(tempOrderNote.trim());
                  setIsNoteModalOpen(false);
                }}
                className="rounded-xl bg-theme-bar border border-theme px-5 py-2 text-xs font-bold transition active:scale-95 cursor-pointer text-white shadow-lg shadow-theme-glow"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sale Completed Receipt Fallback Modal */}
      {completedBillHtml && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-[420px] rounded-3xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl text-white">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <Check className="h-4 w-4" />
                </div>
                <h2 className="text-base font-black text-emerald-400">Sale Completed!</h2>
              </div>
              <button
                onClick={() => setCompletedBillHtml(null)}
                className="rounded-lg p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-6 text-xs text-zinc-400">
              The sale was recorded successfully and the receipt is ready for printing.
            </p>

            <div className="flex gap-1">
              <button
                onClick={() => setCompletedBillHtml(null)}
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
              >
                Done
              </button>
              <button
                onClick={() => {
                  const printWindow = window.open('', '_blank', 'width=340,height=700');
                  if (printWindow) {
                    printWindow.document.write(completedBillHtml);
                    printWindow.document.close();
                  } else {
                    alert('Please allow popups to print receipt manually.');
                  }
                  setCompletedBillHtml(null);
                }}
                className="flex-1 rounded-xl bg-theme-bar border border-theme py-2.5 text-xs font-black text-white shadow-theme-glow transition cursor-pointer active:scale-95"
              >
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Bill Send — uses existing DeliveryConfirmationModal */}
      <DeliveryConfirmationModal
        isOpen={!!deliveryConfirmData}
        onClose={() => setDeliveryConfirmData(null)}
        data={deliveryConfirmData}
        companyName={printerDesignForWA.companyName || 'Restaurant'}
      />
    </div>
  );
}
