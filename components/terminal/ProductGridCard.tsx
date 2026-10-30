'use client';

import React, { useState, useRef } from 'react';
import { Product } from '@/lib/mock-data';
import { useTerminalStore } from '@/store/useTerminalStore';
import { useTerminalDesignStore } from '@/store/useTerminalDesignStore';
import { getProductImageUrl } from '@/lib/product-image-helper';

interface ProductGridCardProps {
  product: Product;
  isActive?: boolean;
  onSelect?: () => void;
}

export default function ProductGridCard({ product, isActive: propIsActive, onSelect }: ProductGridCardProps) {
  const addToCart = useTerminalStore((state) => state.addToCart);
  const cart = useTerminalStore((state) => state.cart);
  
  const design = useTerminalDesignStore();
  const [localActive, setLocalActive] = useState(false);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  if (!product) return null;

  // Cart quantity for this item
  const cartItem = (cart || []).find((c) => c.product.id === product.id);
  const cartQty = cartItem ? cartItem.quantity : 0;

  const isActive = propIsActive || localActive;
  const imageUrl = getProductImageUrl(product);
  const currency = design.currencySymbol || '₹';

  // Handle tap / double tap
  const handleCardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onSelect?.();

    // Visual active highlight
    setLocalActive(true);
    setTimeout(() => setLocalActive(false), 900);

    if (design.quickDoubleTap) {
      if (clickTimeoutRef.current) {
        // Double tap detected
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
        addToCart(product);
        return;
      }

      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null;
        addToCart(product);
      }, 220);
    } else {
      addToCart(product);
    }
  };

  // Price badge style
  const getPriceBadgeClass = () => {
    switch (design.priceStyle) {
      case 'theme-accent':
        return 'price-badge preserve-white text-white shadow-md';
      case 'glass':
        return 'price-badge preserve-white backdrop-blur-md bg-black/60 text-white border border-white/20 shadow-md';
      case 'white':
        return 'price-badge price-badge-white bg-white text-zinc-950 border border-zinc-200/80 shadow-md font-extrabold';
      case 'dark-navy':
      default:
        return 'price-badge preserve-white bg-[#1e293b] text-white shadow-md';
    }
  };

  // Price badge position
  const getPricePositionClass = () => {
    switch (design.pricePlacement) {
      case 'bottom-left':
        return 'bottom-3 left-3';
      case 'top-right':
        return 'top-3 right-3';
      case 'bottom-right':
      default:
        return 'bottom-3 right-3';
    }
  };

  // Aspect ratio class
  const getAspectRatioClass = () => {
    switch (design.cardAspectRatio) {
      case '1/1':
        return 'aspect-square';
      case '16/10':
        return 'aspect-[16/10]';
      case '3/2':
        return 'aspect-[3/2]';
      case '4/3':
      default:
        return 'aspect-[4/3]';
    }
  };

  const dynamicActiveColor =
    design.activeBorderColor && design.activeBorderColor !== '#DB2777'
      ? design.activeBorderColor
      : 'var(--theme-active-border, #DB2777)';

  const activeBorderStyle = isActive
    ? {
        borderColor: dynamicActiveColor,
        boxShadow: `0 0 0 2px ${dynamicActiveColor}33, 0 8px 20px -4px var(--theme-glow, rgba(219,39,119,0.3))`,
      }
    : undefined;

  return (
    <div
      onClick={handleCardClick}
      style={activeBorderStyle}
      className={`group relative overflow-hidden select-none cursor-pointer transition-all duration-150 transform active:scale-[0.98] ${
        design.cardRadius || 'rounded-2xl'
      } ${getAspectRatioClass()} ${
        isActive
          ? 'border-[3px] border-theme z-10 scale-[1.01] shadow-theme-glow'
          : 'border border-zinc-800 hover:border-theme hover:shadow-xl bg-zinc-900 shadow-md'
      }`}
    >
      {/* Product Image filling the card */}
      <img
        src={imageUrl}
        alt={product.name || 'Product'}
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        onError={(e) => {
          // If image fails to load, fallback to a neutral food photo
          (e.target as HTMLImageElement).src =
            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';
        }}
      />

      {/* Cart Quantity Indicator (Top Left or Right) */}
      {design.showCartBadge && cartQty > 0 && (
        <div 
          className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 rounded-full bg-emerald-600/95 backdrop-blur-xs px-2.5 py-0.5 text-xs font-bold text-white preserve-white shadow-md animate-in fade-in zoom-in-95 duration-150"
          style={{ color: '#ffffff' }}
        >
          <span className="preserve-white" style={{ color: '#ffffff' }}>{cartQty} in cart</span>
        </div>
      )}

      {/* Product Name Display Placement */}
      {design.namePlacement === 'bottom-gradient' && (
        <div data-card-photo-overlay="true" className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent pt-8 pb-3 px-3 flex items-end justify-between pointer-events-none">
          <span 
            className="text-white preserve-white text-sm font-semibold tracking-tight drop-shadow-sm pr-20 line-clamp-1"
            style={{ color: '#ffffff' }}
          >
            {product.name}
          </span>
        </div>
      )}

      {design.namePlacement === 'bottom-bar' && (
        <div data-card-photo-overlay="true" className="absolute inset-x-0 bottom-0 bg-black/75 backdrop-blur-xs py-2 px-3 flex items-center justify-between pointer-events-none">
          <span 
            className="text-white preserve-white text-xs sm:text-sm font-medium truncate pr-16"
            style={{ color: '#ffffff' }}
          >
            {product.name}
          </span>
        </div>
      )}

      {design.namePlacement === 'top-badge' && (
        <div data-card-photo-overlay="true" className="absolute top-2.5 left-2.5 max-w-[70%] rounded-md bg-black/70 backdrop-blur-xs px-2 py-0.5 text-xs font-semibold text-white preserve-white truncate shadow-xs" style={{ color: '#ffffff' }}>
          {product.name}
        </div>
      )}

      {/* Price Badge (Exact placement & style matching reference image with guaranteed white text) */}
      <div
        data-price-pill="true"
        style={
          design.priceStyle === 'theme-accent'
            ? {
                backgroundColor:
                  design.accentColor && design.accentColor !== '#DB2777'
                    ? design.accentColor
                    : 'var(--theme-accent, #DB2777)',
                color: '#ffffff',
              }
            : design.priceStyle === 'white'
            ? { color: '#0f172a', backgroundColor: '#ffffff' }
            : { color: '#ffffff', backgroundColor: '#1e293b' }
        }
        className={`absolute ${getPricePositionClass()} z-10 rounded-lg px-2.5 py-1 text-sm sm:text-base font-bold tracking-tight transition-transform duration-150 group-hover:scale-105 ${getPriceBadgeClass()}`}
      >
        <span
          className={design.priceStyle === 'white' ? 'text-zinc-950 font-black' : 'text-white preserve-white font-bold'}
          style={{ color: design.priceStyle === 'white' ? '#0f172a' : '#ffffff' }}
        >
          {currency}
          {Number(product.price || 0).toFixed(product.price % 1 === 0 ? 0 : 2)}
        </span>
      </div>
    </div>
  );
}
