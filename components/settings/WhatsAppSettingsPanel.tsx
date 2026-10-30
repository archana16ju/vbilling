'use client';

import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Check,
  RotateCcw,
  Sliders,
  Send,
  Copy,
  ExternalLink,
  ShieldCheck,
  Smartphone,
  Eye,
  Info,
  Layers,
  Sparkles,
  CheckCheck,
  AlertCircle,
  FileText,
  User,
  Truck,
  ShoppingBag,
  CreditCard,
  MapPin,
  RefreshCw,
  Globe,
  Settings2,
} from 'lucide-react';
import {
  WhatsAppSettings,
  DEFAULT_WHATSAPP_SETTINGS,
  WhatsAppProvider,
  WhatsAppMessageMode,
  PARAGRAPH_WHATSAPP_TEMPLATE,
  SHORT_WHATSAPP_TEMPLATE,
  DETAILED_WHATSAPP_TEMPLATE,
} from '@/types/whatsapp';
import {
  formatWhatsAppDeliveryMessage,
  sanitizeWhatsAppPhone,
  parseWhatsAppLine,
  SAMPLE_DELIVERY_DATA,
} from '@/lib/whatsapp-helper';

function WhatsAppIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className={className}>
      <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.993.587 1.83.896 2.796.896 3.181 0 5.767-2.587 5.767-5.766.001-3.182-2.585-5.783-5.767-5.783zm3.435 8.167c-.145.408-.842.766-1.16.804-.319.038-.727.182-2.361-.502-1.996-.837-3.267-2.884-3.367-3.018-.099-.134-.808-1.074-.808-2.049 0-.974.51-1.452.691-1.651.182-.2.398-.249.531-.249.133 0 .266.001.382.007.123.006.287-.046.45.344.164.39.562 1.371.611 1.472.049.1.082.219.016.353-.066.134-.099.219-.198.334-.099.117-.21.261-.3.351-.101.1-.205.21-.088.411.117.201.521.859 1.118 1.391.768.684 1.416.896 1.617.996.201.1.319.083.436-.051.117-.134.502-.584.635-.785.133-.201.266-.168.45-.1.183.067 1.164.55 1.365.65.201.1.334.15.383.234.049.083.049.484-.096.892z" />
    </svg>
  );
}

const TEMPLATE_VARIABLES = [
  { tag: '{customerName}', label: 'Customer Name', desc: 'Customer name (or {customer_name})' },
  { tag: '{billNumber}', label: 'Bill Number', desc: 'Order / Bill sequence ID' },
  { tag: '{total}', label: 'Total Amount', desc: 'Final bill total' },
  { tag: '{restaurantName}', label: 'Restaurant / Brand', desc: 'Active company store name' },
  { tag: '{trackingLink}', label: 'Tracking URL', desc: 'Live order tracking link' },
  { tag: '{staffName}', label: 'Rider Name', desc: 'Assigned delivery person name' },
  { tag: '{staffPhone}', label: 'Rider Phone', desc: 'Assigned rider contact phone' },
  { tag: '{status}', label: 'Status', desc: 'Assigned or Unassigned' },
  { tag: '{deliveryAddress}', label: 'Address', desc: 'Delivery location' },
  { tag: '{items}', label: 'Items List', desc: 'Formatted list of ordered items' },
  { tag: '{paymentMethod}', label: 'Payment', desc: 'Cash, UPI, Card, etc.' },
  { tag: '{footer}', label: 'Footer Note', desc: 'Custom closing note' },
];

