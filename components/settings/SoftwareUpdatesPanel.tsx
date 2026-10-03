'use client'

import { useState, useEffect } from 'react'
import { Download, CheckCircle2, History, PackageCheck, AlertTriangle, ArrowRight, RotateCcw, Box, GitCommit, Eye } from 'lucide-react'

interface Release {
  version: string;
  commit: string;
  commitMessage: string;
  previousVersion: string;
  releaseDate: string;
  releaseNotes: string[];
  downloadUrl?: string;
}

interface UpdateState {
  status: string;
  message?: string;
  currentCommit?: string;
  currentVersion?: string;
}

export default function SoftwareUpdatesPanel() {
  const [state, setState] = useState<UpdateState | null>(null)
  const [releases, setReleases] = useState<Release[]>([])
  const [loading, setLoading] = useState(false)
  const [isUpdateReady, setIsUpdateReady] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<any>(null)
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [statusRes, releasesRes] = await Promise.all([
        fetch((typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron') ? 'http://localhost:3015/api/update' : '/api/update') + '?action=status'),
        fetch((typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron') ? 'http://localhost:3015/api/update' : '/api/update') + '?action=releases')
      ])
      
      if (statusRes.ok) {
        setState(await statusRes.json())
      } else {
        const errData = await statusRes.json().catch(() => ({}));
        setState({ status: 'FAILED', message: `Server Error: ${errData.details || errData.error || 'Failed to fetch'}` } as UpdateState)
      }
      
      if (releasesRes.ok) {
        setReleases(await releasesRes.json())
      }
    } catch (e: any) {
      console.error(e)
      setState({ status: 'FAILED', message: `Network Error: ${e.message}` } as UpdateState)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()

    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      (window as any).electronAPI.onDownloadProgress((progressObj: any) => {
        setDownloadProgress(progressObj)
      });
      (window as any).electronAPI.onUpdateDownloaded(() => {
        setIsUpdateReady(true)
        setDownloadProgress(null)
        setState(prev => prev ? { ...prev, status: 'READY_TO_UPDATE', message: `Update downloaded successfully! Ready to install.` } : null)
      });
    }
  }, [])

  const runBeforeUpdate = async () => {
    setLoading(true)
    try {
      const res = await fetch((typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron') ? 'http://localhost:3015/api/update' : '/api/update') + '', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'before' })
      })
      await res.json()
      await fetchData()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (release: Release = selectedRelease!) => {
    setState(prev => prev ? { ...prev, status: 'DOWNLOADING', message: 'Downloading package...' } : null);
    try {
      const res = await fetch((typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron') ? 'http://localhost:3015/api/update' : '/api/update') + '', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'download', version: release.version, downloadUrl: release.downloadUrl })
      })
      const result = await res.json()
      if (result.success) {
        setIsUpdateReady(true);
        setState(prev => prev ? { ...prev, status: 'READY_TO_UPDATE', message: result.message } : null);
        // message contains the targetExePath
        (window as any).downloadedExePath = result.message; 
      } else {
        setState(prev => prev ? { ...prev, status: 'FAILED', message: result.message } : null)
      }
    } catch (e) {
      console.error(e)
      setState(prev => prev ? { ...prev, status: 'FAILED', message: 'Network error during download' } : null)
    }
  }

  const handleInstall = async () => {
    const exePath = (window as any).downloadedExePath;
    if (!exePath) return alert('Error: downloaded installer path not found.');
    
    try {
      await fetch((typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron') ? 'http://localhost:3015/api/update' : '/api/update') + '', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'install', exePath })
      })
      setState(prev => prev ? { ...prev, status: 'INSTALLING', message: 'Installer launched. Application will restart.' } : null)
    } catch (e) {
      console.error(e)
    }
  }

  const getReleaseStatus = (release: Release) => {
    const currentVersion = state?.currentVersion || '0.1.0';
    if (release.version === currentVersion) return 'Current';
    // Simplified logic: anything newer than current is Available, older is Previous
    const currParts = currentVersion.split('.').map(Number);
    const relParts = release.version.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if ((relParts[i] || 0) > (currParts[i] || 0)) return 'Available';
      if ((relParts[i] || 0) < (currParts[i] || 0)) return 'Previous';
    }
    return 'Current';
  }

  if (!state) return <div className="p-4">Loading deployments...</div>

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-0 shadow-sm overflow-hidden">
      
      {/* Top Banner similar to Vercel */}
      <div className="bg-zinc-50 border-b border-zinc-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2 mb-1">
            <Box className="h-5 w-5" /> Deployment Status
          </h2>
          <p className="text-sm text-zinc-500">Manage software versions and deployments for this billing terminal.</p>
        </div>
        
        <div className="flex gap-6 items-center bg-white border border-zinc-200 p-4 rounded-lg shadow-sm">
          <div>
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Current Version</div>
            <div className="text-lg font-bold text-zinc-900">{state.currentVersion || 'Unknown'}</div>
          </div>
          <div className="h-8 w-px bg-zinc-200"></div>
          <div>
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Commit</div>
            <div className="text-lg font-mono font-medium text-zinc-700 flex items-center gap-1">
              <GitCommit className="w-4 h-4 text-zinc-400" />
              {state.currentCommit?.substring(0, 7) || 'unknown'}
            </div>
          </div>
          <div className="h-8 w-px bg-zinc-200"></div>
          <div>
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Status</div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${state.status === 'UPDATE_AVAILABLE' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
              <span className="text-sm font-medium text-zinc-900">
                {state.status === 'UPDATE_AVAILABLE' ? 'Update Available' : 'Up to date'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {state.message && state.status !== 'IDLE' && (
        <div className="px-6 pt-6">
          <div className={`p-4 rounded-lg border ${state.status.includes('FAILED') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4" /> System Message
            </div>
            <p className="text-sm mt-1">{state.message}</p>
          </div>
        </div>
      )}

      {/* Deployments List */}
      <div className="p-6">
        <h3 className="font-semibold text-zinc-900 mb-4 text-lg">Deployment History</h3>
        
        <div className="border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Version/Commit</th>
                <th className="px-4 py-3 font-medium">Message</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {releases.map((rel) => {
                const rStatus = getReleaseStatus(rel);
                return (
                  <tr key={rel.version} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="font-bold text-zinc-900">{rel.version}</div>
                      <div className="font-mono text-xs text-zinc-500 mt-1 flex items-center gap-1">
                        <GitCommit className="w-3 h-3" /> {rel.commit?.substring(0, 7) || 'unknown'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-zinc-800 font-medium truncate max-w-[200px]" title={rel.commitMessage}>
                        {rel.commitMessage || 'No commit message'}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-zinc-600">
                      {new Date(rel.releaseDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                        rStatus === 'Current' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        rStatus === 'Available' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-zinc-100 text-zinc-600 border-zinc-200'
                      }`}>
                        {rStatus}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setSelectedRelease(rel)} className="text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded border border-blue-100 flex items-center gap-1.5 transition-colors">
                          <Eye className="w-4 h-4" /> View
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {releases.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                    No deployments found. Publisher needs to push an update.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Changes Modal */}
      {selectedRelease && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-zinc-100 bg-zinc-50 flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-zinc-900">Deployment Details</h3>
                <div className="text-sm text-zinc-500 mt-1">Review changes before proceeding</div>
              </div>
              <button onClick={() => setSelectedRelease(null)} className="text-zinc-400 hover:text-zinc-600 font-bold text-xl leading-none">&times;</button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-zinc-50 p-3 rounded border border-zinc-200">
                  <div className="text-xs font-semibold text-zinc-500 uppercase">Version</div>
                  <div className="font-bold text-zinc-900 text-lg mt-1">{selectedRelease.version}</div>
                </div>
                <div className="bg-zinc-50 p-3 rounded border border-zinc-200">
                  <div className="text-xs font-semibold text-zinc-500 uppercase">Commit</div>
                  <div className="font-mono text-zinc-700 font-medium text-lg mt-1">{selectedRelease.commit?.substring(0, 7) || 'unknown'}</div>
                </div>
                <div className="bg-zinc-50 p-3 rounded border border-zinc-200">
                  <div className="text-xs font-semibold text-zinc-500 uppercase">Previous Version</div>
                  <div className="font-medium text-zinc-700 mt-1">{selectedRelease.previousVersion || 'unknown'}</div>
                </div>
                <div className="bg-zinc-50 p-3 rounded border border-zinc-200">
                  <div className="text-xs font-semibold text-zinc-500 uppercase">Published</div>
                  <div className="font-medium text-zinc-700 mt-1">{new Date(selectedRelease.releaseDate).toLocaleString()}</div>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="font-semibold text-zinc-900 mb-2 border-b border-zinc-100 pb-2">Commit Message</h4>
                <p className="text-zinc-700 italic">{selectedRelease.commitMessage || 'No message provided'}</p>
              </div>

              <div>
                <h4 className="font-semibold text-zinc-900 mb-2 border-b border-zinc-100 pb-2">Changes Included</h4>
                <ul className="list-disc pl-5 space-y-1 text-zinc-700 text-sm">
                  {selectedRelease.releaseNotes?.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                  {(!selectedRelease.releaseNotes || selectedRelease.releaseNotes.length === 0) && (
                    <li className="text-zinc-400 list-none -ml-5">No specific release notes provided.</li>
                  )}
                </ul>
              </div>

              {/* Progress Bar inside modal if active */}
              {downloadProgress && (
                <div className="mt-6 bg-zinc-50 p-4 rounded-lg border border-zinc-200">
                  <div className="flex justify-between text-xs mb-1 text-zinc-600 font-medium">
                    <span>Downloading Package...</span>
                    <span>{Math.round(downloadProgress.percent)}%</span>
                  </div>
                  <div className="w-full bg-zinc-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${downloadProgress.percent}%` }}></div>
                  </div>
                  <div className="flex justify-between text-xs mt-2 text-zinc-500">
                    <span>{(downloadProgress.transferred / 1024 / 1024).toFixed(2)} MB / {(downloadProgress.total / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex justify-end gap-3">
              {getReleaseStatus(selectedRelease) === 'Available' && (
                <>
                  <button 
                    onClick={runBeforeUpdate}
                    disabled={loading || state.status === 'READY_TO_UPDATE' || state.status === 'DOWNLOADING'}
                    className="bg-white border border-zinc-300 text-zinc-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
                  >
                    1. Backup & Prepare Update
                  </button>
                  
                  {!isUpdateReady ? (
                    <button 
                      onClick={() => handleDownload()}
                      disabled={loading || state.status !== 'READY_TO_UPDATE'}
                      className="bg-black text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 disabled:bg-zinc-400 flex items-center gap-2 transition-colors"
                    >
                      <Download className="w-4 h-4" /> 2. Download & Install
                    </button>
                  ) : (
                    <button 
                      onClick={handleInstall}
                      className="bg-emerald-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-emerald-700 flex items-center gap-2 transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Install & Restart Now
                    </button>
                  )}
                </>
              )}
              {getReleaseStatus(selectedRelease) === 'Previous' && (
                <>
                  <button 
                    onClick={runBeforeUpdate}
                    disabled={loading || state.status === 'READY_TO_UPDATE' || state.status === 'DOWNLOADING'}
                    className="bg-white border border-zinc-300 text-zinc-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
                  >
                    1. Backup DB Before Rollback
                  </button>
                  
                  {!isUpdateReady ? (
                    <button 
                      onClick={() => handleDownload(selectedRelease)}
                      disabled={loading || state.status !== 'READY_TO_UPDATE'}
                      className="bg-white border border-red-200 text-red-600 px-4 py-2 rounded-md text-sm font-medium hover:bg-red-50 flex items-center gap-2 disabled:opacity-50"
                    >
                      <RotateCcw className="w-4 h-4" /> 2. Roll Back to {selectedRelease.version}
                    </button>
                  ) : (
                    <button 
                      onClick={handleInstall}
                      className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 flex items-center gap-2 transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Confirm & Install Rollback
                    </button>
                  )}
                </>
              )}
              <button onClick={() => setSelectedRelease(null)} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 bg-zinc-200/50 hover:bg-zinc-200 rounded-md">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}


