'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Truck,
  ExternalLink,
  Copy,
  Check,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  Package,
  Bike
} from 'lucide-react';
import { DeliveryStatus } from '@/types/delivery';
import { updateDeliveryStatus } from '@/lib/actions/db';

interface DeliveryStatusDropdownProps {
  delivery?: {
    id?: string;
    deliveryStatus?: string;
    assignmentStatus?: string;
    trackingToken?: string;
    deliveryPersonName?: string;
    deliveryPersonPhone?: string;
  };
  billId: string;
  onStatusUpdated?: () => void;
}

const ALL_STATUSES: {
  key: DeliveryStatus;
  label: string;
  color: string;
  icon: React.ElementType;
}[] = [
  { key: 'pending', label: 'Pending', color: 'border-pink-400 dark:border-pink-500/60 text-pink-600 dark:text-pink-400 bg-transparent', icon: Clock },
  { key: 'assigned', label: 'Assigned', color: 'border-blue-400 dark:border-blue-500/60 text-blue-600 dark:text-blue-400 bg-transparent', icon: User },
  { key: 'accepted', label: 'Accepted', color: 'border-sky-400 dark:border-sky-500/60 text-sky-600 dark:text-sky-400 bg-transparent', icon: CheckCircle2 },
  { key: 'preparing', label: 'Preparing', color: 'border-indigo-400 dark:border-indigo-500/60 text-indigo-600 dark:text-indigo-400 bg-transparent', icon: Package },
  { key: 'ready_for_pickup', label: 'Ready for Pickup', color: 'border-teal-400 dark:border-teal-500/60 text-teal-600 dark:text-teal-400 bg-transparent', icon: Package },
  { key: 'picked_up', label: 'Picked Up', color: 'border-purple-400 dark:border-purple-500/60 text-purple-600 dark:text-purple-400 bg-transparent', icon: Bike },
  { key: 'out_for_delivery', label: 'Out for Delivery', color: 'border-purple-400 dark:border-purple-500/60 text-purple-600 dark:text-purple-400 bg-transparent', icon: Bike },
  { key: 'delivered', label: 'Delivered', color: 'border-emerald-400 dark:border-emerald-500/60 text-emerald-600 dark:text-emerald-400 bg-transparent', icon: CheckCircle2 },
  { key: 'cancelled', label: 'Cancelled', color: 'border-rose-400 dark:border-rose-500/60 text-rose-600 dark:text-rose-400 bg-transparent', icon: XCircle },
];

export default function DeliveryStatusDropdown({
  delivery,
  billId,
  onStatusUpdated,
}: DeliveryStatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>(delivery?.deliveryStatus || 'pending');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (delivery?.deliveryStatus) {
      setCurrentStatus(delivery.deliveryStatus);
    }
  }, [delivery?.deliveryStatus]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeStatusConfig = ALL_STATUSES.find((s) => s.key === currentStatus) || {
    key: 'pending' as DeliveryStatus,
    label: currentStatus.replace(/_/g, ' '),
    color: 'border-pink-400 dark:border-pink-500/60 text-pink-600 dark:text-pink-400 bg-transparent',
    icon: Truck,
  };
  const StatusIcon = activeStatusConfig.icon;

  const handleSelectStatus = async (status: DeliveryStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!delivery?.id) {
      alert('Delivery ID not found for this bill.');
      return;
    }
    if (status === currentStatus) {
      setIsOpen(false);
      return;
    }

    setIsUpdating(true);
    try {
      const res = await updateDeliveryStatus(delivery.id, status);
      if (res && res.success) {
        setCurrentStatus(status);
        setIsOpen(false);
        onStatusUpdated?.();
      } else {
        alert('Failed to update delivery status: ' + (res?.error || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Error updating status: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCopyTrackingLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!delivery?.trackingToken) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const trackingUrl = `${origin}/delivery/track/${delivery.trackingToken}`;
    navigator.clipboard.writeText(trackingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* 1. Consistent Status Trigger Button (Matches COMPLETED pill styling) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        disabled={isUpdating}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer hover:opacity-80 active:scale-95 bg-transparent ${activeStatusConfig.color}`}
        title="Click to change delivery status or access tracking link"
      >
        <StatusIcon className={`h-3 w-3 shrink-0 ${isUpdating ? 'animate-spin' : ''}`} />
        <span className="uppercase">{activeStatusConfig.label}</span>
        <ChevronDown className={`h-3 w-3 opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Rider name subtitle if assigned */}
      <div className="text-[10px] text-zinc-400 mt-0.5 truncate max-w-[130px]">
        {delivery?.deliveryPersonName ? (
          <span className="text-zinc-300">Rider: {delivery.deliveryPersonName}</span>
        ) : (
          <span className="text-pink-500/90 dark:text-pink-400/90 font-medium">Pending Rider</span>
        )}
      </div>

      {/* 2. Interactive Status & Tracking Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute left-0 mt-1.5 w-60 rounded-2xl border border-zinc-800 bg-zinc-950 p-2.5 shadow-2xl z-50 text-white animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-2 py-1.5 border-b border-zinc-800/80 mb-2">
            <div className="flex items-center justify-between text-xs font-bold text-white">
              <span className="flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-indigo-400" />
                Delivery Status
              </span>
              <span className="text-[10px] font-mono text-zinc-400">#{billId}</span>
            </div>
            {delivery?.deliveryPersonName ? (
              <p className="text-[11px] text-zinc-400 mt-1">
                Rider: <span className="font-semibold text-zinc-200">{delivery.deliveryPersonName}</span>
                {delivery.deliveryPersonPhone && ` (${delivery.deliveryPersonPhone})`}
              </p>
            ) : (
              <p className="text-[11px] text-amber-400/90 font-medium mt-1">
                ⚠️ Pending Rider Assignment
              </p>
            )}
          </div>

          {/* 9 Status Choices */}
          <div className="space-y-1 max-h-56 overflow-y-auto no-scrollbar">
            {ALL_STATUSES.map((item) => {
              const isSelected = item.key === currentStatus;
              const ItemIcon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={(e) => handleSelectStatus(item.key, e)}
                  disabled={isUpdating}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'hover:bg-zinc-900 text-zinc-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ItemIcon className="h-3.5 w-3.5 text-zinc-400" />
                    <span>{item.label}</span>
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                </button>
              );
            })}
          </div>

          {/* Access to Customer Tracking Link */}
          {delivery?.trackingToken && (
            <div className="mt-2.5 pt-2 border-t border-zinc-800/80 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block px-1">
                Customer Tracking
              </span>

              <a
                href={`/delivery/track/${delivery.trackingToken}`}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-300 text-xs font-bold transition shadow-sm"
              >
                <div className="flex items-center gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open Live Tracker</span>
                </div>
                <span className="text-[10px] text-cyan-400/80">New Tab</span>
              </a>

              <button
                type="button"
                onClick={handleCopyTrackingLink}
                className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-bold transition cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied Tracking Link!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Copy Customer Link</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