export default function WhatsAppSettingsPanel() {
  const [settings, setSettings] = useState<WhatsAppSettings>(DEFAULT_WHATSAPP_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'message' | 'integration'>('message');
  const [copiedPreview, setCopiedPreview] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [isLightMode, setIsLightMode] = useState(false);

  // Monitor theme changes (Light Mode vs Dark Mode)
  useEffect(() => {
    const checkMode = () => {
      if (typeof document === 'undefined') return;
      const html = document.documentElement;
      const themeAttr = html.getAttribute('data-theme');
      const isLight = themeAttr === 'light' || html.classList.contains('light-mode');
      setIsLightMode(isLight);
    };

    checkMode();
    window.addEventListener('company-theme-changed', checkMode);
    const observer = new MutationObserver(checkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

    return () => {
      window.removeEventListener('company-theme-changed', checkMode);
      observer.disconnect();
    };
  }, []);

  // Load WhatsApp settings
  const loadSettings = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);

      // Check localStorage first for instant initial render
      try {
        const cached = localStorage.getItem('whatsapp_settings');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed.isEnabled === 'boolean') {
            setSettings({ ...DEFAULT_WHATSAPP_SETTINGS, ...parsed });
          }
        }
      } catch { }

      const res = await fetch('/api/settings/whatsapp');
      if (res.ok) {
        const data = await res.json();
        if (data && data.settings) {
          const merged = { ...DEFAULT_WHATSAPP_SETTINGS, ...data.settings };
          setSettings(merged);
          try {
            localStorage.setItem('whatsapp_settings', JSON.stringify(merged));
          } catch { }
        }
      }
    } catch (err: any) {
      console.warn('Failed to fetch WhatsApp settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleUpdate = <K extends keyof WhatsAppSettings>(field: K, value: WhatsAppSettings[K]) => {
    setSettings((prev) => {
      const updated = { ...prev, [field]: value };
      // Keep localStorage in sync immediately for reactive changes
      try {
        localStorage.setItem('whatsapp_settings', JSON.stringify(updated));
      } catch { }
      return updated;
    });
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setErrorMsg(null);
      setSaveSuccess(false);

      const res = await fetch('/api/settings/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSettings(data.settings);
          try {
            localStorage.setItem('whatsapp_settings', JSON.stringify(data.settings));
          } catch { }
        }
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || 'Failed to save WhatsApp settings');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Connection error while saving settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (confirm('Reset all WhatsApp message structures and configurations to system defaults?')) {
      setSettings(DEFAULT_WHATSAPP_SETTINGS);
      try {
        localStorage.setItem('whatsapp_settings', JSON.stringify(DEFAULT_WHATSAPP_SETTINGS));
      } catch { }
    }
  };

  // Generate live preview text from current settings
  const previewMessage = formatWhatsAppDeliveryMessage(SAMPLE_DELIVERY_DATA, settings);

  const handleCopyPreview = async () => {
    try {
      await navigator.clipboard.writeText(previewMessage);
      setCopiedPreview(true);
      setTimeout(() => setCopiedPreview(false), 2000);
    } catch { }
  };

  const handleSendTestMessage = () => {
    const rawTarget = testPhone.trim() || SAMPLE_DELIVERY_DATA.customerPhone || '';
    const formatted = sanitizeWhatsAppPhone(rawTarget, settings.defaultCountryCode);
    const encoded = encodeURIComponent(previewMessage);

    if (formatted) {
      window.open(`https://wa.me/${formatted}?text=${encoded}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    }
  };

  const insertVariable = (tag: string) => {
    const textarea = document.getElementById('custom-template-input') as HTMLTextAreaElement | null;
    const current = settings.customTemplate || '';
    if (textarea) {
      const start = textarea.selectionStart || current.length;
      const end = textarea.selectionEnd || current.length;
      const nextVal = current.substring(0, start) + tag + current.substring(end);
      handleUpdate('customTemplate', nextVal);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + tag.length, start + tag.length);
      }, 50);
    } else {
      handleUpdate('customTemplate', current + tag);
    }
  };

  // Light vs Dark Mode Style Classes
  const cardBg = isLightMode
    ? 'bg-white border-zinc-200 text-zinc-900 shadow-sm'
    : 'bg-zinc-900/90 border-zinc-800 text-white shadow-xl backdrop-blur-sm';

  const subCardBg = isLightMode
    ? 'bg-zinc-50 border-zinc-200 text-zinc-900'
    : 'bg-zinc-950/70 border-zinc-800 text-zinc-100';

  const inputBg = isLightMode
    ? 'bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500'
    : 'bg-zinc-950 border-zinc-800 text-white placeholder-zinc-500 focus:border-zinc-600';

  const textMuted = isLightMode ? 'text-zinc-600' : 'text-zinc-400';
  const textSubtle = isLightMode ? 'text-zinc-500' : 'text-zinc-500';
  const borderLight = isLightMode ? 'border-zinc-200' : 'border-zinc-800';

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className={`rounded-3xl border p-6 transition-colors duration-200 ${cardBg}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/15 border border-[#25D366]/30 text-[#25D366] shadow-sm shrink-0">
              <WhatsAppIcon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-black tracking-tight">WhatsApp Settings</h2>
                <span className="rounded-full bg-[#25D366]/15 border border-[#25D366]/30 px-2.5 py-0.5 text-[10px] font-bold text-[#25D366]">
                  Terminal Dispatch Connected
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${textMuted}`}>
                Manage delivery order WhatsApp notifications, message formatting, and automated terminal dispatch
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Master Toggle */}
            <div className={`flex items-center gap-3 rounded-2xl border px-3.5 py-2 ${subCardBg}`}>
              <div className="flex flex-col text-right">
                <span className="text-xs font-bold leading-tight">
                  {settings.isEnabled ? 'WhatsApp Active' : 'WhatsApp Disabled'}
                </span>
                <span className={`text-[10px] ${textSubtle}`}>
                  {settings.isEnabled ? 'Sharing enabled in Terminal' : 'Sharing turned off'}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.isEnabled}
                  onChange={(e) => handleUpdate('isEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#25D366]" />
              </label>
            </div>

            {/* Save Button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              style={{ color: '#ffffff' }}
              className="inline-flex items-center gap-2 rounded-2xl btn-theme-primary px-5 py-2.5 text-xs font-bold shadow-lg shadow-theme-glow transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Save Settings</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Feedback Alert Messages */}
        {saveSuccess && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-3 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCheck className="h-4 w-4 shrink-0" />
            <span>WhatsApp settings successfully saved and applied to the POS Terminal!</span>
          </div>
        )}
        {errorMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-500/15 border border-rose-500/30 p-3 text-xs text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Main Grid: Left Controls & Right Live WhatsApp Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ======================================================== */}
        {/* LEFT COLUMN: SETTINGS CONFIGURATION (7 cols)            */}
        {/* ======================================================== */}
        <div className="lg:col-span-7 space-y-5">
          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-2 border-b pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('message')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${activeTab === 'message'
                ? 'bg-theme-bar border border-theme text-white shadow-sm'
                : `${textMuted} hover:text-white hover:bg-zinc-800/40`
                }`}
            >
              <FileText className="h-4 w-4" />
              <span>Message Structure & Template</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('integration')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${activeTab === 'integration'
                ? 'bg-theme-bar border border-theme text-white shadow-sm'
                : `${textMuted} hover:text-white hover:bg-zinc-800/40`
                }`}
            >
              <Settings2 className="h-4 w-4" />
              <span>Integration & Automation</span>
            </button>
          </div>

          {activeTab === 'message' && (
            <div className="space-y-5">
              {/* Message Format Presets Selector */}
              <div className={`rounded-2xl border p-4 sm:p-5 ${cardBg}`}>
                <div className="pb-3 border-b mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#25D366]" />
                    <h3 className="text-sm font-bold">Message Structure Presets</h3>
                  </div>
                  <p className={`text-xs mt-0.5 ${textMuted}`}>
                    Select how delivery order WhatsApp messages are structured and formatted
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Preset 1: Paragraph View (Customer Greeting) */}
                  <button
                    type="button"
                    onClick={() => {
                      handleUpdate('messageMode', 'builder');
                      handleUpdate('messageFormat', 'paragraph');
                    }}
                    className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer relative ${settings.messageMode === 'builder' && settings.messageFormat === 'paragraph'
                      ? 'border-[#25D366] bg-[#25D366]/10 ring-2 ring-[#25D366]/30 shadow-md'
                      : `${subCardBg} hover:border-zinc-500`
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold flex items-center gap-1.5 text-[#25D366]">
                        💬 Para View
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold block leading-tight">
                      Customer Greeting
                    </span>
                  </button>

                  {/* Preset 2: Short Status Only */}
                  <button
                    type="button"
                    onClick={() => {
                      handleUpdate('messageMode', 'builder');
                      handleUpdate('messageFormat', 'short');
                    }}
                    className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer relative ${settings.messageMode === 'builder' && settings.messageFormat === 'short'
                      ? 'border-[#25D366] bg-[#25D366]/10 ring-2 ring-[#25D366]/30 shadow-md'
                      : `${subCardBg} hover:border-zinc-500`
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold flex items-center gap-1.5 text-[#25D366]">
                        ⚡ Short
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold block leading-tight">
                      Minimal
                    </span>

                  </button>

                  {/* Preset 3: Detailed Receipt Breakdown */}
                  <button
                    type="button"
                    onClick={() => {
                      handleUpdate('messageMode', 'builder');
                      handleUpdate('messageFormat', 'detailed');
                    }}
                    className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer relative ${settings.messageMode === 'builder' && settings.messageFormat === 'detailed'
                      ? 'border-[#25D366] bg-[#25D366]/10 ring-2 ring-[#25D366]/30 shadow-md'
                      : `${subCardBg} hover:border-zinc-500`
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold flex items-center gap-1.5">
                        📋 Detailed
                      </span>

                    </div>
                    <span className="text-[11px] font-semibold block leading-tight">
                      Itemized Receipt
                    </span>

                  </button>

                  {/* Preset 4: Custom Template */}
                  <button
                    type="button"
                    onClick={() => handleUpdate('messageMode', 'custom_template')}
                    className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer relative ${settings.messageMode === 'custom_template'
                      ? 'border-[#25D366] bg-[#25D366]/10 ring-2 ring-[#25D366]/30 shadow-md'
                      : `${subCardBg} hover:border-zinc-500`
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold flex items-center gap-1.5">
                        ✏️ Custom
                      </span>

                    </div>
                    <span className="text-[11px] font-semibold block leading-tight">
                      Custom Template
                    </span>

                  </button>
                </div>
              </div>

              {/* Mode-Specific Controls */}
              {settings.messageMode === 'builder' && settings.messageFormat === 'paragraph' && (
                /* PARAGRAPH VIEW BUILDER */
                <div className={`rounded-2xl border p-5 space-y-4 ${cardBg}`}>
                  <div className="flex items-center justify-between pb-3 border-b">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#25D366] flex items-center gap-1.5">
                        <MessageSquare className="h-4 w-4" />
                        Customer Greeting Paragraph Structure
                      </h4>
                      <p className={`text-[11px] mt-0.5 ${textMuted}`}>
                        Conversational greeting paragraph with customer name, bill total, store brand &amp; live order tracking
                      </p>
                    </div>
                  </div>

                  {/* Paragraph Greeting Textarea */}
                  <div>
                    <label className="text-xs font-bold block mb-1.5">
                      Greeting Message Paragraph
                    </label>
                    <textarea
                      rows={3}
                      value={settings.paragraphGreeting ?? DEFAULT_WHATSAPP_SETTINGS.paragraphGreeting}
                      onChange={(e) => handleUpdate('paragraphGreeting', e.target.value)}
                      placeholder="Hi {customerName}, thank you for dining with us! Bill #{billNumber}, total ₹{total}. — {restaurantName}"
                      className={`w-full rounded-xl border p-3 text-xs font-medium focus:outline-none transition leading-relaxed ${inputBg}`}
                    />
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className={`text-[10px] ${textSubtle}`}>Quick insert tags:</span>
                      {['{customerName}', '{billNumber}', '{total}', '{restaurantName}'].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            const cur = settings.paragraphGreeting ?? DEFAULT_WHATSAPP_SETTINGS.paragraphGreeting ?? '';
                            handleUpdate('paragraphGreeting', cur + ' ' + t);
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono border hover:border-[#25D366] hover:text-[#25D366] transition cursor-pointer ${subCardBg}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Delivery & Tracking Sections */}
                  <div className="space-y-2 pt-1">
                    <span className="text-xs font-bold uppercase tracking-wider block">
                      Delivery Order Details (Appended for Delivery Orders)
                    </span>

                    {/* Assigned Staff & Status Toggle */}
                    <div className={`rounded-xl border p-3 flex items-center justify-between ${subCardBg}`}>
                      <div>
                        <span className="text-xs font-semibold block">
                          Assigned Delivery Rider &amp; Status
                        </span>
                        <span className={`text-[10px] font-mono ${textSubtle}`}>
                          *Assigned Staff:* Suresh Patel (9876543211) • *Status:* Assigned
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.includeStaffDetails}
                        onChange={(e) => handleUpdate('includeStaffDetails', e.target.checked)}
                        className="h-4 w-4 rounded accent-[#25D366] cursor-pointer"
                      />
                    </div>

                    {/* Live Order Tracking Link Toggle */}
                    <div className={`rounded-xl border p-3 flex items-center justify-between ${subCardBg}`}>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold block">
                            Live Order Tracking Link
                          </span>
                          <span className="rounded-full bg-[#25D366]/20 border border-[#25D366]/40 px-1.5 py-0.2 text-[9px] font-bold text-[#25D366]">
                            Essential
                          </span>
                        </div>
                        <span className={`text-[10px] font-mono ${textSubtle}`}>
                          *Track Order:* http://localhost:3000/delivery/track/[token]
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.includeTrackingLink}
                        onChange={(e) => handleUpdate('includeTrackingLink', e.target.checked)}
                        className="h-4 w-4 rounded accent-[#25D366] cursor-pointer"
                      />
                    </div>

                    {/* Customer Delivery Address Toggle */}
                    <div className={`rounded-xl border p-3 flex items-center justify-between ${subCardBg}`}>
                      <div>
                        <span className="text-xs font-semibold block">
                          Include Delivery Address
                        </span>
                        <span className={`text-[10px] ${textSubtle}`}>
                          Appends customer delivery location if available
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.includeCustomerAddress}
                        onChange={(e) => handleUpdate('includeCustomerAddress', e.target.checked)}
                        className="h-4 w-4 rounded accent-[#25D366] cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {settings.messageMode === 'builder' && settings.messageFormat === 'short' && (
                /* SHORT FORMAT BUILDER (Matches Screenshot) */
                <div className={`rounded-2xl border p-5 space-y-4 ${cardBg}`}>
                  <div className="flex items-center justify-between pb-3 border-b">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#25D366] flex items-center gap-1.5">
                        <CheckCheck className="h-4 w-4" />
                        Short Message Structure
                      </h4>
                      <p className={`text-[11px] mt-0.5 ${textMuted}`}>
                        Compact format showing order ID, assigned staff, status, and tracking link
                      </p>
                    </div>
                  </div>

                  {/* Header Title Input */}
                  <div>
                    <label className="text-xs font-bold block mb-1.5">
                      Header Greeting / Title Line
                    </label>
                    <input
                      type="text"
                      value={settings.headerText}
                      onChange={(e) => handleUpdate('headerText', e.target.value)}
                      placeholder="Delivery Order #{bill_id} Confirmed!"
                      className={`w-full rounded-xl border px-3.5 py-2 text-xs font-semibold focus:outline-none transition ${inputBg}`}
                    />
                    <span className={`text-[10px] mt-1 block ${textSubtle}`}>
                      Use <code className="text-[#25D366] font-mono">{'{bill_id}'}</code> to dynamically display the bill number. Bold by default.
                    </span>
                  </div>

                  {/* Core short toggles */}
                  <div className="space-y-2 pt-1">
                    <span className="text-xs font-bold uppercase tracking-wider block">
                      Core Included Lines
                    </span>

                    {/* Assigned Staff & Status Toggle */}
                    <div className={`rounded-xl border p-3 flex items-center justify-between ${subCardBg}`}>
                      <div>
                        <span className="text-xs font-semibold block">
                          Assigned Staff &amp; Delivery Status
                        </span>
                        <span className={`text-[10px] font-mono ${textSubtle}`}>
                          Line 2: *Assigned Staff:* Suresh Patel (9876543211) • Line 3: *Status:* Assigned
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.includeStaffDetails}
                        onChange={(e) => handleUpdate('includeStaffDetails', e.target.checked)}
                        className="h-4 w-4 rounded accent-[#25D366] cursor-pointer"
                      />
                    </div>

                    {/* Live Tracking Link Toggle */}
                    <div className={`rounded-xl border p-3 flex items-center justify-between ${subCardBg}`}>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold block">
                            Live Order Tracking Link
                          </span>
                          <span className="rounded-full bg-[#25D366]/20 border border-[#25D366]/40 px-1.5 py-0.2 text-[9px] font-bold text-[#25D366]">
                            Essential
                          </span>
                        </div>
                        <span className={`text-[10px] font-mono ${textSubtle}`}>
                          Line 4: *Track Order:* http://localhost:3000/delivery/track/[token]
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.includeTrackingLink}
                        onChange={(e) => handleUpdate('includeTrackingLink', e.target.checked)}
                        className="h-4 w-4 rounded accent-[#25D366] cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Optional Extra Details for Short Mode */}
                  <div className="pt-2">
                    <span className={`text-xs font-bold block mb-2 ${textMuted}`}>
                      Optional Extra Fields (Disabled by default to keep message short):
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer ${subCardBg}`}>
                        <span className={textMuted}>Store / Brand Name</span>
                        <input
                          type="checkbox"
                          checked={settings.includeStoreName}
                          onChange={(e) => handleUpdate('includeStoreName', e.target.checked)}
                          className="h-3.5 w-3.5 rounded accent-[#25D366] cursor-pointer"
                        />
                      </label>

                      <label className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer ${subCardBg}`}>
                        <span className={textMuted}>Customer Name</span>
                        <input
                          type="checkbox"
                          checked={settings.includeCustomerDetails}
                          onChange={(e) => handleUpdate('includeCustomerDetails', e.target.checked)}
                          className="h-3.5 w-3.5 rounded accent-[#25D366] cursor-pointer"
                        />
                      </label>

                      <label className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer ${subCardBg}`}>
                        <span className={textMuted}>Delivery Address</span>
                        <input
                          type="checkbox"
                          checked={settings.includeCustomerAddress}
                          onChange={(e) => handleUpdate('includeCustomerAddress', e.target.checked)}
                          className="h-3.5 w-3.5 rounded accent-[#25D366] cursor-pointer"
                        />
                      </label>

                      <label className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer ${subCardBg}`}>
                        <span className={textMuted}>Total Amount</span>
                        <input
                          type="checkbox"
                          checked={settings.includeTotal}
                          onChange={(e) => handleUpdate('includeTotal', e.target.checked)}
                          className="h-3.5 w-3.5 rounded accent-[#25D366] cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {settings.messageMode === 'builder' && settings.messageFormat === 'detailed' && (
                /* DETAILED FORMAT BUILDER */
                <div className={`rounded-2xl border p-5 space-y-4 ${cardBg}`}>
                  <div className="flex items-center justify-between pb-3 border-b">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                        <Layers className="h-4 w-4 text-[#25D366]" />
                        Detailed Receipt Breakdown Builder
                      </h4>
                      <p className={`text-[11px] mt-0.5 ${textMuted}`}>
                        Configure individual sections for itemized delivery bills
                      </p>
                    </div>
                  </div>

                  {/* Header Text Input */}
                  <div>
                    <label className="text-xs font-bold block mb-1.5">
                      Header Greeting / Title
                    </label>
                    <input
                      type="text"
                      value={settings.headerText}
                      onChange={(e) => handleUpdate('headerText', e.target.value)}
                      placeholder="e.g. 📦 Delivery Order Confirmed!"
                      className={`w-full rounded-xl border px-3.5 py-2 text-xs font-semibold focus:outline-none transition ${inputBg}`}
                    />
                    <span className={`text-[10px] mt-1 block ${textSubtle}`}>
                      Displayed at the top of the message in bold
                    </span>
                  </div>

                  {/* Section Toggles */}
                  <div className="space-y-2 pt-2">
                    <span className="text-xs font-bold uppercase tracking-wider block">
                      Included Message Sections
                    </span>

                    {/* Store Name & Order ID */}
                    <div className={`rounded-xl border p-3 space-y-2.5 ${subCardBg}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold block">Store / Brand Name</span>
                          <span className={`text-[10px] ${textSubtle}`}>
                            Includes &apos;Store: [Company Name]&apos;
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.includeStoreName}
                          onChange={(e) => handleUpdate('includeStoreName', e.target.checked)}
                          className="h-4 w-4 rounded accent-[#25D366] cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/40">
                        <div>
                          <span className="text-xs font-semibold block">Order / Bill ID</span>
                          <span className={`text-[10px] ${textSubtle}`}>
                            Includes &apos;Order ID: #BILL-XXXX&apos;
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.includeOrderId}
                          onChange={(e) => handleUpdate('includeOrderId', e.target.checked)}
                          className="h-4 w-4 rounded accent-[#25D366] cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/40">
                        <div>
                          <span className="text-xs font-semibold block">Delivery Channel / Platform</span>
                          <span className={`text-[10px] ${textSubtle}`}>
                            Shows platform when order is from Zomato, Swiggy, or In-House
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.includeChannel}
                          onChange={(e) => handleUpdate('includeChannel', e.target.checked)}
                          className="h-4 w-4 rounded accent-[#25D366] cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Customer Details Box */}
                    <div className={`rounded-xl border p-3 space-y-2.5 ${subCardBg}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold block">Customer Details Section</span>
                          <span className={`text-[10px] ${textSubtle}`}>
                            Includes customer name and contact block
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.includeCustomerDetails}
                          onChange={(e) => handleUpdate('includeCustomerDetails', e.target.checked)}
                          className="h-4 w-4 rounded accent-[#25D366] cursor-pointer"
                        />
                      </div>

                      {settings.includeCustomerDetails && (
                        <div className="pl-3 border-l-2 border-[#25D366]/40 space-y-2 pt-1 text-xs">
                          <label className="flex items-center justify-between cursor-pointer">
                            <span className={textMuted}>Include Customer Phone</span>
                            <input
                              type="checkbox"
                              checked={settings.includeCustomerPhone}
                              onChange={(e) => handleUpdate('includeCustomerPhone', e.target.checked)}
                              className="h-3.5 w-3.5 rounded accent-[#25D366] cursor-pointer"
                            />
                          </label>
                          <label className="flex items-center justify-between cursor-pointer">
                            <span className={textMuted}>Include Delivery Address</span>
                            <input
                              type="checkbox"
                              checked={settings.includeCustomerAddress}
                              onChange={(e) => handleUpdate('includeCustomerAddress', e.target.checked)}
                              className="h-3.5 w-3.5 rounded accent-[#25D366] cursor-pointer"
                            />
                          </label>
                          <label className="flex items-center justify-between cursor-pointer">
                            <span className={textMuted}>Include Delivery / Chef Notes</span>
                            <input
                              type="checkbox"
                              checked={settings.includeCustomerNotes}
                              onChange={(e) => handleUpdate('includeCustomerNotes', e.target.checked)}
                              className="h-3.5 w-3.5 rounded accent-[#25D366] cursor-pointer"
                            />
                          </label>
                        </div>
                      )}
                    </div>

                    {/* Delivery Staff Details Box */}
                    <div className={`rounded-xl border p-3 flex items-center justify-between ${subCardBg}`}>
                      <div>
                        <span className="text-xs font-semibold block">Assigned Delivery Rider Details</span>
                        <span className={`text-[10px] ${textSubtle}`}>
                          Includes delivery status, assigned staff name, and rider phone
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.includeStaffDetails}
                        onChange={(e) => handleUpdate('includeStaffDetails', e.target.checked)}
                        className="h-4 w-4 rounded accent-[#25D366] cursor-pointer"
                      />
                    </div>

                    {/* Items Ordered Box */}
                    <div className={`rounded-xl border p-3 space-y-2.5 ${subCardBg}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold block">Ordered Items List</span>
                          <span className={`text-[10px] ${textSubtle}`}>
                            List item names and quantities
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.includeItems}
                          onChange={(e) => handleUpdate('includeItems', e.target.checked)}
                          className="h-4 w-4 rounded accent-[#25D366] cursor-pointer"
                        />
                      </div>

                      {settings.includeItems && (
                        <div className="pl-3 border-l-2 border-[#25D366]/40 pt-1 text-xs">
                          <label className="flex items-center justify-between cursor-pointer">
                            <span className={textMuted}>Show Individual Item Price in line</span>
                            <input
                              type="checkbox"
                              checked={settings.includeItemPrices}
                              onChange={(e) => handleUpdate('includeItemPrices', e.target.checked)}
                              className="h-3.5 w-3.5 rounded accent-[#25D366] cursor-pointer"
                            />
                          </label>
                        </div>
                      )}
                    </div>

                    {/* Total Amount & Tracking */}
                    <div className={`rounded-xl border p-3 space-y-2.5 ${subCardBg}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold block">Total Amount</span>
                          <span className={`text-[10px] ${textSubtle}`}>
                            Includes &apos;Total Amount: ₹XXX&apos;
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.includeTotal}
                          onChange={(e) => handleUpdate('includeTotal', e.target.checked)}
                          className="h-4 w-4 rounded accent-[#25D366] cursor-pointer"
                        />
                      </div>

                      {settings.includeTotal && (
                        <div className="pl-3 border-l-2 border-[#25D366]/40 pt-1 text-xs">
                          <label className="flex items-center justify-between cursor-pointer">
                            <span className={textMuted}>Include Payment Method (e.g. Cash, UPI)</span>
                            <input
                              type="checkbox"
                              checked={settings.includePaymentMethod}
                              onChange={(e) => handleUpdate('includePaymentMethod', e.target.checked)}
                              className="h-3.5 w-3.5 rounded accent-[#25D366] cursor-pointer"
                            />
                          </label>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/40">
                        <div>
                          <span className="text-xs font-semibold block">Live Order Tracking URL</span>
                          <span className={`text-[10px] ${textSubtle}`}>
                            Includes direct link for customer to track delivery in real time
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.includeTrackingLink}
                          onChange={(e) => handleUpdate('includeTrackingLink', e.target.checked)}
                          className="h-4 w-4 rounded accent-[#25D366] cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer Note */}
                  <div className="pt-2">
                    <label className="text-xs font-bold block mb-1.5">
                      Closing / Thank You Note
                    </label>
                    <textarea
                      rows={2}
                      value={settings.footerText}
                      onChange={(e) => handleUpdate('footerText', e.target.value)}
                      placeholder="Thank you for choosing us! Your order is being prepared and will be delivered shortly. ✨"
                      className={`w-full rounded-xl border p-3 text-xs font-medium focus:outline-none transition leading-relaxed ${inputBg}`}
                    />
                    <span className={`text-[10px] mt-1 block ${textSubtle}`}>
                      Use {'{brand}'} to dynamically display store name
                    </span>
                  </div>
                </div>
              )}

              {settings.messageMode === 'custom_template' && (
                /* CUSTOM TEMPLATE MODE CONTROLS */
                <div className={`rounded-2xl border p-5 space-y-3 ${cardBg}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                        Raw Template Editor
                      </h4>
                      <p className={`text-[11px] ${textMuted}`}>
                        Format messages manually with dynamic bracket placeholders
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleUpdate('customTemplate', PARAGRAPH_WHATSAPP_TEMPLATE)}
                        className="px-2.5 py-1 rounded-lg bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/50 text-[#25D366] text-[11px] font-bold cursor-pointer transition"
                      >
                        💬 Load Para Template
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdate('customTemplate', SHORT_WHATSAPP_TEMPLATE)}
                        className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-bold cursor-pointer transition"
                      >
                        ⚡ Load Short
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdate('customTemplate', DETAILED_WHATSAPP_TEMPLATE)}
                        className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-bold cursor-pointer transition"
                      >
                        📋 Load Detailed
                      </button>
                    </div>
                  </div>

                  <textarea
                    id="custom-template-input"
                    rows={10}
                    value={settings.customTemplate}
                    onChange={(e) => handleUpdate('customTemplate', e.target.value)}
                    className={`w-full rounded-xl border p-3 font-mono text-xs focus:outline-none transition leading-relaxed ${inputBg}`}
                  />

                  {/* Dynamic Variables Pill Box */}
                  <div>
                    <span className="text-[11px] font-bold block mb-1.5">
                      Click variables to insert into template:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {TEMPLATE_VARIABLES.map((v) => (
                        <button
                          key={v.tag}
                          type="button"
                          onClick={() => insertVariable(v.tag)}
                          title={v.desc}
                          className={`px-2 py-1 rounded-lg border text-[11px] font-mono font-semibold transition cursor-pointer hover:border-[#25D366] hover:text-[#25D366] ${subCardBg}`}
                        >
                          {v.tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'integration' && (
            <div className="space-y-5">
              {/* Provider Selection */}
              <div className={`rounded-2xl border p-5 space-y-4 ${cardBg}`}>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Globe className="h-4 w-4 text-[#25D366]" />
                  WhatsApp Gateway Provider
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label
                    className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition ${settings.provider === 'wa_me'
                      ? 'border-[#25D366] bg-[#25D366]/10 shadow-sm'
                      : `${subCardBg} hover:border-zinc-500`
                      }`}
                  >
                    <input
                      type="radio"
                      name="provider"
                      value="wa_me"
                      checked={settings.provider === 'wa_me'}
                      onChange={() => handleUpdate('provider', 'wa_me')}
                      className="mt-0.5 accent-[#25D366]"
                    />
                    <div>
                      <span className="text-xs font-bold block">WhatsApp Web / App (Direct)</span>
                      <span className={`text-[11px] mt-0.5 block leading-normal ${textMuted}`}>
                        Default &amp; Recommended. Opens WhatsApp directly with prefilled text. No API costs, no verification required.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition ${settings.provider === 'cloud_api'
                      ? 'border-[#25D366] bg-[#25D366]/10 shadow-sm'
                      : `${subCardBg} hover:border-zinc-500`
                      }`}
                  >
                    <input
                      type="radio"
                      name="provider"
                      value="cloud_api"
                      checked={settings.provider === 'cloud_api'}
                      onChange={() => handleUpdate('provider', 'cloud_api')}
                      className="mt-0.5 accent-[#25D366]"
                    />
                    <div>
                      <span className="text-xs font-bold block">WhatsApp Cloud API / Gateway</span>
                      <span className={`text-[11px] mt-0.5 block leading-normal ${textMuted}`}>
                        For automated silent messaging via official Meta WhatsApp Business Cloud API or third-party gateways.
                      </span>
                    </div>
                  </label>
                </div>

                {/* API Fields (if Cloud API selected) */}
                {settings.provider === 'cloud_api' && (
                  <div className={`rounded-xl border p-4 space-y-3.5 mt-2 ${subCardBg}`}>
                    <div>
                      <label className="text-xs font-bold block mb-1">API Base URL / Endpoint</label>
                      <input
                        type="text"
                        value={settings.apiEndpoint || ''}
                        onChange={(e) => handleUpdate('apiEndpoint', e.target.value)}
                        placeholder="https://graph.facebook.com/v19.0"
                        className={`w-full rounded-xl border px-3 py-2 text-xs focus:outline-none ${inputBg}`}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold block mb-1">Access Token / API Key</label>
                      <input
                        type="password"
                        value={settings.apiKey || ''}
                        onChange={(e) => handleUpdate('apiKey', e.target.value)}
                        placeholder="Bearer token or API secret"
                        className={`w-full rounded-xl border px-3 py-2 text-xs focus:outline-none ${inputBg}`}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold block mb-1">Phone Number ID</label>
                      <input
                        type="text"
                        value={settings.phoneNumberId || ''}
                        onChange={(e) => handleUpdate('phoneNumberId', e.target.value)}
                        placeholder="e.g. 109823482394823"
                        className={`w-full rounded-xl border px-3 py-2 text-xs focus:outline-none ${inputBg}`}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Number and Country Configuration */}
              <div className={`rounded-2xl border p-5 space-y-4 ${cardBg}`}>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-[#25D366]" />
                  Phone &amp; Region Settings
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold block mb-1">Default Country Dialing Code</label>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-3 py-2 rounded-xl border ${subCardBg}`}>
                        +
                      </span>
                      <input
                        type="text"
                        value={settings.defaultCountryCode}
                        onChange={(e) => handleUpdate('defaultCountryCode', e.target.value.replace(/\D/g, ''))}
                        placeholder="91"
                        maxLength={5}
                        className={`w-full rounded-xl border px-3 py-2 text-xs font-mono font-bold focus:outline-none ${inputBg}`}
                      />
                    </div>
                    <span className={`text-[10px] mt-1 block ${textSubtle}`}>
                      Auto-prefixed to 10-digit Indian numbers when generating WhatsApp links
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-bold block mb-1">Store / Business WhatsApp</label>
                    <input
                      type="text"
                      value={settings.businessPhone || ''}
                      onChange={(e) => handleUpdate('businessPhone', e.target.value)}
                      placeholder="e.g. 9876543210"
                      className={`w-full rounded-xl border px-3 py-2 text-xs font-mono focus:outline-none ${inputBg}`}
                    />
                    <span className={`text-[10px] mt-1 block ${textSubtle}`}>
                      Sender phone number associated with the business
                    </span>
                  </div>
                </div>
              </div>

              {/* Automation Behaviors */}
              <div className={`rounded-2xl border p-5 space-y-3.5 ${cardBg}`}>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-[#25D366]" />
                  Terminal Delivery Behaviors
                </h3>

                <div className="space-y-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <span className="text-xs font-semibold block">Auto-open WhatsApp Share on Delivery Bill</span>
                      <span className={`text-[10px] ${textSubtle}`}>
                        Displays the WhatsApp share modal immediately upon confirming a delivery order
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoOpenDelivery}
                      onChange={(e) => handleUpdate('autoOpenDelivery', e.target.checked)}
                      className="h-4 w-4 rounded accent-[#25D366] cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-zinc-800/40">
                    <div>
                      <span className="text-xs font-semibold block">Allow Cashier to Edit Message in Terminal</span>
                      <span className={`text-[10px] ${textSubtle}`}>
                        Permits the billing cashier to adjust text before opening WhatsApp
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.allowCashierEdit}
                      onChange={(e) => handleUpdate('allowCashierEdit', e.target.checked)}
                      className="h-4 w-4 rounded accent-[#25D366] cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-zinc-800/40">
                    <div>
                      <span className="text-xs font-semibold block">Enable Dispatch Share to Delivery Staff / Rider</span>
                      <span className={`text-[10px] ${textSubtle}`}>
                        Provides a button in Terminal to also WhatsApp the order package details directly to the assigned rider
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.sendToRider}
                      onChange={(e) => handleUpdate('sendToRider', e.target.checked)}
                      className="h-4 w-4 rounded accent-[#25D366] cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Action Footer */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              className={`flex items-center gap-1.5 text-xs font-bold transition cursor-pointer ${textMuted} hover:text-rose-400`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Defaults</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              style={{ color: '#ffffff' }}
              className="inline-flex items-center gap-2 rounded-2xl btn-theme-primary px-6 py-2.5 text-xs font-bold shadow-lg shadow-theme-glow transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: REALISTIC LIVE WHATSAPP CHAT PREVIEW (5 cols) */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 sticky top-6 space-y-4">
          <div className={`rounded-3xl border overflow-hidden shadow-2xl transition-colors duration-200 ${cardBg}`}>
            {/* WhatsApp App Mock Header */}
            <div className="bg-[#075E54] dark:bg-[#1F2C34] text-white p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="h-9 w-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center font-bold text-xs text-white">
                    <User className="h-5 w-5" />
                  </div>
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 border border-[#075E54]" />
                </div>
                <div>
                  <h4 className="text-xs font-bold leading-tight">Customer (Delivery Dispatch)</h4>
                  <span className="text-[10px] text-emerald-200 block">online • WhatsApp Chat Preview</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyPreview}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                  title="Copy preview text"
                >
                  {copiedPreview ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {/* Live Preview Format Switcher Bar */}
            <div className={`px-4 py-2 border-b flex items-center justify-between text-xs ${subCardBg}`}>
              <span className={`text-[11px] font-semibold ${textMuted}`}>Preview:</span>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    handleUpdate('messageMode', 'builder');
                    handleUpdate('messageFormat', 'paragraph');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${settings.messageFormat === 'paragraph' && settings.messageMode === 'builder'
                    ? 'bg-[#25D366] text-white shadow-sm'
                    : `${textMuted} hover:text-white`
                    }`}
                >
                  Para View
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleUpdate('messageMode', 'builder');
                    handleUpdate('messageFormat', 'short');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${settings.messageFormat === 'short' && settings.messageMode === 'builder'
                    ? 'bg-[#25D366] text-white shadow-sm'
                    : `${textMuted} hover:text-white`
                    }`}
                >
                  Short
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleUpdate('messageMode', 'builder');
                    handleUpdate('messageFormat', 'detailed');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${settings.messageFormat === 'detailed' && settings.messageMode === 'builder'
                    ? 'bg-[#25D366] text-white shadow-sm'
                    : `${textMuted} hover:text-white`
                    }`}
                >
                  📋 Detailed
                </button>
              </div>
            </div>

            {/* WhatsApp Chat Conversation Area */}
            <div
              className="p-4 min-h-[380px] max-h-[500px] overflow-y-auto no-scrollbar space-y-3"
              style={{
                backgroundColor: isLightMode ? '#ECE5DD' : '#0B141A',
                backgroundImage: isLightMode
                  ? 'radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px)'
                  : 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)',
                backgroundSize: '16px 16px',
              }}
            >
              {/* Date stamp pill */}
              <div className="flex justify-center">
                <span className="rounded-lg bg-black/30 dark:bg-zinc-800/80 px-2.5 py-0.5 text-[10px] font-semibold text-zinc-200 shadow-sm">
                  Today
                </span>
              </div>

              {/* Chat Message Bubble */}
              <div className="flex justify-end">
                <div
                  className="relative max-w-[94%] rounded-2xl rounded-tr-sm p-3.5 shadow-md text-xs leading-relaxed transition-all"
                  style={{
                    backgroundColor: isLightMode ? '#E7FFDB' : '#005C4B',
                    color: isLightMode ? '#111B21' : '#E9EDEF',
                    border: isLightMode ? '1px solid #C4E8B5' : '1px solid #027A64',
                  }}
                >
                  {/* Rich WhatsApp Formatted Content */}
                  <div className="font-sans text-xs space-y-1 select-text">
                    {previewMessage.split('\n').map((line, lineIdx) => {
                      if (!line.trim()) {
                        return <div key={lineIdx} className="h-1.5" />;
                      }
                      const segments = parseWhatsAppLine(line);
                      return (
                        <div key={lineIdx} className="leading-snug">
                          {segments.map((seg, sIdx) => {
                            if (seg.isBold) {
                              return (
                                <strong key={sIdx} className="font-bold text-inherit">
                                  {seg.text}
                                </strong>
                              );
                            }
                            if (seg.isUrl) {
                              return (
                                <a
                                  key={sIdx}
                                  href={seg.text}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#027eb5] dark:text-[#53bdeb] underline font-medium hover:opacity-80 break-all"
                                >
                                  {seg.text}
                                </a>
                              );
                            }
                            return <span key={sIdx}>{seg.text}</span>;
                          })}
                        </div>
                      );
                    })}
                  </div>

                  {/* Interactive Tracking Link Card if Link is Present */}
                  {(() => {
                    const trackingMatch = previewMessage.match(/https?:\/\/[^\s]+/);
                    const trackingUrl = trackingMatch ? trackingMatch[0] : null;
                    if (!trackingUrl) return null;

                    return (
                      <div
                        className={`mt-2.5 rounded-xl border p-2.5 flex items-center justify-between gap-2 transition-all ${isLightMode
                          ? 'bg-white/85 border-[#C4E8B5] text-zinc-900 shadow-sm'
                          : 'bg-black/30 border-[#027A64] text-white shadow-inner'
                          }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-7 w-7 rounded-lg bg-[#25D366]/20 border border-[#25D366]/30 flex items-center justify-center text-[#25D366] shrink-0">
                            <MapPin className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-bold block truncate">
                                Live Order Tracking Link
                              </span>
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            </div>
                            <span className="text-[10px] text-[#027eb5] dark:text-[#53bdeb] truncate block">
                              {trackingUrl}
                            </span>
                          </div>
                        </div>

                        <a
                          href={trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 px-2.5 py-1 rounded-lg bg-[#25D366] hover:bg-[#20ba5a] text-white text-[10px] font-bold flex items-center gap-1 shadow transition cursor-pointer active:scale-95"
                          title="Open live tracking URL in new tab"
                        >
                          <span>Open</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    );
                  })()}

                  {/* Timestamp & Delivery Double Ticks */}
                  <div className="mt-2 flex items-center justify-end gap-1 text-[10px] opacity-75">
                    <span>12:45 PM</span>
                    <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Test Send Footer */}
            <div className={`p-4 border-t space-y-2.5 ${subCardBg}`}>
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5">
                  <WhatsAppIcon className="h-4 w-4 text-[#25D366]" />
                  Test Live Message
                </span>
                <span className={`text-[10px] font-normal ${textSubtle}`}>
                  Opens real WhatsApp with preview text
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="tel"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="Test Phone (e.g. 9876543210)"
                  className={`flex-1 rounded-xl border px-3 py-2 text-xs font-mono focus:outline-none ${inputBg}`}
                />
                <button
                  type="button"
                  onClick={handleSendTestMessage}
                  style={{ color: '#ffffff' }}
                  className="flex items-center gap-1.5 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] px-3.5 py-2 text-xs font-bold shadow-md transition cursor-pointer active:scale-95"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Send</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
