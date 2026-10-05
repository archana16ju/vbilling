const fs = require('fs');

// 1. Fix the double tab in settings
let settingsContent = fs.readFileSync('app/(dashboard)/settings/page.tsx', 'utf8');
settingsContent = settingsContent.replace(
  "{ id: 'printer-design', label: 'Printer Design' }, { id: 'printer-design', label: 'Printer Design' }",
  "{ id: 'printer-design', label: 'Printer Design' }"
);
fs.writeFileSync('app/(dashboard)/settings/page.tsx', settingsContent);

// 2. Read PrinterDesignPanel.tsx
let panelContent = fs.readFileSync('components/settings/PrinterDesignPanel.tsx', 'utf8');

// We need to change the layout to an overlay.
// 1. Add state for the overlay: `const [showPreview, setShowPreview] = useState(false)`
// 2. Change the grid layout: `grid-cols-[1fr_400px]` -> just a single column
// 3. Move the Live Preview section to a modal
// 4. Add "Live Preview" button next to "Save Design"

const importReact = 'import { useState, useEffect } from "react"';
if (!panelContent.includes('import { useState, useEffect } from "react"')) {
  // It probably has `import { useState } from "react"` or similar? Let's just use what's there.
  // We'll replace `const [activeTab, setActiveTab] = useState("company")` with the preview state too.
}

const stateReplace = `const [activeTab, setActiveTab] = useState("company")
  const [showPreview, setShowPreview] = useState(false)`;
panelContent = panelContent.replace('const [activeTab, setActiveTab] = useState("company")', stateReplace);

// Replace the grid container
panelContent = panelContent.replace('className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6"', 'className="w-full max-w-4xl mx-auto"');

// Replace the buttons row
const oldButtons = `<button
            onClick={resetToDefaults}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
          >
            <Save className="w-4 h-4" /> Save Design
          </button>`;

const newButtons = `<button
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
          >
            <Eye className="w-4 h-4" /> Live Preview
          </button>
          <button
            onClick={resetToDefaults}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
          >
            <Save className="w-4 h-4" /> Save Design
          </button>`;
panelContent = panelContent.replace(oldButtons, newButtons);

// Import Eye if not there
if (!panelContent.includes('Eye')) {
  panelContent = panelContent.replace('import { RotateCcw, Save } from "lucide-react"', 'import { RotateCcw, Save, Eye, X } from "lucide-react"');
}

// Find the start of the Live Preview column
const livePreviewStart = panelContent.indexOf('      {/* Right Column: Live Preview */}');

// The end of the Live Preview column is right before the last closing div of the grid.
const livePreviewBlock = panelContent.substring(livePreviewStart);
// Wait, livePreviewBlock goes to the end of the file. 
// We want to replace it with the Modal logic!
// Let's find exactly where it starts.
const leftColumnEndStr = '</div>\n        </div>\n      </div>'; // End of the left column (settings)
const leftColumnEndIdx = panelContent.indexOf(leftColumnEndStr, livePreviewStart - 100);

const modalContent = `
      {/* Overlay Modal for Live Preview */}
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
              <div className="bg-white shadow-md border" style={{ width: '80mm', minHeight: '300px' }}>
                <iframe
                  title="Receipt Preview"
                  srcDoc={previewHtml}
                  className="w-full h-full border-0"
                  style={{ minHeight: '400px' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
`;

// Replace from `      {/* Right Column: Live Preview */}` to the end of the file.
// But we must preserve the closing brackets of the main component!
panelContent = panelContent.substring(0, livePreviewStart) + modalContent;

fs.writeFileSync('components/settings/PrinterDesignPanel.tsx', panelContent);
console.log('Modified PrinterDesignPanel.tsx');
