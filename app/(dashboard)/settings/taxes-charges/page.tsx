'use client';

import TaxesChargesPanel from '@/components/settings/TaxesChargesPanel';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TaxesChargesPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link
          href="/settings?tab=taxes-charges"
          className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Settings</span>
        </Link>
      </div>
      <TaxesChargesPanel />
    </div>
  );
}
