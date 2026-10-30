'use client';

import React, { useState, useEffect, use } from 'react';
import {
  Truck,
  CheckCircle2,
  Clock,
  Package,
  MapPin,
  Phone,
  Navigation,
  AlertCircle,
  Building2,
  RefreshCw,
  ChefHat,
  Bike,
  ShieldCheck,
  Check,
  XCircle,
  Calendar
} from 'lucide-react';

interface TrackingData {
  billId: string;
  orderSource: string;
  onlineOrderId?: string | null;
  trackingToken: string;
  customerName: string;
  customerPhoneMasked: string;
  deliveryAddress: string;
  deliveryStatus: string;
  assignmentStatus: string;
  orderTime: number | null;
  assignedAt: number | null;
  pickedUpAt: number | null;
  deliveredAt: number | null;
  deliveryNotes?: string | null;
  statusHistory: Array<{ status: string; timestamp: number; note?: string }>;
  latitude: number | null;
  longitude: number | null;
  locationUpdatedAt: number | null;
  rider: { name: string; phone: string | null } | null;
  company: { name: string; phone: string; address: string };
  items: Array<{ name: string; quantity: number; price: number }>;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
}

const STATUS_STEPS = [
  { key: 'pending', label: 'Order Placed', desc: 'Received & queued for processing', icon: Clock },
  { key: 'assigned', label: 'Rider Assigned', desc: 'Assigned to delivery staff', icon: Bike },
  { key: 'preparing', label: 'Preparing Food', desc: 'Kitchen is preparing your order', icon: ChefHat },
  { key: 'out_for_delivery', label: 'Out for Delivery', desc: 'Rider is on the way', icon: Truck },
  { key: 'delivered', label: 'Delivered', desc: 'Order successfully delivered', icon: CheckCircle2 },
];

