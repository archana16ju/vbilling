'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  User,
  MapPin,
  Bike,
  Truck,
  Copy,
  CheckCircle2,
  ExternalLink,
  Printer,
  Share2,
  AlertCircle,
  FileText,
  Check,
  Receipt,
  MessageSquare,
} from 'lucide-react';

export interface DeliveryConfirmationData {
  billId: string;
  orderSource?: string;
  platform?: 'Delivery' | 'Zomato' | 'Swiggy' | string;
  onlineOrderId?: string;
  status: 'assigned' | 'unassigned' | string;
  deliveryPerson?: {
    name: string;
    phone: string;
    id?: string;
  } | null;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  deliveryNotes?: string;
  total?: number;
  paymentMethod?: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
  trackingToken?: string | null;
}

interface DeliveryConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: DeliveryConfirmationData | null;
  companyName?: string;
  onPrint?: () => void;
}

// Custom crisp WhatsApp icon
function WhatsAppIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      className={className}
    >
      <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.993.587 1.83.896 2.796.896 3.181 0 5.767-2.587 5.767-5.766.001-3.182-2.585-5.783-5.767-5.783zm3.435 8.167c-.145.408-.842.766-1.16.804-.319.038-.727.182-2.361-.502-1.996-.837-3.267-2.884-3.367-3.018-.099-.134-.808-1.074-.808-2.049 0-.974.51-1.452.691-1.651.182-.2.398-.249.531-.249.133 0 .266.001.382.007.123.006.287-.046.45.344.164.39.562 1.371.611 1.472.049.1.082.219.016.353-.066.134-.099.219-.198.334-.099.117-.21.261-.3.351-.101.1-.205.21-.088.411.117.201.521.859 1.118 1.391.768.684 1.416.896 1.617.996.201.1.319.083.436-.051.117-.134.502-.584.635-.785.133-.201.266-.168.45-.1.183.067 1.164.55 1.365.65.201.1.334.15.383.234.049.083.049.484-.096.892z" />
    </svg>
  );
}

import {
  formatWhatsAppDeliveryMessage,
  sanitizeWhatsAppPhone,
  parseWhatsAppLine,
} from '@/lib/whatsapp-helper';
import { WhatsAppSettings, DEFAULT_WHATSAPP_SETTINGS } from '@/types/whatsapp';

