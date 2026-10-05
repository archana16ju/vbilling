const fs = require('fs');

let lines = fs.readFileSync('components/settings/PrinterDesignPanel.tsx', 'utf8').split('\n');

// 1. Change imports to add Eye, X
const importLine = lines.findIndex(l => l.includes('import { Save, RotateCcw } from "lucide-react"'));
if (importLine !== -1) {
    lines[importLine] = 'import { Save, RotateCcw, Eye, X } from "lucide-react"';
}

// 2. Add showPreview state
const activeTabLine = lines.findIndex(l => l.includes('const [activeTab, setActiveTab] = useState("company")'));
if (activeTabLine !== -1) {
    lines.splice(activeTabLine + 1, 0, '  const [showPreview, setShowPreview] = useState(false)');
}

// 3. Update buttons
const resetBtnIdx = lines.findIndex(l => l.includes('<button onClick={handleReset}'));
if (resetBtnIdx !== -1) {
    const previewBtn = `            <button onClick={() => setShowPreview(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors">
              <Eye className="w-4 h-4" /> Live Preview
            </button>`;
    lines.splice(resetBtnIdx, 0, previewBtn);
}

// 4. Change flex layout width
const flexLine = lines.findIndex(l => l.includes('<div className="flex h-[calc(100vh-140px)] gap-6">'));
if (flexLine !== -1) {
    lines[flexLine] = '    <div className="flex justify-center h-[calc(100vh-140px)] gap-6 w-full max-w-4xl mx-auto">';
}

// 5. Replace the Live Preview Panel with Modal
const livePreviewStart = lines.findIndex(l => l.includes('{/* Live Preview Panel */}'));
if (livePreviewStart !== -1) {
    const modalContent = `      {/* Overlay Modal for Live Preview */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-4 py-3 border-b flex justify-between items-center bg-zinc-50">
              <h3 className="font-bold text-zinc-800">Receipt Live Preview</h3>
              <button onClick={() => setShowPreview(false)} className="p-1 hover:bg-zinc-200 rounded-md transition-colors text-zinc-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 bg-zinc-100 flex-1 overflow-y-auto flex justify-center">
              <div className="bg-white shadow-md border" style={{ width: design.paperSize === '58mm' ? '58mm' : design.paperSize === '80mm' ? '80mm' : '210mm', minHeight: '100px' }}>
                <iframe
                  title="Receipt Preview"
                  srcDoc={previewHtml}
                  className="w-full h-full border-0"
                  style={{ minHeight: '500px' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}`;
      
    // Replace from livePreviewStart to the third to last line (which is `      </div>`)
    // The last three lines are `    </div>`, `  )`, `}`
    // Let's just slice until the end and append the proper ending.
    lines = lines.slice(0, livePreviewStart);
    lines.push(...modalContent.split('\n'));
    lines.push('    </div>');
    lines.push('  )');
    lines.push('}');
}

fs.writeFileSync('components/settings/PrinterDesignPanel.tsx', lines.join('\n'));
console.log('Successfully patched PrinterDesignPanel.tsx');
