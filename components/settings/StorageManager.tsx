'use client'

import { useState, useEffect } from 'react'
import { HardDrive, RefreshCw, Trash2, Database as DbIcon, Search, Calendar, FileText } from 'lucide-react'

export default function StorageManager() {
  const [stats, setStats] = useState<any>(null)
  const [isChangingLocation, setIsChangingLocation] = useState(false)
  const [newLocation, setNewLocation] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null)

  // Local Bills Viewer State
  const [bills, setBills] = useState<any[]>([])
  const [isViewingBills, setIsViewingBills] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [isViewingImages, setIsViewingImages] = useState(false)

  const getStorageUrl = (endpoint: string) => {
    const isLocalMode = process.env.NEXT_PUBLIC_LOCAL_DB_MODE === 'mysql';
    const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron');
    const baseUrl = isLocalMode ? '' : (isElectron ? 'http://localhost:3015' : '');
    return `${baseUrl}/api/storage/${endpoint}`;
  };

  const loadStats = async () => {
    try {
      const res = await fetch(getStorageUrl('stats'));
      if (!res.ok) throw new Error('Failed to load storage data');
      const data = await res.json();
      setStats(data);
      setNewLocation(data.location || '');
    } catch (e: any) {
      console.error(e);
      setMessage({ type: 'error', text: 'Error loading storage stats. Please restart the software.' });
      setStats({ error: true, details: e.message || 'Unknown network error' }); // Prevent infinite null loading
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  const handleUpdateLocation = async () => {
    if (!newLocation.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch(getStorageUrl('config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: newLocation })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Storage location updated successfully.' })
        setIsChangingLocation(false)
        loadStats()
      } else {
        setMessage({ type: 'error', text: 'Failed to update location.' })
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'System error' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearCache = async () => {
    if (!confirm('Are you sure? This will delete cached images but pending bills will be safe.')) return;
    setIsLoading(true);
    try {
      const res = await fetch(getStorageUrl('clear'), { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Cache cleared successfully.' })
        loadStats()
      } else {
        setMessage({ type: 'error', text: 'Failed to clear cache.' })
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'System error' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewBills = async () => {
    if (isViewingBills) {
      setIsViewingBills(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(getStorageUrl('allBills'));
      const data = await res.json();
      setBills(data);
      setIsViewingBills(true);
    } catch (e) {
      console.error(e);
      setMessage({ type: 'error', text: 'Failed to load local bills.' });
    } finally {
      setIsLoading(false);
    }
  }
  
  if (!stats) return <div className="p-8 text-center text-zinc-500 animate-pulse">Loading local storage data...</div>;
  if (stats.error) return (
    <div className="p-8 text-center text-red-500 border border-red-200 bg-red-50 rounded-lg">
      <div className="font-bold mb-2">Failed to load storage data. The internal backend server may have crashed.</div>
      <div className="text-sm font-mono text-left bg-white/50 p-4 rounded border border-red-100 overflow-auto">
        Error Details: {stats.details || 'Check network connection or permissions'}
      </div>
      <div className="mt-4 text-sm text-red-600">Please take a screenshot of this error and share it.</div>
    </div>
  );

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-xl text-white">
      <div className="flex items-center gap-3 mb-6">
        <div className="rounded-xl bg-pink-500/10 border border-pink-500/30 p-2.5 text-pink-400">
          <HardDrive className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Local Temporary Storage</h2>
          <p className="text-xs text-zinc-400">Manage offline bills and cached product images for this device.</p>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-xl text-xs font-semibold border ${message.type === 'error' ? 'bg-rose-950/50 text-rose-300 border-rose-800/60' : 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-zinc-900/90 p-5 rounded-2xl mb-6 border border-zinc-800">
        <div className="flex justify-between items-start mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Current Storage Path</span>
          {!isChangingLocation && (
            <button 
              onClick={() => setIsChangingLocation(true)}
              className="text-xs font-bold text-pink-400 hover:text-pink-300 transition cursor-pointer"
            >
              Change Location
            </button>
          )}
        </div>
        
        {isChangingLocation ? (
          <div className="flex gap-2 mt-2">
            <input 
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
              placeholder="e.g. D:\BillingOfflineStorage"
            />
            <button 
              onClick={handleUpdateLocation}
              disabled={isLoading}
              className="btn-theme-primary text-white font-bold px-4 py-2 rounded-xl text-xs disabled:opacity-50 transition cursor-pointer shadow-md"
            >
              Save
            </button>
            <button 
              onClick={() => { setIsChangingLocation(false); setNewLocation(stats.location); }}
              className="px-4 py-2 text-zinc-400 text-xs font-bold hover:text-white hover:bg-zinc-800 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 mt-4">
            <div className="flex items-center justify-between bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
              <span className="text-xs font-bold text-zinc-300">Total Local Storage Used:</span>
              <span className="text-sm font-bold text-pink-400">
                {stats.usedBytes > 1024 * 1024 
                  ? `${(stats.usedBytes / (1024 * 1024)).toFixed(2)} MB` 
                  : `${(stats.usedBytes / 1024).toFixed(2)} KB`}
              </span>
            </div>
            
            {stats.folderDetails && stats.folderDetails.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950">
                <table className="min-w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-zinc-900/90 text-zinc-400 border-b border-zinc-800">
                    <tr>
                      <th className="px-3 py-2.5 font-bold uppercase tracking-wider text-[10px]">Folder/File</th>
                      <th className="px-3 py-2.5 font-bold uppercase tracking-wider text-[10px]">Path</th>
                      <th className="px-3 py-2.5 font-bold uppercase tracking-wider text-[10px] text-right">Size</th>
                      <th className="px-3 py-2.5 font-bold uppercase tracking-wider text-[10px] text-center">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {stats.folderDetails.map((f: any, i: number) => (
                      <tr key={i} className="hover:bg-zinc-900/50 transition">
                        <td className="px-3 py-2 font-medium text-white">{f.name}</td>
                        <td className="px-3 py-2 text-zinc-400 font-mono text-[11px]" title={f.path}>{f.path}</td>
                        <td className="px-3 py-2 text-zinc-300 text-right font-bold">
                          {f.sizeBytes > 1024 * 1024 
                            ? `${(f.sizeBytes / (1024 * 1024)).toFixed(2)} MB` 
                            : `${(f.sizeBytes / 1024).toFixed(2)} KB`}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            f.type === 'Permanent Data' ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/30' : 'theme-badge'
                          }`}>
                            {f.type}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <h3 className="mb-3 text-xs font-bold text-zinc-400 uppercase tracking-wider">Terminal Bills</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        <div className="p-4 border border-zinc-800 rounded-2xl shadow-sm bg-zinc-900/90">
          <div className="text-xs text-zinc-400 mb-1">Database Size</div>
          <div className="text-xl font-bold text-white">{((stats.databaseSizeBytes || 0) / (1024 * 1024)).toFixed(2)} MB</div>
        </div>
        <div className="p-4 border border-zinc-800 rounded-2xl shadow-sm bg-zinc-900/90">
          <div className="text-xs text-zinc-400 mb-1">Total Bills</div>
          <div className="text-xl font-bold text-white">{stats.totalOfflineBillsCount || 0}</div>
        </div>
        <div className="p-4 border border-zinc-800 rounded-2xl shadow-sm bg-zinc-900/90">
          <div className="text-xs text-zinc-400 mb-1">Pending Sync</div>
          <div className="text-xl font-bold text-amber-400">{stats.pendingBillsCount || 0}</div>
        </div>
        <div className="p-4 border border-zinc-800 rounded-2xl shadow-sm bg-zinc-900/90">
          <div className="text-xs text-zinc-400 mb-1">Completed</div>
          <div className="text-xl font-bold text-emerald-400">{stats.completedCount || 0}</div>
        </div>
      </div>

      <h3 className="mb-3 mt-6 text-xs font-bold text-zinc-400 uppercase tracking-wider">Dashboard Offline Data</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div className="p-4 border border-zinc-800 rounded-2xl shadow-sm bg-zinc-900/90">
          <div className="text-xs text-zinc-400 mb-1">Pending Sync</div>
          <div className="text-xl font-bold text-amber-400">{stats.dashboardPendingSyncs || 0}</div>
        </div>
        <div className="p-4 border border-zinc-800 rounded-2xl shadow-sm bg-zinc-900/90">
          <div className="text-xs text-zinc-400 mb-1">Local Products</div>
          <div className="text-xl font-bold text-white">{stats.dashboardOfflineProducts || 0}</div>
        </div>
        <div className="p-4 border border-zinc-800 rounded-2xl shadow-sm bg-zinc-900/90">
          <div className="text-xs text-zinc-400 mb-1">Local Categories</div>
          <div className="text-xl font-bold text-white">{stats.dashboardOfflineCategories || 0}</div>
        </div>
        <div className="p-4 border border-theme rounded-2xl shadow-sm bg-zinc-900/90">
          <div className="text-xs text-theme-accent mb-1 font-bold">Product Images</div>
          <div className="text-xl font-bold text-theme-accent">{stats.cachedProductImagesCount || 0} Cached</div>
        </div>
        <div className="p-4 border border-purple-500/20 rounded-2xl shadow-sm bg-zinc-900/90">
          <div className="text-xs text-purple-400 mb-1">Category Images</div>
          <div className="text-xl font-bold text-purple-300">{stats.cachedCategoryImagesCount || 0} Cached</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <button 
          onClick={handleViewBills}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 btn-theme-primary rounded-xl text-xs font-bold text-white shadow-lg transition cursor-pointer active:scale-95 disabled:opacity-50"
        >
          <DbIcon className="h-4 w-4" /> {isViewingBills ? 'Hide Local Bills' : 'View Local Bills'}
        </button>
        <button 
          onClick={() => setIsViewingImages(!isViewingImages)}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 border border-purple-500/30 bg-purple-950/40 rounded-xl text-xs font-bold text-purple-300 hover:bg-purple-900/50 transition cursor-pointer disabled:opacity-50"
        >
          <FileText className="h-4 w-4" /> {isViewingImages ? 'Hide Cached Images' : 'View Cached Images'}
        </button>
        <button 
          onClick={handleClearCache}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 border border-rose-500/30 bg-rose-950/40 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-900/50 transition cursor-pointer disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" /> Clear Image Cache
        </button>
        <button 
          onClick={loadStats}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 border border-zinc-700 bg-zinc-800 rounded-xl text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" /> Refresh Stats
        </button>
      </div>

      {isViewingImages && stats.cachedImagesList && (
        <div className="mt-8 border-t border-zinc-800 pt-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-pink-400" /> Offline Cached Images
            </h3>
            <p className="text-xs text-zinc-400">Locally compressed WebP images stored for offline functionality.</p>
          </div>
          
          <div className="overflow-x-auto rounded-2xl border border-zinc-800 shadow-xl no-scrollbar bg-zinc-950">
            <table className="min-w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-zinc-900/90 border-b border-zinc-800 text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Preview</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Filename</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Type</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Size</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 bg-zinc-950">
                {stats.cachedImagesList.map((img: any, index: number) => (
                  <tr key={`${img.name}-${index}`} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="px-4 py-3">
                      <img src={`/api/media/${img.name}`} alt="preview" className="h-10 w-10 object-cover rounded-lg shadow-sm border border-zinc-800 bg-zinc-900" />
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">{img.name}</td>
                    <td className="px-4 py-3 text-zinc-400 uppercase text-xs">{img.type}</td>
                    <td className="px-4 py-3 text-pink-400 font-bold">{(img.size / 1024).toFixed(1)} KB</td>
                    <td className="px-4 py-3 text-zinc-400 font-mono text-xs max-w-[200px] truncate" title={img.path}>{img.path}</td>
                  </tr>
                ))}
                {stats.cachedImagesList.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-zinc-500">
                      No cached images found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isViewingBills && (
        <div className="mt-8 border-t border-zinc-800 pt-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-pink-400" /> Offline Database Records
              </h3>
              <p className="text-xs text-zinc-400">Read directly from local_storage.db</p>
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                <input 
                  type="date"
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-zinc-700 bg-zinc-950 text-white text-xs outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 w-full"
                />
              </div>
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                <input 
                  type="text"
                  placeholder="Search Bill No..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-zinc-700 bg-zinc-950 text-white placeholder-zinc-500 text-xs outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 w-full"
                />
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto rounded-2xl border border-zinc-800 shadow-xl no-scrollbar bg-zinc-950">
            <table className="min-w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-zinc-900/90 border-b border-zinc-800 text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Bill Number</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Date & Time</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px] text-right">Total Amount</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Payment</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px] text-center">Sync Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 bg-zinc-950">
                {bills
                  .filter(b => b.sync_status !== 'COMPLETED')
                  .filter(b => b.id.toLowerCase().includes(searchQuery.toLowerCase()))
                  .filter(b => {
                    if (!dateFilter) return true;
                    // convert timestamp to local YYYY-MM-DD
                    const bDate = new Date(b.timestamp);
                    const localDate = new Date(bDate.getTime() - (bDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                    return localDate === dateFilter;
                  })
                  .map((bill, index) => (
                  <tr key={`${bill.id}-${index}`} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="px-4 py-3 font-bold text-white">{bill.id}</td>
                    <td className="px-4 py-3 text-zinc-400">{new Date(bill.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold text-pink-400">₹{bill.total.toFixed(2)}</td>
                    <td className="px-4 py-3 text-zinc-300">{bill.payment_method}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold border ${
                        bill.sync_status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${bill.sync_status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                        {bill.sync_status === 'COMPLETED' ? 'COMPLETED' : 'PENDING_SYNC'}
                      </span>
                    </td>
                  </tr>
                ))}
                {bills.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-zinc-500">
                        <DbIcon className="h-8 w-8 mb-2 text-zinc-600" />
                        <p>No offline bills found in database.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}