export default function DeliveryConfirmationModal({
  isOpen,
  onClose,
  data,
  companyName = 'SK Briyani',
  onPrint,
}: DeliveryConfirmationModalProps) {
  const [whatsAppSettings, setWhatsAppSettings] = useState<WhatsAppSettings>(DEFAULT_WHATSAPP_SETTINGS);
  const [phoneToShare, setPhoneToShare] = useState('');
  const [copied, setCopied] = useState(false);
  const [riderCopied, setRiderCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isEditingMsg, setIsEditingMsg] = useState(false);
  const [customMsgText, setCustomMsgText] = useState('');

  // Fetch or load active WhatsApp settings
  useEffect(() => {
    if (!isOpen) return;

    // 1. Instant cache check
    try {
      const cached = localStorage.getItem('whatsapp_settings');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed.isEnabled === 'boolean') {
          setWhatsAppSettings({ ...DEFAULT_WHATSAPP_SETTINGS, ...parsed });
        }
      }
    } catch {}

    // 2. Fresh fetch from settings API
    fetch('/api/settings/whatsapp')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.settings) {
          const merged = { ...DEFAULT_WHATSAPP_SETTINGS, ...json.settings };
          setWhatsAppSettings(merged);
          try {
            localStorage.setItem('whatsapp_settings', JSON.stringify(merged));
          } catch {}
        }
      })
      .catch(() => {});
  }, [isOpen]);

  // Compute message formatted with settings
  useEffect(() => {
    if (data) {
      setPhoneToShare(data.customerPhone || '');
      const formatted = formatWhatsAppDeliveryMessage(
        {
          billId: data.billId,
          companyName,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          deliveryAddress: data.deliveryAddress,
          deliveryNotes: data.deliveryNotes,
          deliveryPerson: data.deliveryPerson,
          status: data.status,
          total: data.total,
          paymentMethod: data.paymentMethod,
          items: data.items,
          trackingToken: data.trackingToken,
          platform: data.platform || data.orderSource,
        },
        whatsAppSettings,
        typeof window !== 'undefined' ? window.location.origin : ''
      );
      setCustomMsgText(formatted);
    } else {
      setPhoneToShare('');
      setCustomMsgText('');
    }
    setCopied(false);
    setRiderCopied(false);
    setShowPreview(false);
    setIsEditingMsg(false);
  }, [data, whatsAppSettings, companyName]);

  // Handle Enter/Escape keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !data) return null;

  const isAssigned = data.status === 'assigned' && !!data.deliveryPerson?.name;
  const activeMessage = customMsgText;

  const handleSendWhatsApp = () => {
    const targetPhone = phoneToShare.trim() || data.customerPhone?.trim() || '';
    const formatted = sanitizeWhatsAppPhone(targetPhone, whatsAppSettings.defaultCountryCode);
    const encoded = encodeURIComponent(activeMessage);

    if (formatted) {
      window.open(`https://wa.me/${formatted}?text=${encoded}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    }
  };

  const handleSendRiderWhatsApp = () => {
    const riderPhone = data.deliveryPerson?.phone?.trim() || '';
    const formatted = sanitizeWhatsAppPhone(riderPhone, whatsAppSettings.defaultCountryCode);
    const encoded = encodeURIComponent(activeMessage);

    if (formatted) {
      window.open(`https://wa.me/${formatted}?text=${encoded}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    }
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(activeMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const handleCopyRiderMessage = async () => {
    try {
      await navigator.clipboard.writeText(activeMessage);
      setRiderCopied(true);
      setTimeout(() => setRiderCopied(false), 2500);
    } catch {
      setRiderCopied(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-900 shadow-2xl p-6 text-white animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-md"
              style={{
                backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                borderColor: 'var(--theme-active-border, rgba(219,39,119,0.35))',
                color: 'var(--theme-accent, #DB2777)',
              }}
            >
              <Bike className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Delivery Order #{data.billId} {isAssigned ? 'Confirmed!' : 'Saved!'}
                </h3>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {isAssigned
                  ? 'Assigned to delivery staff & ready for dispatch'
                  : 'Order recorded in delivery queue (staff unassigned)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="mt-4 space-y-3.5">
          {/* Main Delivery Info Card (Exact match of delivery message) */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 space-y-3">
            {/* Status & Assigned Staff Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
              <div>
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-0.5">
                  Assigned Staff
                </span>
                {isAssigned ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      {data.deliveryPerson?.name}
                    </span>
                    {data.deliveryPerson?.phone && (
                      <span className="text-xs text-zinc-400 font-mono">
                        ({data.deliveryPerson.phone})
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-sm font-semibold text-amber-400">
                    No staff assigned (Unassigned)
                  </span>
                )}
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                {isAssigned ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/20 text-emerald-400 border border-emerald-500/30">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    Status: Assigned
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-950/20 text-amber-400 border border-amber-500/30">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Status: Unassigned
                  </span>
                )}

                {data.platform && data.platform !== 'Delivery' && (
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                      data.platform === 'Zomato'
                        ? 'bg-red-500/20 text-red-300 border-red-500/30'
                        : data.platform === 'Swiggy'
                        ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                        : 'bg-zinc-800 text-zinc-200 border-zinc-700'
                    }`}
                  >
                    {data.platform}
                  </span>
                )}
              </div>
            </div>

            {/* Customer & Address Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-zinc-500 block mb-0.5">Customer & Phone:</span>
                <div className="flex items-center gap-1.5 font-semibold text-zinc-200">
                  <User className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                  <span>{data.customerName || 'Walk-in Customer'}</span>
                </div>
                {data.customerPhone && (
                  <div className="flex items-center gap-1.5 text-zinc-400 mt-0.5 font-mono">
                    <Phone className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                    <span>{data.customerPhone}</span>
                  </div>
                )}
              </div>

              <div>
                <span className="text-zinc-500 block mb-0.5">Order Amount:</span>
                <div className="font-bold text-white text-sm">
                  ₹{Number(data.total || 0).toFixed(2)}
                  <span className="ml-1.5 text-xs font-medium text-zinc-400">
                    ({data.paymentMethod || 'Cash'})
                  </span>
                </div>
                {data.items && data.items.length > 0 && (
                  <span className="text-[11px] text-zinc-500">
                    {data.items.reduce((acc, i) => acc + (i.quantity || 1), 0)} items ordered
                  </span>
                )}
              </div>
            </div>

            {data.deliveryAddress && (
              <div className="pt-2 border-t border-zinc-800/60 text-xs">
                <span className="text-zinc-500 block mb-0.5">Delivery Address:</span>
                <div className="flex items-start gap-1.5 text-zinc-300">
                  <MapPin className="h-3.5 w-3.5 text-zinc-500 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{data.deliveryAddress}</span>
                </div>
              </div>
            )}
          </div>

          {/* WhatsApp Share to Customer Box */}
          <div
            className="rounded-2xl border p-4 transition-all"
            style={{
              backgroundColor: 'rgba(37, 211, 102, 0.06)',
              borderColor: 'rgba(37, 211, 102, 0.28)',
            }}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-[#25D366]/20 border border-[#25D366]/40 flex items-center justify-center text-[#25D366]">
                  <WhatsAppIcon className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      Share on WhatsApp to Customer
                    </h4>
                    {!whatsAppSettings.isEnabled && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Disabled in Settings
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Send order details & status to customer linked phone number
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {showPreview && whatsAppSettings.allowCashierEdit && (
                  <button
                    type="button"
                    onClick={() => setIsEditingMsg(!isEditingMsg)}
                    className="text-[11px] text-[#25D366] hover:underline cursor-pointer"
                  >
                    {isEditingMsg ? 'Done editing' : 'Edit text'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-[11px] text-zinc-400 hover:text-white underline cursor-pointer"
                >
                  {showPreview ? 'Hide preview' : 'Preview msg'}
                </button>
              </div>
            </div>

            {/* Customer Linked Phone Input & Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
              <div className="relative flex-1">
                <Phone className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                <input
                  type="tel"
                  placeholder="Customer Phone (e.g. 9876543210)"
                  value={phoneToShare}
                  onChange={(e) => setPhoneToShare(e.target.value)}
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-700 pl-8 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#25D366] transition font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  style={{ color: '#ffffff' }}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] px-4 py-2 text-xs font-bold shadow-md shadow-[#25D366]/20 transition cursor-pointer active:scale-95"
                  title="Open WhatsApp chat with prefilled message"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  <span>Send WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer active:scale-95"
                  title="Copy formatted message text"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Optional Rider WhatsApp Dispatch Row */}
            {whatsAppSettings.sendToRider && isAssigned && data.deliveryPerson?.phone && (
              <div className="mt-2.5 pt-2 border-t border-[#25D366]/20 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-zinc-300 text-[11px]">
                  <Bike className="h-3.5 w-3.5 text-[#25D366]" />
                  <span>Rider: <strong>{data.deliveryPerson.name}</strong> ({data.deliveryPerson.phone})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleSendRiderWhatsApp}
                    style={{ color: '#ffffff' }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-[11px] font-bold text-white transition cursor-pointer"
                  >
                    <WhatsAppIcon className="h-3 w-3" />
                    <span>WhatsApp Rider</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyRiderMessage}
                    className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
                    title="Copy message for rider"
                  >
                    {riderCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            )}

            {/* Optional Collapsible Message Preview / Editor */}
            {showPreview && (
              <div className="mt-3">
                {isEditingMsg && whatsAppSettings.allowCashierEdit ? (
                  <textarea
                    rows={6}
                    value={customMsgText}
                    onChange={(e) => setCustomMsgText(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-[11px] font-mono text-zinc-200 focus:outline-none focus:border-[#25D366] leading-relaxed no-scrollbar"
                  />
                ) : (
                  <div className="p-3 rounded-xl bg-zinc-950/90 border border-zinc-800 text-[11px] font-sans text-zinc-200 max-h-48 overflow-y-auto no-scrollbar leading-relaxed space-y-1">
                    {activeMessage.split('\n').map((line, lIdx) => {
                      if (!line.trim()) return <div key={lIdx} className="h-1" />;
                      const segs = parseWhatsAppLine(line);
                      return (
                        <div key={lIdx} className="leading-snug">
                          {segs.map((s, sIdx) => {
                            if (s.isBold) {
                              return (
                                <strong key={sIdx} className="font-bold text-white">
                                  {s.text}
                                </strong>
                              );
                            }
                            if (s.isUrl) {
                              return (
                                <a
                                  key={sIdx}
                                  href={s.text}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#34B7F1] underline font-medium break-all"
                                >
                                  {s.text}
                                </a>
                              );
                            }
                            return <span key={sIdx}>{s.text}</span>;
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="mt-5 flex items-center justify-between gap-3 pt-3 border-t border-zinc-800">
          {onPrint ? (
            <button
              type="button"
              onClick={onPrint}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Print Receipt</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              style={{ color: '#ffffff' }}
              className="flex items-center gap-1.5 rounded-xl btn-theme-primary px-7 py-2.5 text-xs font-bold text-white shadow-lg shadow-theme-glow transition cursor-pointer active:scale-95"
            >
              <Check className="h-4 w-4" />
              <span>OK</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
