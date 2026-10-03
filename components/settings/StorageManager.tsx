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

  const loadStats = async () => {
    try {
      const res = await fetch((typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron') ? 'http://localhost:3015/api/storage/' : '/api/storage/') + 'stats');
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
      const res = await fetch((typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron') ? 'http://localhost:3015/api/storage/' : '/api/storage/') + 'config', {
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
      const res = await fetch((typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron') ? 'http://localhost:3015/api/storage/' : '/api/storage/') + 'clear', { method: 'POST' });
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
      const res = await fetch((typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron') ? 'http://localhost:3015/api/storage/' : '/api/storage/') + 'allBills');
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
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
          <HardDrive className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">Local Temporary Storage</h2>
          <p className="text-sm text-zinc-500">Manage offline bills and cached product images for this device.</p>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-md text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-zinc-50 p-4 rounded-lg mb-6 border border-zinc-100">
        <div className="flex justify-between items-start mb-2">
          <span className="text-sm font-medium text-zinc-700">Current Location</span>
          {!isChangingLocation && (
            <button 
              onClick={() => setIsChangingLocation(true)}
              className="text-sm text-blue-600 hover:underline"
            >
              Change Location
            </button>
          )}
        </div>
        
        {isChangingLocation ? (
          <div className="flex gap-2">
            <input 
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm"
              placeholder="e.g. D:\BillingOfflineStorage"
            />
            <button 
              onClick={handleUpdateLocation}
              disabled={isLoading}
              className="bg-black text-white px-4 py-2 rounded text-sm disabled:opacity-50"
            >
              Save
            </button>
            <button 
              onClick={() => { setIsChangingLocation(false); setNewLocation(stats.location); }}
              className="px-4 py-2 text-zinc-600 text-sm hover:bg-zinc-200 rounded"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 mt-4">
            <div className="flex items-center justify-between bg-white p-3 rounded border border-zinc-200">
              <span className="text-sm font-semibold text-zinc-700">Total Local Storage Used:</span>
              <span className="text-sm font-bold text-blue-600">
                {stats.usedBytes > 1024 * 1024 
                  ? `${(stats.usedBytes / (1024 * 1024)).toFixed(2)} MB` 
                  : `${(stats.usedBytes / 1024).toFixed(2)} KB`}
              </span>
            </div>
            
            {stats.folderDetails && stats.folderDetails.length > 0 && (
              <div className="overflow-x-auto rounded border border-zinc-200 bg-white">
                <table className="min-w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-zinc-100 text-zinc-600">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Folder/File</th>
                      <th className="px-3 py-2 font-semibold">Path</th>
                      <th className="px-3 py-2 font-semibold text-right">Size</th>
                      <th className="px-3 py-2 font-semibold text-center">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {stats.folderDetails.map((f: any, i: number) => (
                      <tr key={i} className="hover:bg-zinc-50">
                        <td className="px-3 py-2 font-medium text-zinc-900">{f.name}</td>
                        <td className="px-3 py-2 text-zinc-500 font-mono" title={f.path}>{f.path}</td>
                        <td className="px-3 py-2 text-zinc-700 text-right font-medium">
                          {f.sizeBytes > 1024 * 1024 
                            ? `${(f.sizeBytes / (1024 * 1024)).toFixed(2)} MB` 
                            : `${(f.sizeBytes / 1024).toFixed(2)} KB`}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${
                            f.type === 'Permanent Data' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
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

      <h3 className="mb-3 text-sm font-bold text-zinc-700 uppercase tracking-wider">Terminal Bills</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        <div className="p-4 border border-zinc-100 rounded-lg shadow-sm bg-zinc-50/50">
          <div className="text-sm text-zinc-500 mb-1">Database Size</div>
          <div className="text-xl font-bold text-zinc-900">{((stats.databaseSizeBytes || 0) / (1024 * 1024)).toFixed(2)} MB</div>
        </div>
        <div className="p-4 border border-zinc-100 rounded-lg shadow-sm">
          <div className="text-sm text-zinc-500 mb-1">Total Bills</div>
          <div className="text-xl font-bold text-zinc-900">{stats.totalOfflineBillsCount || 0}</div>
        </div>
        <div className="p-4 border border-zinc-100 rounded-lg shadow-sm">
          <div className="text-sm text-zinc-500 mb-1">Pending Sync</div>
          <div className="text-xl font-bold text-orange-600">{stats.pendingBillsCount || 0}</div>
        </div>
        <div className="p-4 border border-zinc-100 rounded-lg shadow-sm">
          <div className="text-sm text-zinc-500 mb-1">Completed</div>
          <div className="text-xl font-bold text-green-600">{stats.completedCount || 0}</div>
        </div>
      </div>

      <h3 className="mb-3 mt-6 text-sm font-bold text-zinc-700 uppercase tracking-wider">Dashboard Offline Data</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div className="p-4 border border-zinc-100 rounded-lg shadow-sm">
          <div className="text-sm text-zinc-500 mb-1">Pending Sync</div>
          <div className="text-xl font-bold text-orange-600">{stats.dashboardPendingSyncs || 0}</div>
        </div>
        <div className="p-4 border border-zinc-100 rounded-lg shadow-sm">
          <div className="text-sm text-zinc-500 mb-1">Local Products</div>
          <div className="text-xl font-bold text-zinc-900">{stats.dashboardOfflineProducts || 0}</div>
        </div>
        <div className="p-4 border border-zinc-100 rounded-lg shadow-sm">
          <div className="text-sm text-zinc-500 mb-1">Local Categories</div>
          <div className="text-xl font-bold text-zinc-900">{stats.dashboardOfflineCategories || 0}</div>
        </div>
        <div className="p-4 border border-zinc-100 rounded-lg shadow-sm bg-blue-50/50">
          <div className="text-sm text-zinc-500 mb-1">Product Images</div>
          <div className="text-xl font-bold text-blue-700">{stats.cachedProductImagesCount || 0} Cached</div>
        </div>
        <div className="p-4 border border-zinc-100 rounded-lg shadow-sm bg-blue-50/50">
          <div className="text-sm text-zinc-500 mb-1">Category Images</div>
          <div className="text-xl font-bold text-blue-700">{stats.cachedCategoryImagesCount || 0} Cached</div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button 
          onClick={handleViewBills}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 border border-blue-200 bg-blue-50 rounded-md text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
        >
          <DbIcon className="h-4 w-4" /> {isViewingBills ? 'Hide Local Bills' : 'View Local Bills'}
        </button>
        <button 
          onClick={() => setIsViewingImages(!isViewingImages)}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 border border-purple-200 bg-purple-50 rounded-md text-sm font-medium text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-50"
        >
          <FileText className="h-4 w-4" /> {isViewingImages ? 'Hide Cached Images' : 'View Cached Images'}
        </button>
        <button 
          onClick={handleClearCache}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 border border-zinc-300 rounded-md text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" /> Clear Image Cache
        </button>
        <button 
          onClick={loadStats}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 border border-zinc-300 rounded-md text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" /> Refresh Stats
        </button>
      </div>

      {isViewingImages && stats.cachedImagesList && (
        <div className="mt-8 border-t border-zinc-200 pt-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-zinc-500" /> Offline Cached Images
            </h3>
            <p className="text-sm text-zinc-500">Locally compressed WebP images stored for offline functionality.</p>
          </div>
          
          <div className="overflow-x-auto rounded-lg border border-zinc-200 shadow-sm no-scrollbar">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Preview</th>
                  <th className="px-4 py-3 font-semibold">Filename</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Size</th>
                  <th className="px-4 py-3 font-semibold">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {stats.cachedImagesList.map((img: any, index: number) => (
                  <tr key={`${img.name}-${index}`} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <img src={`/api/media/${img.name}`} alt="preview" className="h-10 w-10 object-cover rounded shadow-sm border border-zinc-200 bg-zinc-100" />
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900">{img.name}</td>
                    <td className="px-4 py-3 text-zinc-600 uppercase text-xs">{img.type}</td>
                    <td className="px-4 py-3 text-zinc-600">{(img.size / 1024).toFixed(1)} KB</td>
                    <td className="px-4 py-3 text-zinc-500 font-mono text-xs max-w-[200px] truncate" title={img.path}>{img.path}</td>
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
        <div className="mt-8 border-t border-zinc-200 pt-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
            <div>
              <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-zinc-500" /> Offline Database Records
              </h3>
              <p className="text-sm text-zinc-500">Read directly from local_storage.db</p>
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <div className="relative">
                <Calendar className="absolute left-2.5 top-2 h-4 w-4 text-zinc-400" />
                <input 
                  type="date"
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                  className="pl-9 pr-3 py-1.5 rounded-md border border-zinc-300 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black w-full"
                />
              </div>
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2 h-4 w-4 text-zinc-400" />
                <input 
                  type="text"
                  placeholder="Search Bill No..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 rounded-md border border-zinc-300 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black w-full"
                />
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto rounded-lg border border-zinc-200 shadow-sm no-scrollbar">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Bill Number</th>
                  <th className="px-4 py-3 font-semibold">Date & Time</th>
                  <th className="px-4 py-3 font-semibold text-right">Total Amount</th>
                  <th className="px-4 py-3 font-semibold">Payment</th>
                  <th className="px-4 py-3 font-semibold text-center">Sync Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {bills
                  .filter(b => b.id.toLowerCase().includes(searchQuery.toLowerCase()))
                  .filter(b => {
                    if (!dateFilter) return true;
                    // convert timestamp to local YYYY-MM-DD
                    const bDate = new Date(b.timestamp);
                    const localDate = new Date(bDate.getTime() - (bDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                    return localDate === dateFilter;
                  })
                  .map((bill, index) => (
                  <tr key={`${bill.id}-${index}`} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="px-4 py-3 font-medium text-zinc-900">{bill.id}</td>
                    <td className="px-4 py-3 text-zinc-600">{new Date(bill.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-medium text-zinc-900">₹{bill.total.toFixed(2)}</td>
                    <td className="px-4 py-3 text-zinc-600">{bill.payment_method}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        bill.sync_status === 'COMPLETED' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-orange-100 text-orange-700 border border-orange-200 animate-pulse'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${bill.sync_status === 'COMPLETED' ? 'bg-green-600' : 'bg-orange-600'}`}></span>
                        {bill.sync_status === 'COMPLETED' ? 'COMPLETED' : 'PENDING_SYNC'}
                      </span>
                    </td>
                  </tr>
                ))}
                {bills.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-zinc-500">
                        <DbIcon className="h-8 w-8 mb-2 text-zinc-300" />
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


