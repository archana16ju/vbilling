'use client';
import { useEffect } from 'react';
import { useTerminalStore } from '@/store/useTerminalStore';
import { getProducts, getCategories, seedDatabase } from '@/lib/actions/db';

export default function DataLoader() {
  const setProducts = useTerminalStore(state => state.setProducts);
  const setCategories = useTerminalStore(state => state.setCategories);

  useEffect(() => {
    // Only fetch once on mount to populate store
    async function loadData() {
      try {
        const [dbProducts, dbCategories] = await Promise.all([
          getProducts(),
          getCategories()
        ]);
        
        setProducts(dbProducts);
        setCategories(dbCategories);
      } catch (err) {
        console.error('Failed to load data from DB:', err);
      }
    }
    loadData();
  }, [setProducts, setCategories]);

  return null; // This component doesn't render anything
}
