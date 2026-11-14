'use client';

import React, { useState, useEffect } from 'react';
import {
  Megaphone,
  Plus,
  Calendar,
  Clock,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Users,
  User,
  Trash2,
  Edit,
  ExternalLink,
  RefreshCw,
  X,
  CheckCheck,
  Shield,
  Layers,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface Announcement {
  id: string;
  companyId: string;
  title: string;
  description: string;
  imageUrl?: string | null;
  priority: 'normal' | 'important' | 'urgent';
  targetAudienceType: 'everyone' | 'roles' | 'individuals';
  targetRoles?: string[];
  targetUserIds?: string[];
  publishAt: string;
  expiresAt?: string | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isRead?: boolean;
  readAt?: string | null;
  readsCount?: number;
  readers?: Array<{
    userId: string;
    userName: string;
    role: string;
    readAt: string;
  }>;
}

const AVAILABLE_ROLES = [
  { id: 'cashier', label: 'Cashiers' },
  { id: 'manager', label: 'Managers' },
  { id: 'chef', label: 'Chefs' },
  { id: 'waiter', label: 'Waiters' },
  { id: 'delivery_staff', label: 'Delivery Staff' },
];

export default function AnnouncementsPage() {
  const [role, setRole] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'feed' | 'manage'>('feed');

  // Filters
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterRead, setFilterRead] = useState<string>('all');

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
  const [targetAudienceType, setTargetAudienceType] = useState<'everyone' | 'roles' | 'individuals'>('everyone');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [publishAt, setPublishAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Readers Modal State
  const [viewingReadersAnn, setViewingReadersAnn] = useState<Announcement | null>(null);

  const canManage = ['super_admin', 'company_admin', 'manager'].includes(role || '');

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const url = activeTab === 'manage' && canManage ? '/api/announcements?admin=true' : '/api/announcements';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data.announcements || []);
        if (data.unreadCount !== undefined) {
          setUnreadCount(data.unreadCount);
        }
      }
    } catch (err) {
      console.error('Failed to load announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const roleMatch = document.cookie.match(/(^| )auth_role=([^;]+)/);
    const r = roleMatch ? roleMatch[2] : null;
    setRole(r);
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [activeTab]);

  const handleMarkAsRead = async (annId: string) => {
    try {
      const res = await fetch(`/api/announcements/${annId}/read`, { method: 'POST' });
      if (res.ok) {
        setAnnouncements((prev) =>
          prev.map((a) => (a.id === annId ? { ...a, isRead: true, readAt: new Date().toISOString() } : a))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      console.error('Error marking announcement as read:', err);
    }
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setPriority('normal');
    setTargetAudienceType('everyone');
    setSelectedRoles([]);
    const now = new Date();
    setPublishAt(now.toISOString().slice(0, 16));
    setExpiresAt('');
    setIsActive(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ann: Announcement) => {
    setEditingId(ann.id);
    setTitle(ann.title);
    setDescription(ann.description);
    setPriority(ann.priority);
    setTargetAudienceType(ann.targetAudienceType);
    setSelectedRoles(ann.targetRoles || []);
    setPublishAt(ann.publishAt ? new Date(ann.publishAt).toISOString().slice(0, 16) : '');
    setExpiresAt(ann.expiresAt ? new Date(ann.expiresAt).toISOString().slice(0, 16) : '');
    setIsActive(ann.isActive);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setFormError('Title and description are required');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      const payload = {
        title: title.trim(),
        description: description.trim(),
        imageUrl: null,
        priority,
        targetAudienceType,
        targetRoles: targetAudienceType === 'roles' ? selectedRoles : undefined,
        publishAt: publishAt ? new Date(publishAt).toISOString() : new Date().toISOString(),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        isActive,
      };

      const url = '/api/announcements';
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId ? JSON.stringify({ id: editingId, ...payload }) : JSON.stringify(payload);

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchAnnouncements();
      } else {
        const err = await res.json();
        setFormError(err.error || 'Failed to save announcement');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error submitting form');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (annId: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
      const res = await fetch(`/api/announcements?id=${annId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchAnnouncements();
      }
    } catch (err) {
      console.error('Failed to delete announcement:', err);
    }
  };

  const handleToggleActive = async (ann: Announcement) => {
    try {
      const res = await fetch('/api/announcements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ann.id, isActive: !ann.isActive }),
      });
      if (res.ok) {
        fetchAnnouncements();
      }
    } catch (err) {
      console.error('Failed to toggle announcement status:', err);
    }
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'urgent':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-950/60 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-300">
            <Flame className="h-3 w-3 text-rose-400" /> Urgent
          </span>
        );
      case 'important':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-950/60 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300">
            <AlertTriangle className="h-3 w-3 text-amber-400" /> Important
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/40 bg-blue-950/60 px-2.5 py-0.5 text-[10px] font-bold text-blue-300">
            Normal
          </span>
        );
    }
  };

  const filteredAnnouncements = announcements.filter((a) => {
    if (filterPriority !== 'all' && a.priority !== filterPriority) return false;
    if (filterRead === 'unread' && a.isRead) return false;
    if (filterRead === 'read' && !a.isRead) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl border"
            style={{
              backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
              borderColor: 'var(--theme-active-border, rgba(219,39,119,0.3))',
              color: 'var(--theme-accent, #DB2777)',
            }}
          >
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Internal Announcement Board</h1>
              {unreadCount > 0 && activeTab === 'feed' && (
                <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-black text-white animate-pulse">
                  {unreadCount} Unread
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-zinc-400">
              Company-wide announcements, role broadcasts, and urgent team updates
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {canManage && (
            <div className="flex rounded-xl border border-zinc-800 bg-zinc-900 p-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('feed')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'feed' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Feed
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('manage')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'manage' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Manage
              </button>
            </div>
          )}

          {canManage && (
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-lg transition active:scale-95 cursor-pointer"
              style={{
                backgroundColor: 'var(--theme-accent, #DB2777)',
              }}
            >
              <Plus className="h-4 w-4" />
              New Announcement
            </button>
          )}

          <button
            onClick={fetchAnnouncements}
            disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs in Feed View */}
      {activeTab === 'feed' && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-400 flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> Priority:
            </span>
            <div className="flex gap-1">
              {['all', 'urgent', 'important', 'normal'].map((p) => (
                <button
                  key={p}
                  onClick={() => setFilterPriority(p)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize transition ${
                    filterPriority === p
                      ? 'bg-zinc-800 text-white border border-zinc-700'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-400">Status:</span>
            <div className="flex gap-1">
              {['all', 'unread', 'read'].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterRead(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize transition ${
                    filterRead === s
                      ? 'bg-zinc-800 text-white border border-zinc-700'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Feed List */}
      {activeTab === 'feed' ? (
        <div className="space-y-4">
          {loading ? (
            <div className="py-16 text-center text-zinc-500">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-zinc-400" />
              Loading announcements...
            </div>
          ) : filteredAnnouncements.length === 0 ? (
            <div className="py-16 text-center text-zinc-500 rounded-3xl border border-zinc-800/60 bg-zinc-900/30">
              <Megaphone className="h-8 w-8 mx-auto mb-2 text-zinc-600" />
              <p className="font-bold text-sm text-zinc-400">No announcements to display</p>
              <p className="text-xs text-zinc-600 mt-1">You are all caught up with company news!</p>
            </div>
          ) : (
            filteredAnnouncements.map((ann) => (
              <div
                key={ann.id}
                className={`relative rounded-3xl border p-5 sm:p-6 transition-all shadow-xl backdrop-blur-sm ${
                  ann.priority === 'urgent'
                    ? 'border-rose-500/40 bg-rose-950/15'
                    : ann.priority === 'important'
                    ? 'border-amber-500/30 bg-amber-950/10'
                    : 'border-zinc-800 bg-zinc-900/70'
                } ${!ann.isRead ? 'ring-1 ring-pink-500/30' : ''}`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {getPriorityBadge(ann.priority)}
                      {!ann.isRead ? (
                        <span className="rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30 px-2 py-0.5 text-[10px] font-black uppercase">
                          New Unread
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400 font-medium">
                          <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Read
                        </span>
                      )}
                      <span className="text-xs text-zinc-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(ann.publishAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {ann.expiresAt && (
                        <span className="text-xs text-zinc-400">
                          · Expires: {new Date(ann.expiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                    </div>

                    <h2 className="text-lg font-black text-white">{ann.title}</h2>
                    <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                      {ann.description}
                    </p>
                  </div>

                  <div className="flex items-center md:flex-col justify-end gap-2 pt-2 md:pt-0 shrink-0">
                    {!ann.isRead && (
                      <button
                        onClick={() => handleMarkAsRead(ann.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 hover:text-white text-xs font-bold transition cursor-pointer"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Mark as Read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Manage Table View */
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-800/60 text-zinc-400 uppercase tracking-wider text-[10px] font-black border-b border-zinc-800">
                <tr>
                  <th className="py-3.5 px-4">Title & Details</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Audience</th>
                  <th className="py-3.5 px-4">Published & Expiry</th>
                  <th className="py-3.5 px-4">Read Count</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-500">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-zinc-400" />
                      Loading management records...
                    </td>
                  </tr>
                ) : announcements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-500">
                      No announcements created yet.
                    </td>
                  </tr>
                ) : (
                  announcements.map((ann) => (
                    <tr key={ann.id} className="hover:bg-zinc-800/40 transition">
                      <td className="py-3.5 px-4">
                        <div className="max-w-sm">
                          <span className="font-bold text-white block text-sm">{ann.title}</span>
                          <span className="text-[11px] text-zinc-400 line-clamp-1">{ann.description}</span>
                          <span className="text-[10px] text-zinc-400 font-mono">By {ann.createdBy}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">{getPriorityBadge(ann.priority)}</td>

                      <td className="py-3.5 px-4">
                        <span className="capitalize font-semibold text-zinc-200 block">
                          {ann.targetAudienceType}
                        </span>
                        {ann.targetAudienceType === 'roles' && (
                          <span className="text-[10px] text-zinc-400 font-mono">
                            {(ann.targetRoles || []).join(', ')}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-zinc-300">
                        <div>
                          <span className="block font-medium">
                            {new Date(ann.publishAt).toLocaleDateString()}
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            {ann.expiresAt ? `Exp: ${new Date(ann.expiresAt).toLocaleDateString()}` : 'No Expiry'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => setViewingReadersAnn(ann)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 transition cursor-pointer text-[11px] font-bold"
                        >
                          <Eye className="h-3 w-3 text-cyan-400" />
                          <span>{ann.readsCount || 0} reads</span>
                        </button>
                      </td>

                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleActive(ann)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition ${
                            ann.isActive
                              ? 'border-emerald-500/40 bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900'
                              : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                          }`}
                        >
                          {ann.isActive ? 'Active' : 'Unpublished'}
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(ann)}
                            className="p-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                            title="Edit"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(ann.id)}
                            className="p-1.5 rounded-lg border border-rose-500/30 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 transition"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl text-white space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl border"
                  style={{
                    backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                    borderColor: 'var(--theme-active-border, rgba(219,39,119,0.3))',
                    color: 'var(--theme-accent, #DB2777)',
                  }}
                >
                  <Megaphone className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    {editingId ? 'Edit Announcement' : 'Publish Announcement'}
                  </h3>
                  <p className="text-xs text-zinc-400">Broadcast updates to staff members</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-950/40 text-xs font-bold text-rose-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. System Maintenance or Diwali Special Menu"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Description *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Enter full announcement message for the team..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e: any) => setPriority(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-bold text-white focus:outline-none"
                  >
                    <option value="normal">Normal</option>
                    <option value="important">Important</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Target Audience</label>
                  <select
                    value={targetAudienceType}
                    onChange={(e: any) => setTargetAudienceType(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-bold text-white focus:outline-none"
                  >
                    <option value="everyone">Everyone in Company</option>
                    <option value="roles">Specific Roles</option>
                  </select>
                </div>
              </div>

              {targetAudienceType === 'roles' && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 space-y-2">
                  <span className="text-[11px] font-bold text-zinc-400 block">Select Eligible Roles:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {AVAILABLE_ROLES.map((r) => (
                      <label key={r.id} className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedRoles.includes(r.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRoles([...selectedRoles, r.id]);
                            } else {
                              setSelectedRoles(selectedRoles.filter((x) => x !== r.id));
                            }
                          }}
                          className="rounded border-zinc-700 bg-zinc-800 text-pink-500 focus:ring-0"
                        />
                        <span>{r.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Publish Date & Time</label>
                  <input
                    type="datetime-local"
                    value={publishAt}
                    onChange={(e) => setPublishAt(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-bold text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Expiry Date & Time (Optional)</label>
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-bold text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-800 text-pink-500 focus:ring-0"
                />
                <label htmlFor="isActiveCheck" className="text-xs font-bold text-zinc-300 cursor-pointer">
                  Publish immediately (Active)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl border border-zinc-700 bg-zinc-800 text-xs font-bold text-zinc-300 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white transition flex items-center gap-2 cursor-pointer shadow-lg"
                  style={{
                    backgroundColor: 'var(--theme-accent, #DB2777)',
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : editingId ? (
                    'Save Changes'
                  ) : (
                    'Publish Announcement'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Readers Status Modal */}
      {viewingReadersAnn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl text-white space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-black text-white">Employee Read Status</h3>
                <p className="text-xs text-zinc-400 line-clamp-1">{viewingReadersAnn.title}</p>
              </div>
              <button
                onClick={() => setViewingReadersAnn(null)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2">
              {!viewingReadersAnn.readers || viewingReadersAnn.readers.length === 0 ? (
                <p className="py-8 text-center text-xs text-zinc-500 font-medium">
                  No employees have marked this announcement as read yet.
                </p>
              ) : (
                viewingReadersAnn.readers.map((r, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-800 bg-zinc-950/40 text-xs"
                  >
                    <div>
                      <span className="font-bold text-white block">{r.userName}</span>
                      <span className="text-[10px] text-zinc-400 capitalize">{r.role}</span>
                    </div>
                    <span className="text-[11px] text-zinc-400">
                      {new Date(r.readAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setViewingReadersAnn(null)}
                className="px-4 py-2 rounded-xl border border-zinc-700 bg-zinc-800 text-xs font-bold text-zinc-300 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
