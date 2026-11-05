'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  Check,
  CheckCircle2,
  XCircle,
  Package,
  Layers2,
  FolderPlus,
  UtensilsCrossed,
  Filter,
  AlertCircle,
  Boxes,
} from 'lucide-react';
import {
  getAddonItems,
  createAddonItem,
  updateAddonItem,
  deleteAddonItem,
  getAddonGroups,
  createAddonGroup,
  updateAddonGroup,
  deleteAddonGroup,
} from '@/lib/actions/addons';
import { AddonItem, AddonGroup } from '@/types/addons';

export default function AddonsPage() {
  const [activeTab, setActiveTab] = useState<'items' | 'groups'>('items');
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AddonItem[]>([]);
  const [groups, setGroups] = useState<AddonGroup[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Item Form Modal state
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AddonItem | null>(null);
  const [isItemSubmitting, setIsItemSubmitting] = useState(false);

  // Group Form Modal state
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AddonGroup | null>(null);
  const [selectedItemIdsForGroup, setSelectedItemIdsForGroup] = useState<string[]>([]);
  const [isGroupSubmitting, setIsGroupSubmitting] = useState(false);

  // Load data from Local MySQL
  const fetchData = async () => {
    setLoading(true);
    try {
      const [fetchedItems, fetchedGroups] = await Promise.all([
        getAddonItems(),
        getAddonGroups(),
      ]);
      setItems(fetchedItems || []);
      setGroups(fetchedGroups || []);
    } catch (err) {
      console.error('Failed to load addons data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Distinct categories from items
  const categoriesList = useMemo(() => {
    const cats = new Set<string>();
    items.forEach((it) => {
      if (it.category && it.category.trim()) cats.add(it.category.trim());
    });
    return Array.from(cats);
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        it.name.toLowerCase().includes(q) ||
        (it.category && it.category.toLowerCase().includes(q));

      const matchesCategory =
        filterCategory === 'all' || it.category === filterCategory;

      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'active' && it.isActive) ||
        (filterStatus === 'inactive' && !it.isActive);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [items, searchQuery, filterCategory, filterStatus]);

  // Filtered groups
  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || g.name.toLowerCase().includes(q);
      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'active' && g.isActive) ||
        (filterStatus === 'inactive' && !g.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [groups, searchQuery, filterStatus]);

  // Map of which groups contain a given item ID
  const itemGroupUsageMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const g of groups) {
      const itemIds = g.itemIds || g.items?.map((i) => i.id) || [];
      for (const id of itemIds) {
        if (!map.has(id)) map.set(id, []);
        map.get(id)!.push(g.name);
      }
    }
    return map;
  }, [groups]);

  // --- ITEM HANDLERS ---
  const handleOpenItemModal = (item?: AddonItem) => {
    if (item) {
      setEditingItem(item);
    } else {
      setEditingItem(null);
    }
    setIsItemModalOpen(true);
  };

  const handleCloseItemModal = () => {
    setIsItemModalOpen(false);
    setEditingItem(null);
  };

  const handleItemSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsItemSubmitting(true);
    const formData = new FormData(e.currentTarget);

    let imageUrl = editingItem?.image || '';
    const file = formData.get('imageFile') as File;
    if (file && file.size > 0) {
      const uploadData = new FormData();
      uploadData.append('file', file);
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: uploadData,
        });
        const data = await res.json();
        if (data.url) {
          imageUrl = data.url;
        }
      } catch (err) {
        console.error('Failed to upload image:', err);
      }
    }

    const name = (formData.get('name') as string)?.trim();
    const price = Number(formData.get('price')) || 0;
    const category = (formData.get('category') as string)?.trim() || null;
    const tax = Number(formData.get('tax')) || 0;
    const trackStock = formData.get('trackStock') === 'on';
    const stock = trackStock ? Number(formData.get('stock')) || 0 : 0;
    const isActive = formData.get('isActive') === 'on';

    try {
      if (editingItem) {
        const updates: Partial<AddonItem> = {
          name,
          price,
          category,
          tax,
          trackStock,
          stock,
          isActive,
          image: imageUrl || null,
        };
        await updateAddonItem(editingItem.id, updates);
        setItems((prev) =>
          prev.map((i) => (i.id === editingItem.id ? { ...i, ...updates } : i))
        );
      } else {
        const payload = {
          name,
          price,
          category,
          tax,
          trackStock,
          stock,
          isActive,
          image: imageUrl || null,
        };
        const created = await createAddonItem(payload);
        setItems((prev) => [...prev, created]);
      }
      handleCloseItemModal();
    } catch (err) {
      console.error('Failed to save add-on item:', err);
      alert('Error saving add-on item. Please check inputs.');
    } finally {
      setIsItemSubmitting(false);
    }
  };

  const handleDeleteItem = async (item: AddonItem) => {
    const usage = itemGroupUsageMap.get(item.id) || [];
    let msg = `Are you sure you want to delete "${item.name}"?`;
    if (usage.length > 0) {
      msg += `\nNote: This add-on is currently used in ${usage.length} group(s): ${usage.join(', ')}.`;
    }
    if (!confirm(msg)) return;

    try {
      await deleteAddonItem(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      // Refresh groups as well since junction items were deleted
      fetchData();
    } catch (err) {
      console.error('Failed to delete add-on item:', err);
      alert('Failed to delete item.');
    }
  };

  // --- GROUP HANDLERS ---
  const handleOpenGroupModal = (group?: AddonGroup) => {
    if (group) {
      setEditingGroup(group);
      setSelectedItemIdsForGroup(
        group.itemIds || group.items?.map((i) => i.id) || []
      );
    } else {
      setEditingGroup(null);
      setSelectedItemIdsForGroup([]);
    }
    setIsGroupModalOpen(true);
  };

  const handleCloseGroupModal = () => {
    setIsGroupModalOpen(false);
    setEditingGroup(null);
    setSelectedItemIdsForGroup([]);
  };

  const toggleItemInGroup = (itemId: string) => {
    setSelectedItemIdsForGroup((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleGroupSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsGroupSubmitting(true);
    const formData = new FormData(e.currentTarget);

    const name = (formData.get('name') as string)?.trim();
    const selectionType = (formData.get('selectionType') as 'single' | 'multiple') || 'multiple';
    const isRequired = formData.get('isRequired') === 'on';
    const minSelection = Number(formData.get('minSelection')) || 0;
    const maxSelection = Math.max(1, Number(formData.get('maxSelection')) || 1);
    const isActive = formData.get('isActive') === 'on';

    try {
      if (editingGroup) {
        const updates: Partial<AddonGroup> = {
          name,
          selectionType,
          isRequired,
          minSelection,
          maxSelection,
          isActive,
          itemIds: selectedItemIdsForGroup,
        };
        await updateAddonGroup(editingGroup.id, updates);
      } else {
        const payload = {
          name,
          selectionType,
          isRequired,
          minSelection,
          maxSelection,
          isActive,
          itemIds: selectedItemIdsForGroup,
        };
        await createAddonGroup(payload);
      }
      handleCloseGroupModal();
      await fetchData();
    } catch (err) {
      console.error('Failed to save add-on group:', err);
      alert('Error saving add-on group.');
    } finally {
      setIsGroupSubmitting(false);
    }
  };

  const handleDeleteGroup = async (group: AddonGroup) => {
    if (!confirm(`Delete add-on group "${group.name}"?\n(Add-on items will remain safe and not be deleted.)`)) {
      return;
    }
    try {
      await deleteAddonGroup(group.id);
      setGroups((prev) => prev.filter((g) => g.id !== group.id));
    } catch (err) {
      console.error('Failed to delete group:', err);
      alert('Failed to delete group.');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Dynamic Header with Theme Bar Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-theme-bar p-6 shadow-xl border border-theme text-white">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Layers className="h-6 w-6 text-pink-300" />
              Add-ons & Modifiers
            </h1>
            <p className="text-xs text-pink-100/70 mt-1">
              Manage add-on items, create reusable add-on groups, and set selection rules.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl border border-pink-400/30 bg-black/40 px-3.5 py-2 text-xs font-bold text-pink-200 hover:bg-black/60 hover:text-white transition shadow-sm cursor-pointer disabled:opacity-50"
              title="Refresh Add-ons"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => handleOpenItemModal()}
              className="flex items-center gap-1.5 rounded-xl bg-white text-zinc-950 px-3.5 py-2 text-xs font-black uppercase tracking-wider shadow-lg hover:bg-pink-100 active:scale-95 transition cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[3]" /> Add-on Item
            </button>
            <button
              onClick={() => handleOpenGroupModal()}
              className="flex items-center gap-1.5 rounded-xl btn-theme-primary px-3.5 py-2 text-xs font-black uppercase tracking-wider shadow-lg hover:brightness-110 active:scale-95 transition cursor-pointer"
            >
              <FolderPlus className="h-4 w-4" /> Add-on Group
            </button>
          </div>
        </div>
      </div>

      {/* 2. Collection Sub-navigation & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        {/* Tab switchers: Add-on Items vs Add-on Groups */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
          <button
            onClick={() => setActiveTab('items')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'items'
                ? 'bg-theme-bar text-white shadow-theme-glow border border-theme'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <UtensilsCrossed className="h-3.5 w-3.5" />
            <span>Add-on Items</span>
            <span className="ml-1 rounded-full bg-black/40 px-1.5 py-0.2 text-[10px] font-mono">
              {items.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'groups'
                ? 'bg-theme-bar text-white shadow-theme-glow border border-theme'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Layers2 className="h-3.5 w-3.5" />
            <span>Add-on Groups</span>
            <span className="ml-1 rounded-full bg-black/40 px-1.5 py-0.2 text-[10px] font-mono">
              {groups.length}
            </span>
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="relative min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'items' ? 'Search items...' : 'Search groups...'}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-theme focus:outline-none"
            />
          </div>

          {/* Category filter (Items tab only) */}
          {activeTab === 'items' && categoriesList.length > 0 && (
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-white focus:border-theme focus:outline-none"
            >
              <option value="all">All Categories</option>
              {categoriesList.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-white focus:border-theme focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* 3. Main Content: Add-on Items Tab */}
      {activeTab === 'items' && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-lg overflow-hidden">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-zinc-950/80 text-xs uppercase text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4 font-bold">Add-on Item</th>
                <th className="px-6 py-4 font-bold">Category</th>
                <th className="px-6 py-4 font-bold">Price</th>
                <th className="px-6 py-4 font-bold">Tax</th>
                <th className="px-6 py-4 font-bold">Stock</th>
                <th className="px-6 py-4 font-bold">Used In Groups</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-zinc-400">
                    <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-theme border-t-transparent" />
                    Loading add-on items...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-zinc-500">
                    <Package className="mx-auto mb-2 h-8 w-8 text-zinc-600" />
                    No add-on items found. Click "+ Add-on Item" to create one.
                  </td>
                </tr>
              ) : (
                filteredItems.map((it) => {
                  const usedGroups = itemGroupUsageMap.get(it.id) || [];
                  return (
                    <tr key={it.id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="px-6 py-4 font-bold text-white">
                        <div className="flex items-center gap-3">
                          {it.image ? (
                            <img
                              src={it.image}
                              alt=""
                              className="h-9 w-9 rounded-xl object-cover border border-zinc-700"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs text-zinc-400 font-bold">
                              {it.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-white">{it.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        {it.category ? (
                          <span className="rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-0.5 text-zinc-300">
                            {it.category}
                          </span>
                        ) : (
                          <span className="text-zinc-600 italic">None</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono font-black text-theme-accent">
                        ₹{Number(it.price || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-zinc-400">
                        {Number(it.tax || 0)}%
                      </td>
                      <td className="px-6 py-4 text-xs">
                        {it.trackStock ? (
                          <span
                            className={`rounded-full px-2 py-0.5 font-bold border ${
                              it.stock > 0
                                ? 'bg-emerald-950/60 border-emerald-600/40 text-emerald-400'
                                : 'bg-rose-950/60 border-rose-600/40 text-rose-400'
                            }`}
                          >
                            {it.stock} in stock
                          </span>
                        ) : (
                          <span className="text-zinc-500">Not tracked</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        {usedGroups.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {usedGroups.map((gName, idx) => (
                              <span
                                key={idx}
                                className="rounded-md bg-purple-950/60 border border-purple-800/40 px-2 py-0.5 text-[11px] text-purple-300 font-medium"
                              >
                                {gName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-zinc-500 italic text-[11px]">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                            it.isActive
                              ? 'bg-emerald-950/60 border-emerald-600/40 text-emerald-400'
                              : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              it.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
                            }`}
                          />
                          {it.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleOpenItemModal(it)}
                          className="mr-3 text-zinc-400 hover:text-white transition cursor-pointer"
                          title="Edit Add-on Item"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(it)}
                          className="text-zinc-500 hover:text-rose-400 transition cursor-pointer"
                          title="Delete Add-on Item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. Main Content: Add-on Groups Tab */}
      {activeTab === 'groups' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full p-8 text-center text-zinc-400">
              <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-theme border-t-transparent" />
              Loading add-on groups...
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-zinc-800 bg-zinc-900/60 p-12 text-center text-zinc-500">
              <Layers2 className="mx-auto mb-2 h-8 w-8 text-zinc-600" />
              No add-on groups found. Click "+ Add-on Group" to create one.
            </div>
          ) : (
            filteredGroups.map((g) => {
              const assignedItems = g.items || items.filter((it) => (g.itemIds || []).includes(it.id));
              return (
                <div
                  key={g.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-lg flex flex-col justify-between hover:border-zinc-700 transition"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-white text-base flex items-center gap-1.5">
                          <span>{g.name}</span>
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold border uppercase tracking-wider ${
                              g.isRequired
                                ? 'bg-amber-950/60 border-amber-600/40 text-amber-300'
                                : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                            }`}
                          >
                            {g.isRequired ? 'Required' : 'Optional'}
                          </span>
                          <span className="rounded-md bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-[10px] font-bold text-zinc-300">
                            {g.selectionType === 'single' ? 'Single Choice' : 'Multi-Select'}
                          </span>
                          <span className="rounded-md bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-[10px] font-mono text-zinc-400">
                            Min: {g.minSelection} / Max: {g.maxSelection}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          g.isActive ? 'bg-emerald-400 ring-2 ring-emerald-500/20' : 'bg-zinc-600'
                        }`}
                        title={g.isActive ? 'Active' : 'Inactive'}
                      />
                    </div>

                    {/* Assigned Add-on Items Preview */}
                    <div className="mt-4 pt-3 border-t border-zinc-800/80">
                      <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span>Assigned Add-on Items</span>
                        <span className="font-mono text-theme-accent">{assignedItems.length} items</span>
                      </div>
                      {assignedItems.length === 0 ? (
                        <p className="text-xs text-zinc-500 italic">No add-ons assigned to this group yet.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto no-scrollbar">
                          {assignedItems.map((ai) => (
                            <span
                              key={ai.id}
                              className="inline-flex items-center gap-1 rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1 text-xs text-zinc-200"
                            >
                              <span>{ai.name}</span>
                              <span className="font-mono text-[11px] text-theme-accent">
                                ₹{Number(ai.price || 0).toFixed(0)}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-5 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {g.isActive ? 'Active in menu' : 'Disabled'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenGroupModal(g)}
                        className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer flex items-center gap-1"
                      >
                        <Edit2 className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(g)}
                        className="rounded-xl border border-rose-900/40 bg-rose-950/40 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-900/60 transition cursor-pointer"
                        title="Delete Group"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* =========================================================================
          5. MODAL: Add / Edit Add-on Item
          ========================================================================= */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg overflow-y-auto rounded-3xl bg-zinc-900 p-6 shadow-2xl border border-zinc-800 text-white animate-in zoom-in-95 duration-200 no-scrollbar max-h-[90vh]">
            <h2 className="mb-4 text-xl font-bold text-white flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5 text-theme-accent" />
              {editingItem ? 'Edit Add-on Item' : 'New Add-on Item'}
            </h2>

            <form onSubmit={handleItemSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300">
                  Add-on Name <span className="text-rose-400">*</span>
                </label>
                <input
                  required
                  name="name"
                  defaultValue={editingItem?.name}
                  placeholder="e.g. Sambar, Idli Podi, Extra Cheese"
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-white placeholder-zinc-500 focus:border-theme focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-300">
                    Price (₹) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    name="price"
                    defaultValue={editingItem?.price ?? 20}
                    className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-white placeholder-zinc-500 focus:border-theme focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300">Tax (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="tax"
                    defaultValue={editingItem?.tax ?? 5}
                    className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-white placeholder-zinc-500 focus:border-theme focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300">Category</label>
                <input
                  name="category"
                  defaultValue={editingItem?.category || ''}
                  placeholder="e.g. Chutneys, Accompaniment, Extras"
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-white placeholder-zinc-500 focus:border-theme focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300">Image</label>
                <input
                  type="file"
                  accept="image/*"
                  name="imageFile"
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-1.5 text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
                />
                {editingItem?.image && (
                  <p className="mt-1 text-[11px] text-zinc-500">Leave blank to retain current image</p>
                )}
              </div>

              {/* Stock Tracking Toggle */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="trackStock"
                    defaultChecked={editingItem?.trackStock ?? false}
                    className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-theme-accent focus:ring-0"
                  />
                  <span className="text-xs font-bold text-zinc-200">Enable Stock Tracking</span>
                </label>
                <p className="text-[11px] text-zinc-400 leading-tight">
                  When enabled, stock will be automatically deducted whenever this add-on is ordered in Terminal or online orders.
                </p>
                <div>
                  <label className="block text-xs font-bold text-zinc-300">Current Stock Quantity</label>
                  <input
                    type="number"
                    step="0.01"
                    name="stock"
                    defaultValue={editingItem?.stock ?? 100}
                    className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 p-2 text-xs text-white focus:border-theme focus:outline-none"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={editingItem?.isActive ?? true}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-theme-accent focus:ring-0"
                />
                <span className="text-xs font-bold text-zinc-200">Active (Available for orders)</span>
              </label>

              <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={handleCloseItemModal}
                  disabled={isItemSubmitting}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isItemSubmitting}
                  className="rounded-xl btn-theme-primary px-5 py-2 text-xs text-white shadow-lg disabled:opacity-50 font-bold cursor-pointer"
                >
                  {isItemSubmitting ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Add-on'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          6. MODAL: Add / Edit Add-on Group
          ========================================================================= */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-2xl overflow-y-auto rounded-3xl bg-zinc-900 p-6 shadow-2xl border border-zinc-800 text-white animate-in zoom-in-95 duration-200 no-scrollbar max-h-[90vh]">
            <h2 className="mb-4 text-xl font-bold text-white flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-theme-accent" />
              {editingGroup ? 'Edit Add-on Group' : 'New Add-on Group'}
            </h2>

            <form onSubmit={handleGroupSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300">
                  Group Name <span className="text-rose-400">*</span>
                </label>
                <input
                  required
                  name="name"
                  defaultValue={editingGroup?.name}
                  placeholder="e.g. Idli Extras, Dosa Extras, Biriyani Extras"
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-white placeholder-zinc-500 focus:border-theme focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-300">Selection Type</label>
                  <select
                    name="selectionType"
                    defaultValue={editingGroup?.selectionType || 'multiple'}
                    className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-white focus:border-theme focus:outline-none"
                  >
                    <option value="multiple">Multiple (Checkboxes)</option>
                    <option value="single">Single Choice (Radio)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300">Min Selection</label>
                  <input
                    type="number"
                    name="minSelection"
                    defaultValue={editingGroup?.minSelection ?? 0}
                    min={0}
                    className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-white focus:border-theme focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300">Max Selection</label>
                  <input
                    type="number"
                    name="maxSelection"
                    defaultValue={editingGroup?.maxSelection ?? 4}
                    min={1}
                    className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-white focus:border-theme focus:outline-none"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      name="isRequired"
                      defaultChecked={editingGroup?.isRequired ?? false}
                      className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-theme-accent focus:ring-0"
                    />
                    <span className="text-xs font-bold text-amber-300">Required Selection</span>
                  </label>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={editingGroup?.isActive ?? true}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-theme-accent focus:ring-0"
                />
                <span className="text-xs font-bold text-zinc-200">Group Active</span>
              </label>

              {/* Assign Add-on Items (Reusing existing items without duplication) */}
              <div className="mt-4 pt-4 border-t border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-white uppercase tracking-wider">
                    Select Add-on Items in this Group
                  </label>
                  <span className="text-xs font-mono text-theme-accent">
                    {selectedItemIdsForGroup.length} selected
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mb-3">
                  Check the add-ons to include in this group. You can safely reuse the same add-on items across multiple groups without duplicating items.
                </p>

                {items.length === 0 ? (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-center text-xs text-zinc-500">
                    No add-on items exist yet. Create items first in the "Add-on Items" tab.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1 border border-zinc-800 rounded-xl bg-zinc-950/60 no-scrollbar">
                    {items.map((it) => {
                      const isChecked = selectedItemIdsForGroup.includes(it.id);
                      return (
                        <div
                          key={it.id}
                          onClick={() => toggleItemInGroup(it.id)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer select-none ${
                            isChecked
                              ? 'bg-theme-badge border-theme ring-1 ring-theme'
                              : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                isChecked
                                  ? 'border-theme-accent bg-theme-accent text-white'
                                  : 'border-zinc-700 bg-zinc-800'
                              }`}
                            >
                              {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                            </div>
                            <div className="truncate">
                              <span className="text-xs font-bold text-white block truncate">{it.name}</span>
                              <span className="text-[10px] text-zinc-400">{it.category || 'General'}</span>
                            </div>
                          </div>
                          <span className="text-xs font-mono font-bold text-theme-accent shrink-0">
                            +₹{Number(it.price || 0).toFixed(0)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={handleCloseGroupModal}
                  disabled={isGroupSubmitting}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGroupSubmitting}
                  className="rounded-xl btn-theme-primary px-5 py-2 text-xs text-white shadow-lg disabled:opacity-50 font-bold cursor-pointer"
                >
                  {isGroupSubmitting ? 'Saving...' : editingGroup ? 'Save Changes' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
