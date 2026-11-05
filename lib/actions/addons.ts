'use server';

import { isLocalMySqlMode } from '@/lib/mysql';
import {
  mysqlGetAddonItems,
  mysqlCreateAddonItem,
  mysqlUpdateAddonItem,
  mysqlDeleteAddonItem,
  mysqlGetAddonGroups,
  mysqlCreateAddonGroup,
  mysqlUpdateAddonGroup,
  mysqlDeleteAddonGroup,
} from '@/lib/mysql-billing';
import { AddonItem, AddonGroup } from '@/types/addons';

// --- ADD-ON ITEMS ---

export async function getAddonItems(): Promise<AddonItem[]> {
  if (isLocalMySqlMode()) {
    return await mysqlGetAddonItems();
  }
  throw new Error('Add-ons collection is only supported in Local MySQL billing mode.');
}

export async function createAddonItem(data: Omit<AddonItem, 'id'>): Promise<AddonItem> {
  if (isLocalMySqlMode()) {
    return await mysqlCreateAddonItem(data);
  }
  throw new Error('Add-ons collection is only supported in Local MySQL billing mode.');
}

export async function updateAddonItem(id: string, updates: Partial<AddonItem>): Promise<boolean> {
  if (isLocalMySqlMode()) {
    return await mysqlUpdateAddonItem(id, updates);
  }
  throw new Error('Add-ons collection is only supported in Local MySQL billing mode.');
}

export async function deleteAddonItem(id: string): Promise<boolean> {
  if (isLocalMySqlMode()) {
    return await mysqlDeleteAddonItem(id);
  }
  throw new Error('Add-ons collection is only supported in Local MySQL billing mode.');
}

// --- ADD-ON GROUPS ---

export async function getAddonGroups(): Promise<AddonGroup[]> {
  if (isLocalMySqlMode()) {
    return await mysqlGetAddonGroups();
  }
  throw new Error('Add-ons collection is only supported in Local MySQL billing mode.');
}

export async function createAddonGroup(data: Omit<AddonGroup, 'id'>): Promise<AddonGroup> {
  if (isLocalMySqlMode()) {
    return await mysqlCreateAddonGroup(data);
  }
  throw new Error('Add-ons collection is only supported in Local MySQL billing mode.');
}

export async function updateAddonGroup(id: string, updates: Partial<AddonGroup>): Promise<boolean> {
  if (isLocalMySqlMode()) {
    return await mysqlUpdateAddonGroup(id, updates);
  }
  throw new Error('Add-ons collection is only supported in Local MySQL billing mode.');
}

export async function deleteAddonGroup(id: string): Promise<boolean> {
  if (isLocalMySqlMode()) {
    return await mysqlDeleteAddonGroup(id);
  }
  throw new Error('Add-ons collection is only supported in Local MySQL billing mode.');
}
