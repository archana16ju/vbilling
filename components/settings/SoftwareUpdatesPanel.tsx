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

  if (!state) return <div className="p-4 text-zinc-400">Loading deployments...</div>

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-xl overflow-hidden text-white">
      
      {/* Top Banner */}
      <div className="bg-zinc-950/60 border-b border-zinc-800 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-pink-500/10 border border-pink-500/30 text-pink-400">
              <Box className="h-4 w-4" />
            </div>
            Deployment Status
          </h2>
          <p className="text-xs text-zinc-400">Manage software versions and deployments for this billing terminal.</p>
        </div>
        
        <div className="flex gap-6 items-center bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-sm">
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Current Version</div>
            <div className="text-lg font-bold text-white">{state.currentVersion || 'Unknown'}</div>
          </div>
          <div className="h-8 w-px bg-zinc-800"></div>
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Commit</div>
            <div className="text-lg font-mono font-medium text-pink-400 flex items-center gap-1">
              <GitCommit className="w-4 h-4 text-zinc-500" />
              {state.currentCommit?.substring(0, 7) || 'unknown'}
            </div>
          </div>
          <div className="h-8 w-px bg-zinc-800"></div>
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Status</div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${state.status === 'UPDATE_AVAILABLE' ? 'bg-amber-400 shadow-md shadow-amber-400/50' : 'bg-emerald-400 shadow-md shadow-emerald-400/50'}`}></span>
              <span className="text-xs font-bold text-white">
                {state.status === 'UPDATE_AVAILABLE' ? 'Update Available' : 'Up to date'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {state.message && state.status !== 'IDLE' && (
        <div className="px-6 pt-6">
          <div className={`p-4 rounded-xl border ${state.status.includes('FAILED') ? 'bg-rose-950/60 border-rose-800/80 text-rose-300' : 'bg-cyan-950/60 border-cyan-800/80 text-cyan-300'}`}>
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4" /> System Message
            </div>
            <p className="text-xs mt-1 font-medium">{state.message}</p>
          </div>
        </div>
      )}

      {/* Deployments List */}
      <div className="p-6">
        <h3 className="font-bold text-white mb-4 text-base">Deployment History</h3>
        
        <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900/90 border-b border-zinc-800 text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Version/Commit</th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Message</th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Date</th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Status</th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 bg-zinc-950">
              {releases.map((rel) => {
                const rStatus = getReleaseStatus(rel);
                return (
                  <tr key={rel.version} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="font-bold text-white text-sm">{rel.version}</div>
                      <div className="font-mono text-[11px] text-zinc-400 mt-1 flex items-center gap-1">
                        <GitCommit className="w-3 h-3 text-zinc-500" /> {rel.commit?.substring(0, 7) || 'unknown'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-zinc-300 font-medium truncate max-w-[200px]" title={rel.commitMessage}>
                        {rel.commitMessage || 'No commit message'}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-zinc-400">
                      {new Date(rel.releaseDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${
                        rStatus === 'Current' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                        rStatus === 'Available' ? 'bg-pink-500/20 text-pink-400 border-pink-500/30' :
                        'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}>
                        {rStatus}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setSelectedRelease(rel)} className="text-xs font-bold text-pink-300 hover:text-white bg-pink-950/40 hover:bg-pink-900/50 px-3 py-1.5 rounded-xl border border-pink-500/30 flex items-center gap-1.5 transition cursor-pointer">
                          <Eye className="w-3.5 h-3.5" /> View
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] text-white">
            <div className="p-6 border-b border-zinc-800 bg-zinc-950/60 flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-white">Deployment Details</h3>
                <div className="text-xs text-zinc-400 mt-1">Review changes before proceeding</div>
              </div>
              <button onClick={() => setSelectedRelease(null)} className="text-zinc-400 hover:text-white font-bold text-2xl leading-none cursor-pointer">&times;</button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Version</div>
                  <div className="font-bold text-white text-base mt-1">{selectedRelease.version}</div>
                </div>
                <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Commit</div>
                  <div className="font-mono text-pink-400 font-bold text-base mt-1">{selectedRelease.commit?.substring(0, 7) || 'unknown'}</div>
                </div>
                <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Previous Version</div>
                  <div className="font-semibold text-zinc-300 mt-1">{selectedRelease.previousVersion || 'unknown'}</div>
                </div>
                <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Published</div>
                  <div className="font-semibold text-zinc-300 mt-1">{new Date(selectedRelease.releaseDate).toLocaleString()}</div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-white mb-2 border-b border-zinc-800 pb-2 text-sm">Commit Message</h4>
                <p className="text-zinc-300 italic text-sm">{selectedRelease.commitMessage || 'No message provided'}</p>
              </div>

              <div>
                <h4 className="font-bold text-white mb-2 border-b border-zinc-800 pb-2 text-sm">Changes Included</h4>
                <ul className="list-disc pl-5 space-y-1 text-zinc-300 text-xs">
                  {selectedRelease.releaseNotes?.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                  {(!selectedRelease.releaseNotes || selectedRelease.releaseNotes.length === 0) && (
                    <li className="text-zinc-500 list-none -ml-5">No specific release notes provided.</li>
                  )}
                </ul>
              </div>

              {/* Progress Bar inside modal if active */}
              {downloadProgress && (
                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                  <div className="flex justify-between text-xs mb-1.5 text-zinc-300 font-bold">
                    <span>Downloading Package...</span>
                    <span className="text-pink-400">{Math.round(downloadProgress.percent)}%</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-2">
                    <div className="bg-theme-bar h-2 rounded-full transition-all duration-300" style={{ width: `${downloadProgress.percent}%` }}></div>
                  </div>
                  <div className="flex justify-between text-[11px] mt-2 text-zinc-500">
                    <span>{(downloadProgress.transferred / 1024 / 1024).toFixed(2)} MB / {(downloadProgress.total / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-zinc-800 bg-zinc-950/60 flex justify-end gap-3">
              {getReleaseStatus(selectedRelease) === 'Available' && (
                <>
                  <button 
                    onClick={runBeforeUpdate}
                    disabled={loading || state.status === 'READY_TO_UPDATE' || state.status === 'DOWNLOADING'}
                    className="border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50 transition cursor-pointer"
                  >
                    1. Backup & Prepare Update
                  </button>
                  
                  {!isUpdateReady ? (
                    <button 
                      onClick={() => handleDownload()}
                      disabled={loading || state.status !== 'READY_TO_UPDATE'}
                      className="btn-theme-primary text-white px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-2 transition cursor-pointer active:scale-95"
                    >
                      <Download className="w-4 h-4" /> 2. Download & Install
                    </button>
                  ) : (
                    <button 
                      onClick={handleInstall}
                      className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/40 flex items-center gap-2 transition cursor-pointer active:scale-95 border border-emerald-400/30"
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
                    className="border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50 transition cursor-pointer"
                  >
                    1. Backup DB Before Rollback
                  </button>
                  
                  {!isUpdateReady ? (
                    <button 
                      onClick={() => handleDownload(selectedRelease)}
                      disabled={loading || state.status !== 'READY_TO_UPDATE'}
                      className="border border-rose-500/30 bg-rose-950/40 text-rose-400 hover:bg-rose-900/50 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-50 transition cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" /> 2. Roll Back to {selectedRelease.version}
                    </button>
                  ) : (
                    <button 
                      onClick={handleInstall}
                      className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer active:scale-95 shadow-lg shadow-rose-900/40 border border-rose-400/30"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Confirm & Install Rollback
                    </button>
                  )}
                </>
              )}
              <button onClick={() => setSelectedRelease(null)} className="px-4 py-2 text-xs font-bold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-xl border border-zinc-700 transition cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}


