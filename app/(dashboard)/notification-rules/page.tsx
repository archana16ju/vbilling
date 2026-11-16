'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell,
  Plus,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Volume2,
  VolumeX,
  Clock,
  Moon,
  Users,
  Play,
  Edit,
  Trash2,
  RefreshCw,
  X,
  Shield,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import { SUPPORTED_EVENT_TYPES, NotificationRule } from '@/lib/notification-types';

const ROLES_LIST = [
  { id: 'company_admin', label: 'Company Admin' },
  { id: 'manager', label: 'Manager' },
  { id: 'cashier', label: 'Cashier' },
  { id: 'chef', label: 'Chef' },
  { id: 'waiter', label: 'Waiter' },
  { id: 'delivery_staff', label: 'Delivery Staff' },
];

export default function NotificationRulesPage() {
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);

  // Edit / Add Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);
  const [name, setName] = useState('');
  const [eventType, setEventType] = useState('low_stock');
  const [isCustomEvent, setIsCustomEvent] = useState(false);
  const [customEventKey, setCustomEventKey] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [priority, setPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
  const [channels, setChannels] = useState<Array<'in_app' | 'sound' | 'email' | 'whatsapp'>>(['in_app', 'sound']);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('07:00');
  const [thresholdValue, setThresholdValue] = useState<string>('5');
  const [isEnabled, setIsEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Testing & Deleting Feedback
  const [testingRuleId, setTestingRuleId] = useState<string | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/notifications/rules');
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch (err) {
      console.error('Failed to load rules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const match = document.cookie.match(/(^| )auth_role=([^;]+)/);
    setRole(match ? match[2] : null);
    fetchRules();
  }, []);

  const handleOpenCreate = () => {
    setEditingRule(null);
    setName('');
    setIsCustomEvent(false);
    setCustomEventKey('');
    setEventType('low_stock');
    setSelectedRoles(['manager', 'company_admin']);
    setPriority('urgent');
    setChannels(['in_app', 'sound']);
    setQuietHoursEnabled(false);
    setQuietHoursStart('22:00');
    setQuietHoursEnd('07:00');
    setThresholdValue('5');
    setIsEnabled(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rule: NotificationRule) => {
    setEditingRule(rule);
    setName(rule.name);
    const isSupported = SUPPORTED_EVENT_TYPES.some((ev) => ev.id === rule.eventType);
    if (isSupported) {
      setIsCustomEvent(false);
      setEventType(rule.eventType);
      setCustomEventKey('');
    } else {
      setIsCustomEvent(true);
      setEventType(rule.eventType);
      setCustomEventKey(rule.eventType);
    }
    setSelectedRoles(rule.roles || []);
    setPriority(rule.priority);
    setChannels(rule.channels || ['in_app']);
    setQuietHoursEnabled(rule.quietHoursEnabled);
    setQuietHoursStart(rule.quietHoursStart ? rule.quietHoursStart.substring(0, 5) : '22:00');
    setQuietHoursEnd(rule.quietHoursEnd ? rule.quietHoursEnd.substring(0, 5) : '07:00');
    setThresholdValue(rule.thresholdValue !== null ? String(rule.thresholdValue) : '');
    setIsEnabled(rule.isEnabled);
    setIsModalOpen(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalEventType = isCustomEvent
      ? customEventKey.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '')
      : eventType;

    if (isCustomEvent && !finalEventType) {
      setFeedbackMessage({ type: 'error', text: 'Please enter a valid custom event type identifier (e.g. vip_order)' });
      setTimeout(() => setFeedbackMessage(null), 4000);
      return;
    }

    try {
      setIsSaving(true);
      const res = await fetch('/api/notifications/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingRule?.id,
          name: name.trim(),
          eventType: finalEventType,
          roles: selectedRoles,
          priority,
          channels,
          quietHoursEnabled,
          quietHoursStart: quietHoursEnabled ? `${quietHoursStart}:00` : null,
          quietHoursEnd: quietHoursEnabled ? `${quietHoursEnd}:00` : null,
          thresholdValue: thresholdValue ? Number(thresholdValue) : null,
          isEnabled,
        }),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setFeedbackMessage({ type: 'success', text: `Rule "${name}" successfully saved!` });
        fetchRules();
      } else {
        const data = await res.json();
        setFeedbackMessage({ type: 'error', text: data.error || 'Failed to save rule' });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Error saving rule' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
  };

  const handleDeleteRule = async (ruleId: string, ruleName: string) => {
    if (!window.confirm(`Are you sure you want to delete notification rule "${ruleName}"?`)) return;
    try {
      setDeletingRuleId(ruleId);
      const res = await fetch(`/api/notifications/rules?id=${encodeURIComponent(ruleId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        setFeedbackMessage({ type: 'success', text: `Rule "${ruleName}" deleted successfully.` });
        fetchRules();
      } else {
        setFeedbackMessage({ type: 'error', text: data.error || 'Failed to delete rule' });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Error deleting rule' });
    } finally {
      setDeletingRuleId(null);
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
  };

  const handleToggleRule = async (rule: NotificationRule) => {
    try {
      const res = await fetch('/api/notifications/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...rule,
          isEnabled: !rule.isEnabled,
        }),
      });
      if (res.ok) {
        fetchRules();
      }
    } catch (err) {
      console.error('Error toggling rule:', err);
    }
  };

  const handleTestRule = async (rule: NotificationRule) => {
    try {
      setTestingRuleId(rule.id);
      const res = await fetch('/api/notifications/rules/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: rule.eventType,
          ruleName: rule.name,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedbackMessage({ type: 'success', text: data.message });
      } else {
        setFeedbackMessage({ type: 'error', text: data.error || 'Test notification failed' });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Test error' });
    } finally {
      setTestingRuleId(null);
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
  };

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
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Smart Notification Rules</h1>
            <p className="text-xs sm:text-sm text-zinc-400">
              Configure event-triggered alerts, quiet hours, sound notifications, and recipient role assignments
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-lg transition active:scale-95 cursor-pointer"
            style={{
              backgroundColor: 'var(--theme-accent, #DB2777)',
            }}
          >
            <Plus className="h-4 w-4" />
            New Rule
          </button>
          <button
            onClick={fetchRules}
            disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-bold ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            <span>{feedbackMessage.text}</span>
          </div>
          <button onClick={() => setFeedbackMessage(null)} className="text-zinc-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Rules Grid */}
      {loading ? (
        <div className="py-20 text-center text-zinc-500">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-zinc-400" />
          Loading company notification rules...
        </div>
      ) : rules.length === 0 ? (
        <div className="py-16 text-center text-zinc-500 rounded-3xl border border-zinc-800/60 bg-zinc-900/30">
          <Bell className="h-8 w-8 mx-auto mb-2 text-zinc-600" />
          <p className="font-bold text-sm text-zinc-400">No notification rules configured</p>
          <p className="text-xs text-zinc-600 mt-1">Create a new rule to begin monitoring store events.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`rounded-3xl border p-5 space-y-3.5 transition-all shadow-xl backdrop-blur-sm ${
                rule.isEnabled
                  ? 'border-zinc-800 bg-zinc-900/70 hover:border-zinc-700'
                  : 'border-zinc-800/50 bg-zinc-950/40 opacity-70'
              }`}
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        rule.priority === 'urgent'
                          ? 'border-rose-500/40 bg-rose-950/60 text-rose-300'
                          : rule.priority === 'important'
                          ? 'border-amber-500/40 bg-amber-950/60 text-amber-300'
                          : 'border-blue-500/40 bg-blue-950/60 text-blue-300'
                      }`}
                    >
                      {rule.priority}
                    </span>
                    {(() => {
                      const preset = SUPPORTED_EVENT_TYPES.find((ev) => ev.id === rule.eventType);
                      if (preset) {
                        return (
                          <span className="text-[10px] text-zinc-400 font-mono bg-zinc-800/80 px-2 py-0.5 rounded-md border border-zinc-700/60">
                            {rule.eventType}
                          </span>
                        );
                      }
                      return (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-pink-500/40 bg-pink-950/50 text-pink-300 text-[10px] font-mono font-bold">
                          <Sparkles className="h-3 w-3 text-pink-400" />
                          <span>custom: {rule.eventType}</span>
                        </span>
                      );
                    })()}
                  </div>
                  <h3 className="text-sm font-black text-white">{rule.name}</h3>
                </div>

                {/* Enable toggle button */}
                <button
                  onClick={() => handleToggleRule(rule)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition ${
                    rule.isEnabled
                      ? 'border-emerald-500/40 bg-emerald-950/60 text-emerald-300'
                      : 'border-zinc-700 bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {rule.isEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              {/* Roles */}
              <div className="space-y-1 text-xs">
                <span className="text-[11px] font-bold text-zinc-400 block">Recipients:</span>
                <div className="flex flex-wrap gap-1">
                  {(rule.roles || []).map((r) => (
                    <span
                      key={r}
                      className="px-2 py-0.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 text-[10px] font-semibold capitalize"
                    >
                      {r.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>

              {/* Channels & Quiet Hours */}
              <div className="flex flex-wrap items-center justify-between text-xs text-zinc-400 pt-1 border-t border-zinc-800/80">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[11px]">
                    {rule.channels.includes('sound') ? (
                      <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <VolumeX className="h-3.5 w-3.5 text-zinc-500" />
                    )}
                    {rule.channels.join(', ')}
                  </span>
                </div>

                {rule.quietHoursEnabled && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-400/90 font-mono">
                    <Moon className="h-3 w-3" />
                    {rule.quietHoursStart?.substring(0, 5)} - {rule.quietHoursEnd?.substring(0, 5)}
                  </span>
                )}
              </div>

              {/* Threshold info if any */}
              {rule.thresholdValue !== null && (
                <div className="text-[11px] text-zinc-400 bg-zinc-950/60 p-2 rounded-xl border border-zinc-800/60 flex items-center justify-between">
                  <span>Threshold trigger:</span>
                  <span className="font-mono font-bold text-white">≤ {rule.thresholdValue}</span>
                </div>
              )}

              {/* Actions Bottom */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                <button
                  onClick={() => handleTestRule(rule)}
                  disabled={testingRuleId === rule.id}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-[11px] font-bold transition"
                >
                  <Play className={`h-3 w-3 text-emerald-400 ${testingRuleId === rule.id ? 'animate-spin' : ''}`} />
                  <span>Test Rule</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(rule)}
                    className="p-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                    title="Edit Rule"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule.id, rule.name)}
                    disabled={deletingRuleId === rule.id}
                    className="p-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-rose-950/60 hover:border-rose-500/50 text-zinc-400 hover:text-rose-300 transition"
                    title="Delete Rule"
                  >
                    <Trash2 className={`h-3.5 w-3.5 ${deletingRuleId === rule.id ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit / Add Rule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl text-white space-y-4 my-8">
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
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    {editingRule ? 'Edit Notification Rule' : 'Create Notification Rule'}
                  </h3>
                  <p className="text-xs text-zinc-400">Configure alert parameters and recipient roles</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Rule Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Critical Raw Material Depletion"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              {/* Event Type Configuration */}
              <div className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-zinc-300">
                    Event Type *
                  </label>
                  <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-800/90 p-0.5 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setIsCustomEvent(false)}
                      className={`px-2.5 py-1 rounded-md transition ${
                        !isCustomEvent
                          ? 'bg-zinc-700 text-white shadow-sm'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Presets
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomEvent(true);
                        if (!customEventKey) {
                          setCustomEventKey(eventType || 'custom_event');
                        }
                      }}
                      className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 ${
                        isCustomEvent
                          ? 'bg-pink-600 text-white shadow-sm'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>Custom</span>
                    </button>
                  </div>
                </div>

                {!isCustomEvent ? (
                  <div className="space-y-1">
                    <select
                      value={eventType}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setIsCustomEvent(true);
                          if (!customEventKey) setCustomEventKey('custom_event');
                        } else {
                          setEventType(e.target.value);
                          const matched = SUPPORTED_EVENT_TYPES.find((ev) => ev.id === e.target.value);
                          if (matched && !editingRule) {
                            setSelectedRoles(matched.defaultRoles);
                            setPriority(matched.defaultPriority as any);
                          }
                        }
                      }}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-pink-500"
                    >
                      {SUPPORTED_EVENT_TYPES.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.name} ({ev.id})
                        </option>
                      ))}
                      <option value="__custom__">✨ + Enter Custom Event Type...</option>
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      required
                      placeholder="e.g. customer_vip_arrival, pos_discount_override, kitchen_urgent"
                      value={customEventKey}
                      onChange={(e) => setCustomEventKey(e.target.value)}
                      className="w-full rounded-xl border border-pink-500/60 bg-zinc-800 px-3 py-2 text-xs font-mono font-bold text-pink-300 placeholder-zinc-500 focus:outline-none focus:border-pink-400"
                    />
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                      <Sparkles className="h-3 w-3 text-pink-400 shrink-0" />
                      <span>Custom event identifier: letters, numbers, and underscores (e.g. <code className="text-pink-300 font-mono">vip_order</code>).</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Priority */}
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

              {/* Recipient Roles */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">Recipient Roles *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3">
                  {ROLES_LIST.map((r) => (
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

              {/* Notification Channels */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">Notification Channels</label>
                <div className="flex gap-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                  <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={channels.includes('in_app')}
                      onChange={(e) => {
                        if (e.target.checked) setChannels([...channels, 'in_app']);
                        else setChannels(channels.filter((c) => c !== 'in_app'));
                      }}
                      className="rounded border-zinc-700 bg-zinc-800 text-pink-500 focus:ring-0"
                    />
                    <span>In-App Banner</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={channels.includes('sound')}
                      onChange={(e) => {
                        if (e.target.checked) setChannels([...channels, 'sound']);
                        else setChannels(channels.filter((c) => c !== 'sound'));
                      }}
                      className="rounded border-zinc-700 bg-zinc-800 text-pink-500 focus:ring-0"
                    />
                    <span>Sound Chime</span>
                  </label>
                </div>
              </div>

              {/* Quiet Hours */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="quietHoursToggle" className="flex items-center gap-2 text-xs font-bold text-zinc-300 cursor-pointer">
                    <Moon className="h-4 w-4 text-amber-400" />
                    <span>Quiet Hours (Mutes Sound Alerts)</span>
                  </label>
                  <input
                    type="checkbox"
                    id="quietHoursToggle"
                    checked={quietHoursEnabled}
                    onChange={(e) => setQuietHoursEnabled(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-800 text-pink-500 focus:ring-0"
                  />
                </div>

                {quietHoursEnabled && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-[10px] text-zinc-400 block mb-1">Start Time</span>
                      <input
                        type="time"
                        value={quietHoursStart}
                        onChange={(e) => setQuietHoursStart(e.target.value)}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 block mb-1">End Time</span>
                      <input
                        type="time"
                        value={quietHoursEnd}
                        onChange={(e) => setQuietHoursEnd(e.target.value)}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Threshold */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  Threshold Value (e.g. Min Stock Qty Trigger)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 5.0"
                  value={thresholdValue}
                  onChange={(e) => setThresholdValue(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              {/* Enable Switch */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isEnabledCheck"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-800 text-pink-500 focus:ring-0"
                />
                <label htmlFor="isEnabledCheck" className="text-xs font-bold text-zinc-300 cursor-pointer">
                  Activate this notification rule immediately
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl border border-zinc-700 bg-zinc-800 text-xs font-bold text-zinc-300 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white transition flex items-center gap-2 cursor-pointer shadow-lg"
                  style={{
                    backgroundColor: 'var(--theme-accent, #DB2777)',
                  }}
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : editingRule ? (
                    'Save Rule Changes'
                  ) : (
                    'Create Rule'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
