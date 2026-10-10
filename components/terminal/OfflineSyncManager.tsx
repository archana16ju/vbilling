'use client'
import { useEffect, useRef } from "react"
import { useTerminalStore } from "@/store/useTerminalStore"

const withTimeout = <T,>(promise: Promise<T>, ms: number) => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms))
  ]);
};

export default function OfflineSyncManager() {
  const { offlineQueue, removeOfflineSale, markSaleCompleted, syncInterval } = useTerminalStore()
  const isSyncingRef = useRef(false)

  // Check SQLite directly to clear ghost bills from localStorage
  useEffect(() => {
    const cleanupGhostBills = async () => {
      try {
        const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron');
        const baseUrl = isElectron ? 'http://localhost:3015' : '';
        const res = await fetch(baseUrl + '/api/storage/pendingBills');
        if (res.ok) {
          const data = await res.json();
          const pendingIds = data.map((b: any) => b.id);
          
          const state = useTerminalStore.getState();
          for (const bill of state.offlineQueue) {
            // If the bill is in our localStorage but NO LONGER in SQLite pending bills,
            // it means it was successfully synced by the Live Website!
            if (!pendingIds.includes(bill.id)) {
              state.removeOfflineSale(bill.id);
            }
          }
        }
      } catch (e) {
        console.error("Failed to cleanup ghost bills", e);
      }
    };
    cleanupGhostBills();

    const initializeSequence = async () => {
      try {
        const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron');
        const baseUrl = isElectron ? 'http://localhost:3015' : '';
        const now = new Date();
        const todayStr = String(now.getDate()).padStart(2, '0') + String(now.getMonth() + 1).padStart(2, '0') + String(now.getFullYear()).slice(-2);
        const res = await fetch(`${baseUrl}/api/storage/sequence?date=${todayStr}`);
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data.count === 'number' && data.count > 0) {
            const state = useTerminalStore.getState();
            if (state.billSequence.date === todayStr) {
               if (data.count > state.billSequence.count) {
                 state.reconcileBillSequence(data.count);
               }
            } else {
               state.reconcileBillSequence(data.count);
            }
          }
        }
      } catch (e) {
        console.error("Failed to initialize sequence from sqlite", e);
      }
    };
    initializeSequence();
  }, []);

  useEffect(() => {
    let syncIntervalId: NodeJS.Timeout;

    const syncBills = async () => {
      const state = useTerminalStore.getState();
      if (!navigator.onLine || !state.isBackendOnline) return;
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      
      try {
        const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron');
        const syncUrl = isElectron ? 'http://localhost:3015/api/storage/sync' : '/api/storage/sync';
        const syncRes = await fetch(syncUrl, { method: 'POST' });
        if (syncRes.ok) {
          const result = await syncRes.json();
          if (result && result.success && result.syncedBillIds) {
            for (const id of result.syncedBillIds) {
              removeOfflineSale(id);
              markSaleCompleted(id);
            }
          }
        }

        const liveApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://skbriyani.vseyal.com';
        
        // Reconcile sequence
        try {
          const idRes = await fetch(`${liveApiUrl}/api/db/getNextBillId`);
          if (idRes.ok) {
             const data = await idRes.json();
             if (data && data.count !== undefined) {
               state.reconcileBillSequence(data.count);
               
               // Also backup to SQLite immediately
               const now = new Date();
               const todayStr = String(now.getDate()).padStart(2, '0') + String(now.getMonth() + 1).padStart(2, '0') + String(now.getFullYear()).slice(-2);
               fetch(`${isElectron ? 'http://localhost:3015' : ''}/api/storage/sequence`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ date: todayStr, count: data.count })
               }).catch(e => console.error("SQLite seq backup fail", e));
             }
          }
        } catch(e) {
          console.error('Failed to reconcile bill sequence', e);
        }

        // Also sync old localStorage-based offline bills to clear the old queue
        const oldBills = useTerminalStore.getState().offlineQueue;
        for (const sale of oldBills) {
          if (sale.syncStatus === 'COMPLETED') continue;
          try {
            const recordRes = await withTimeout(fetch(`${liveApiUrl}/api/db/recordSale`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...sale, syncStatus: 'COMPLETED' })
            }), 10000);
            const result = await recordRes.json();
            if (result && result.success) {
              removeOfflineSale(sale.id);
              markSaleCompleted(sale.id);
            } else {
               console.error("Sync failed for old bill", sale.id, result.error);
            }
          } catch (e) {
            console.error("Background sync failed for old localstorage bill", sale.id, e);
          }
        }
      } finally {
        isSyncingRef.current = false;
      }
    }

    // Print Jobs queue processor
    let printIntervalId: NodeJS.Timeout;
    const processPrintJobs = async () => {
      const state = useTerminalStore.getState();
      const pendingJobs = state.printJobs.filter(j => j.status === 'PENDING');
      
      if (pendingJobs.length === 0) return;
      
      for (const job of pendingJobs) {
        try {
          if (state.printerType === 'wifi' && state.wifiPrinter) {
            const res = await withTimeout(fetch('/api/printer/wifi', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ip: state.wifiPrinter.ip,
                port: state.wifiPrinter.port,
                rawText: job.rawText
              })
            }), 10000);
            
            const result = await res.json();
            if (result && result.success) {
              state.updatePrintJobStatus(job.id, 'PRINTED');
            } else {
              // Quietly keep as pending to retry later.
              // Optional debug: console.debug("WiFi Print failed", result.error);
            }
          } else if (state.printerType === 'bluetooth' && state.bluetoothPrinter) {
            // Web Bluetooth has strict rules; we can't easily background reconnect without a gesture,
            // but we can try. In a real app, you might use a local relay. For this mock, we mark it as FAILED if we can't.
            console.log("Bluetooth print queued (Mock)", job);
            alert(`Sending print job to Bluetooth Printer: ${state.bluetoothPrinter.name}`);
            state.updatePrintJobStatus(job.id, 'PRINTED');
          } else {
            // Not a supported background printer type
            state.updatePrintJobStatus(job.id, 'FAILED');
          }
        } catch (e) {
          console.error("Print Job failed:", e);
        }
      }
    };

    // Try immediately
    syncBills();
    processPrintJobs();

    // Then interval
    syncIntervalId = setInterval(syncBills, (syncInterval || 30) * 1000);
    printIntervalId = setInterval(processPrintJobs, 5000);

    return () => {
      clearInterval(syncIntervalId);
      clearInterval(printIntervalId);
    }
  }, [syncInterval, removeOfflineSale, markSaleCompleted])

  return null
}

