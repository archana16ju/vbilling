'use client';
import { useEffect } from 'react';
import { useTerminalStore } from '@/store/useTerminalStore';
import { getProducts, getCategories, seedDatabase } from '@/lib/actions/db';
import { getRawMaterials } from '@/lib/actions/inventory';

export default function DataLoader() {
  const setProducts = useTerminalStore(state => state.setProducts);
  const setCategories = useTerminalStore(state => state.setCategories);
  const setRawMaterials = useTerminalStore(state => state.setRawMaterials);

  useEffect(() => {
    // Only fetch once on mount to populate store
    async function loadData() {
      try {
        const [dbProducts, dbCategories, dbRawMaterials] = await Promise.all([
          getProducts().catch((e) => { console.warn('DataLoader getProducts notice:', e?.message || e); return []; }),
          getCategories().catch((e) => { console.warn('DataLoader getCategories notice:', e?.message || e); return []; }),
          getRawMaterials().catch((e) => { console.warn('DataLoader getRawMaterials notice:', e?.message || e); return []; })
        ]);
        
        if (dbProducts) setProducts(dbProducts);
        if (dbCategories) setCategories(dbCategories);
        if (dbRawMaterials) setRawMaterials(dbRawMaterials);
      } catch (err) {
        console.error('Failed to load data from DB:', err);
      }
    }
    loadData();
  }, [setProducts, setCategories, setRawMaterials]);

  return null; // This component doesn't render anything
}