export default function DeliveryTrackingPage(props: { params: Promise<{ token: string }> }) {
  const { token } = use(props.params);
  const [data, setData] = useState<TrackingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchTracking = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const res = await fetch(`/api/delivery/track/${token}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Tracking link is invalid or expired.');
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load tracking information');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTracking();
    const interval = setInterval(() => fetchTracking(true), 10000);
    return () => clearInterval(interval);
  }, [token]);

  const getStepState = (stepKey: string, currentStatus: string) => {
    const statusOrder = ['pending', 'assigned', 'accepted', 'preparing', 'ready_for_pickup', 'picked_up', 'out_for_delivery', 'in_transit', 'delivered'];
    const normCurrent = currentStatus === 'in_transit' ? 'out_for_delivery' : currentStatus;
    const currentIdx = statusOrder.indexOf(normCurrent);
    const stepIdx = statusOrder.indexOf(stepKey);

    if (currentStatus === 'cancelled' || currentStatus === 'failed') {
      return 'cancelled';
    }
    if (stepIdx <= currentIdx && currentIdx >= 0) {
      return stepIdx === currentIdx ? 'active' : 'completed';
    }
    return 'upcoming';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6">
        <RefreshCw className="h-10 w-10 text-pink-500 animate-spin mb-4" />
        <h2 className="text-lg font-bold">Connecting to Live Tracking...</h2>
        <p className="text-xs text-zinc-400 mt-1">Retrieving order status and location from restaurant</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl bg-zinc-900 border border-zinc-800 p-8 text-center space-y-4 shadow-2xl">
          <div className="h-14 w-14 rounded-full bg-red-950/60 border border-red-800 text-red-400 flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Tracking Link Unavailable</h2>
          <p className="text-xs text-zinc-400">{error || 'Could not locate delivery information.'}</p>
          <button
            onClick={() => fetchTracking()}
            className="rounded-xl bg-pink-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-pink-500 transition cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const isCancelled = data.deliveryStatus === 'cancelled' || data.deliveryStatus === 'failed';
  const isDelivered = data.deliveryStatus === 'delivered';
  const hasLiveGps = data.latitude !== null && data.longitude !== null && data.locationUpdatedAt && (Date.now() - data.locationUpdatedAt < 1800000);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 sm:p-6 md:p-10 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-6">
        {/* Restaurant Header */}
        <div className="rounded-3xl border border-pink-500/20 bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-pink-950/30 p-6 shadow-2xl relative overflow-hidden backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-pink-600/20 border border-pink-500/40 text-pink-400 flex items-center justify-center font-black shadow-lg">
                <Truck className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-black text-white">{data.company.name}</h1>
                  <span className="rounded-full bg-pink-500/10 border border-pink-500/30 px-2 py-0.5 text-[10px] font-bold text-pink-400">
                    {data.orderSource}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                  Order #{data.billId} {data.onlineOrderId ? `(${data.onlineOrderId})` : ''}
                </p>
              </div>
            </div>

            <button
              onClick={() => fetchTracking(true)}
              className="flex items-center gap-1 rounded-xl bg-zinc-800/80 border border-zinc-700/60 px-3 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-zinc-700 transition"
              title="Refresh tracking status"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-pink-400' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Live Status Banner */}
        <div className={`rounded-3xl border p-6 shadow-xl ${
          isCancelled
            ? 'border-red-900/50 bg-red-950/30'
            : isDelivered
            ? 'border-emerald-900/50 bg-emerald-950/30'
            : 'border-pink-900/40 bg-zinc-900/80'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Current Status</div>
              <div className="text-2xl font-black text-white mt-1 capitalize flex items-center gap-2">
                <span>{data.deliveryStatus.replace('_', ' ')}</span>
                {!isDelivered && !isCancelled && (
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500"></span>
                  </span>
                )}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[11px] font-semibold text-zinc-400">Order Placed</div>
              <div className="text-xs font-mono text-zinc-300 mt-0.5">
                {data.orderTime ? new Date(data.orderTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
              </div>
            </div>
          </div>

          {/* Stepper Timeline */}
          <div className="mt-8 space-y-4">
            {STATUS_STEPS.map((step, idx) => {
              const state = getStepState(step.key, data.deliveryStatus);
              const Icon = step.icon;
              const isLast = idx === STATUS_STEPS.length - 1;

              // Find timestamp from status history if exists
              const historyItem = data.statusHistory?.find((h) => h.status === step.key);

              return (
                <div key={step.key} className="flex items-start gap-4 relative">
                  {/* Vertical line connecting steps */}
                  {!isLast && (
                    <div
                      className={`absolute left-5 top-10 bottom-0 w-0.5 -ml-px ${
                        state === 'completed' ? 'bg-pink-500' : 'bg-zinc-800'
                      }`}
                    />
                  )}

                  <div
                    className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 border z-10 transition-all ${
                      state === 'completed'
                        ? 'bg-pink-600 border-pink-500 text-white shadow-lg shadow-pink-600/30'
                        : state === 'active'
                        ? 'bg-pink-950/80 border-pink-400 text-pink-300 animate-pulse ring-2 ring-pink-500/40'
                        : state === 'cancelled'
                        ? 'bg-zinc-900 border-zinc-800 text-zinc-600'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                    }`}
                  >
                    {state === 'completed' ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>

                  <div className="flex-1 pb-4">
                    <div className="flex items-center justify-between">
                      <div className={`font-bold text-sm ${state === 'active' ? 'text-pink-300' : state === 'completed' ? 'text-white' : 'text-zinc-500'}`}>
                        {step.label}
                      </div>
                      {historyItem && (
                        <span className="text-[10px] font-mono text-zinc-400">
                          {new Date(historyItem.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">{step.desc}</div>
                    {historyItem?.note && (
                      <div className="text-[11px] text-pink-400/90 italic mt-1 bg-zinc-900/60 rounded px-2 py-0.5 w-fit border border-zinc-800">
                        {historyItem.note}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Delivery Staff & Contact Card */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6 space-y-4 shadow-xl">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-pink-400" />
            <span>Assigned Delivery Staff</span>
          </div>

          {data.rider ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center font-bold text-lg">
                  {data.rider.name[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-white text-base">Rider {data.rider.name}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">Assigned Delivery Partner</div>
                </div>
              </div>

              {data.rider.phone && (
                <a
                  href={`tel:${data.rider.phone}`}
                  className="flex items-center gap-2 rounded-xl bg-pink-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-pink-500 transition shadow-lg shadow-pink-600/30"
                >
                  <Phone className="h-4 w-4" />
                  <span>Call Rider</span>
                </a>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-900/40 bg-amber-950/20 p-4 text-xs text-amber-300 flex items-center gap-2.5">
              <Clock className="h-4 w-4 shrink-0 text-amber-400" />
              <span>Awaiting delivery partner assignment from the store. You will see rider details once assigned.</span>
            </div>
          )}
        </div>

        {/* GPS Tracking Information Card */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6 space-y-3 shadow-xl">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Navigation className="h-3.5 w-3.5 text-pink-400" />
              Live Delivery GPS Location
            </span>
            {hasLiveGps ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live GPS Broadcast
              </span>
            ) : (
              <span className="rounded-full bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-[10px] font-bold text-zinc-400">
                Device Inactive
              </span>
            )}
          </div>

          {hasLiveGps ? (
            <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/20 p-4 space-y-2">
              <div className="text-xs font-bold text-emerald-300 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-400" />
                <span>Rider GPS Coordinates: {data.latitude?.toFixed(5)}, {data.longitude?.toFixed(5)}</span>
              </div>
              <div className="text-[11px] text-zinc-400">
                Last broadcast: {new Date(data.locationUpdatedAt!).toLocaleTimeString()}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-400 flex items-start gap-2.5">
              <MapPin className="h-4 w-4 shrink-0 text-zinc-500 mt-0.5" />
              <div>
                <p className="font-semibold text-zinc-300">Live GPS Location Currently Unavailable</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  The delivery staff member has not enabled device GPS broadcast or is currently preparing your order.
                  Milestone status updates above remain 100% synchronized in real time.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Order Details & Delivery Address */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6 space-y-4 shadow-xl">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5 text-pink-400" />
            <span>Order Summary</span>
          </div>

          <div className="space-y-2.5 divide-y divide-zinc-800/60">
            {data.items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between pt-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-pink-400">{item.quantity}x</span>
                  <span className="font-medium text-white">{item.name}</span>
                </div>
                <div className="font-mono text-zinc-300">₹{(item.price * item.quantity).toFixed(2)}</div>
              </div>
            ))}
          </div>

          <div className="border-t border-zinc-800 pt-3 flex items-center justify-between text-sm">
            <span className="font-bold text-zinc-300">Total Amount ({data.paymentMethod})</span>
            <span className="font-mono font-black text-pink-400 text-base">₹{data.total.toFixed(2)}</span>
          </div>

          <div className="border-t border-zinc-800 pt-3 text-xs text-zinc-400 space-y-1">
            <div className="font-semibold text-zinc-300">Delivering To:</div>
            <div className="text-zinc-400">{data.deliveryAddress}</div>
            <div className="text-[11px] text-zinc-500">Contact: {data.customerName} ({data.customerPhoneMasked})</div>
          </div>
        </div>
      </div>
    </div>
  );
}
