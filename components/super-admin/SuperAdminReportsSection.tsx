'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Search,
  Building2,
  Calendar,
  RefreshCw,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  BarChart3,
  Layers,
  Package,
  Users,
  Truck,
  Coins,
  Receipt,
  FileText,
  AlertCircle,
  Filter,
  CheckCircle,
  X,
  ExternalLink,
} from 'lucide-react';
import BillDetailsModal from './BillDetailsModal';

interface ColumnDef {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  format?: 'currency' | 'number' | 'date' | 'badge' | 'text';
  sortable?: boolean;
}

interface ReportResponse {
  success: boolean;
  reportKey: string;
  reportTitle: string;
  category: string;
  scope: {
    companyId: string;
    companyName: string;
    isAllCompanies: boolean;
    preset: string;
    dateRange: {
      start: string;
      end: string;
    };
  };
  columns: ColumnDef[];
  rows: any[];
  summary: Record<string, any>;
  totalRecords: number;
  notes?: string;
}

interface CompanyOption {
  id: string;
  name: string;
  code: string;
}

interface ReportCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  reports: { id: string; label: string; desc: string }[];
}

const REPORT_CATEGORIES: ReportCategory[] = [
  {
    id: 'sales',
    label: 'Sales Reports',
    icon: BarChart3,
    reports: [
      { id: 'overall_sales', label: 'Overall Sales Report', desc: 'Itemized revenue, customer orders & bill flow' },
      { id: 'company_sales', label: 'Company-wise Sales Report', desc: 'Revenue & ticket breakdown by company' },
      { id: 'daily_sales', label: 'Daily Sales Report', desc: 'Day-by-day revenue velocity and bill tally' },
      { id: 'monthly_sales', label: 'Monthly Sales Report', desc: 'Monthly revenue growth & trajectory' },
      { id: 'yearly_sales', label: 'Yearly Sales Report', desc: 'Annual turnover and bill volume' },
      { id: 'bills_report', label: 'Detailed Bills Audit', desc: 'Comprehensive invoice log with line items' },
      { id: 'payment_method_report', label: 'Payment Method Report', desc: 'Cash vs UPI vs Card vs Credit split' },
      { id: 'tax_gst_report', label: 'Tax / GST Report', desc: 'Taxable turnover, CGST, SGST slabs' },
      { id: 'refund_report', label: 'Refunds & Returns', desc: 'Customer refunds and return slips' },
      { id: 'cancellation_report', label: 'Cancellations Report', desc: 'Voided orders and lost revenue log' },
    ],
  },
  {
    id: 'company',
    label: 'Company Reports',
    icon: Building2,
    reports: [
      { id: 'company_registration', label: 'Company Registration Report', desc: 'Registered tenants, status & codes' },
      { id: 'active_inactive_companies', label: 'Active / Inactive Companies', desc: 'Operational status and entity health' },
      { id: 'company_performance', label: 'Company Performance Report', desc: 'Cross-tenant KPI comparison matrix' },
      { id: 'company_collection_summary', label: 'Collection Summary', desc: 'Payment breakdown per company' },
      { id: 'company_growth', label: 'Company Growth Report', desc: 'Tenant velocity and invoice volume' },
    ],
  },
  {
    id: 'products',
    label: 'Products & Inventory',
    icon: Package,
    reports: [
      { id: 'product_performance', label: 'Product Performance Report', desc: 'Catalog sales volume & velocity' },
      { id: 'top_selling_products', label: 'Top-Selling Products', desc: 'Ranked best-sellers by units & revenue' },
      { id: 'category_sales', label: 'Category-wise Sales Report', desc: 'Menu category revenue share' },
      { id: 'company_products', label: 'Company Products Catalog', desc: 'Inventory breakdown by company' },
      { id: 'stock_summary', label: 'Stock Summary Report', desc: 'Real-time inventory levels across stores' },
      { id: 'low_stock', label: 'Low Stock Report', desc: 'Critical inventory alerts (<=5 units)' },
    ],
  },
  {
    id: 'customers',
    label: 'Customers Reports',
    icon: Users,
    reports: [
      { id: 'customer_growth', label: 'Customer Growth Report', desc: 'Customer acquisition and visits trend' },
      { id: 'company_customers', label: 'Company-wise Customers', desc: 'Customer distribution by tenant' },
      { id: 'new_vs_returning', label: 'New vs Returning Customers', desc: 'Loyalty, frequency & repeat spend' },
    ],
  },
  {
    id: 'staff',
    label: 'Staff & Users Reports',
    icon: Users,
    reports: [
      { id: 'user_activity', label: 'User Activity Report', desc: 'Staff billing records and active status' },
      { id: 'staff_summary', label: 'Staff Summary Report', desc: 'Employee registry, wages & roles' },
      { id: 'company_admin', label: 'Company Admin Report', desc: 'Company admin user assignments' },
      { id: 'role_wise_users', label: 'Role-wise User Report', desc: 'Distribution by cashier, waiter, admin' },
      { id: 'attendance_report', label: 'Attendance Report', desc: 'Clock-in/out records & working hours' },
      { id: 'shifts_report', label: 'Shifts Report', desc: 'Cashier shift drawer reconciliation' },
    ],
  },
  {
    id: 'orders',
    label: 'Orders & Delivery Reports',
    icon: Truck,
    reports: [
      { id: 'dine_in_orders', label: 'Dine-in Orders Report', desc: 'Table turnover and dining receipts' },
      { id: 'takeaway_orders', label: 'Takeaway Orders Report', desc: 'Counter pickup and parcel turnover' },
      { id: 'delivery_orders', label: 'Delivery Orders Report', desc: 'Delivery orders, address & rider status' },
      { id: 'online_orders', label: 'Online Orders Report', desc: 'Aggregator volume (Zomato/Swiggy)' },
      { id: 'delivery_performance', label: 'Delivery Performance Report', desc: 'Rider dispatch and delivery speed' },
    ],
  },
  {
    id: 'financial',
    label: 'Financial Reports',
    icon: Coins,
    reports: [
      { id: 'total_sales_summary', label: 'Total Sales Summary', desc: 'Executive revenue, taxes & discounts' },
      { id: 'expenses_report', label: 'Expenses Report', desc: 'Operating expenses, category & status' },
      { id: 'profit_loss_report', label: 'Profit & Loss Report', desc: 'Audited operating statement with disclosures' },
      { id: 'payment_collection', label: 'Payment Collection Report', desc: 'Master transaction payments ledger' },
      { id: 'tax_summary', label: 'Tax Summary Report', desc: 'GST liabilities summary by company' },
    ],
  },
];

const PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7days', label: 'Last 7 Days' },
  { value: '30days', label: 'Last 30 Days' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
];

interface SuperAdminReportsSectionProps {
  initialReportKey?: string;
  initialCompanyId?: string;
  companiesList: CompanyOption[];
  currencySymbol?: string;
  onFilterCompany: (companyId: string) => void;
}

export default function SuperAdminReportsSection({
  initialReportKey = 'overall_sales',
  initialCompanyId = 'all',
  companiesList = [],
  currencySymbol = '₹',
  onFilterCompany,
}: SuperAdminReportsSectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('sales');
  const [selectedReportKey, setSelectedReportKey] = useState<string>(initialReportKey);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(initialCompanyId);
  const [selectedPreset, setSelectedPreset] = useState<string>('30days');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [isCustomOpen, setIsCustomOpen] = useState(false);

  // Table State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Data State
  const [reportData, setReportData] = useState<ReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Bill inspection modal
  const [inspectingBill, setInspectingBill] = useState<any | null>(null);

  // Sync initial props if changed
  useEffect(() => {
    if (initialReportKey && initialReportKey !== selectedReportKey) {
      setSelectedReportKey(initialReportKey);
      // Auto switch category
      for (const cat of REPORT_CATEGORIES) {
        if (cat.reports.some((r) => r.id === initialReportKey)) {
          setSelectedCategory(cat.id);
          break;
        }
      }
    }
    if (initialCompanyId !== undefined && initialCompanyId !== selectedCompanyId) {
      setSelectedCompanyId(initialCompanyId);
    }
  }, [initialReportKey, initialCompanyId]);

  useEffect(() => {
    fetchReport();
  }, [selectedReportKey, selectedCompanyId, selectedPreset, customStart, customEnd]);

  const fetchReport = async () => {
    setIsLoading(true);
    setError('');
    setCurrentPage(1);
    try {
      let url = `/api/super-admin/reports?reportKey=${encodeURIComponent(selectedReportKey)}&companyId=${encodeURIComponent(selectedCompanyId)}&preset=${encodeURIComponent(selectedPreset)}`;
      if (selectedPreset === 'custom' && customStart && customEnd) {
        url += `&startDate=${encodeURIComponent(customStart)}&endDate=${encodeURIComponent(customEnd)}`;
      }

      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch report');
      setReportData(json);
      if (json.columns?.length > 0 && !sortColumn) {
        setSortColumn(json.columns[0].key);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading report');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter & Sort Rows
  const filteredRows = useMemo(() => {
    if (!reportData?.rows) return [];
    let r = [...reportData.rows];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      r = r.filter((row) =>
        Object.values(row).some((val) =>
          val !== null && val !== undefined && String(val).toLowerCase().includes(q)
        )
      );
    }

    // Sort
    if (sortColumn) {
      r.sort((a, b) => {
        let aVal = a[sortColumn];
        let bVal = b[sortColumn];
        if (aVal === null || aVal === undefined) aVal = '';
        if (bVal === null || bVal === undefined) bVal = '';

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        }

        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        return sortOrder === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    }

    return r;
  }, [reportData?.rows, searchQuery, sortColumn, sortOrder]);

  // Paginated Rows
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const handleSort = (colKey: string) => {
    if (sortColumn === colKey) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(colKey);
      setSortOrder('desc');
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!reportData || filteredRows.length === 0) return;
    const headers = reportData.columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(',');
    const csvRows = filteredRows.map((row) =>
      reportData.columns
        .map((col) => {
          let val = row[col.key];
          if (val === null || val === undefined) val = '';
          if (typeof val === 'object') val = JSON.stringify(val);
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(',')
    );

    const csvContent = '\uFEFF' + [headers, ...csvRows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SuperAdmin_${selectedReportKey}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export to Excel Compatible
  const handleExportExcel = () => {
    handleExportCSV();
  };

  // Print Report
  const handlePrintReport = () => {
    window.print();
  };

  const currentCategoryObj = REPORT_CATEGORIES.find((c) => c.id === selectedCategory) || REPORT_CATEGORIES[0];

  return (
    <div className="space-y-6 text-white">
      {/* Category Tabs */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-2 shadow-xl flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {REPORT_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = selectedCategory === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                setSelectedReportKey(cat.reports[0].id);
              }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-theme-bar text-white shadow-md border border-theme shadow-theme-glow'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Report Sub-tabs / Selector Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
        {currentCategoryObj.reports.map((rep) => {
          const isSelected = selectedReportKey === rep.id;
          return (
            <button
              key={rep.id}
              onClick={() => setSelectedReportKey(rep.id)}
              className={`text-left p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'border-pink-500/60 bg-pink-950/20 shadow-lg shadow-pink-950/30'
                  : 'border-zinc-800/80 bg-zinc-900/50 hover:bg-zinc-800/50 text-zinc-400 hover:text-white'
              }`}
            >
              <div>
                <span className={`text-xs font-bold block ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                  {rep.label}
                </span>
                <span className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">
                  {rep.desc}
                </span>
              </div>
              {isSelected && (
                <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-pink-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-pink-400" />
                  Active Report
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Report Control Toolbar (Search + Filters + Export) */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-2xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
                <FileSpreadsheet className="h-4 w-4 text-theme-accent" />
              </span>
              <div>
                <h3 className="text-base font-black text-white tracking-tight">
                  {reportData?.reportTitle || 'Loading Report...'}
                </h3>
                <p className="text-xs text-zinc-400">
                  Scope: <span className="font-bold text-zinc-200">{reportData?.scope?.companyName || 'All Companies'}</span> • Total Records: <span className="font-mono font-bold text-pink-400">{filteredRows.length}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Export Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 hover:text-white px-3 py-1.5 text-xs font-bold text-zinc-300 transition cursor-pointer active:scale-95"
              title="Export filtered records to CSV"
            >
              <Download className="h-3.5 w-3.5 text-emerald-400" />
              CSV
            </button>
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 hover:text-white px-3 py-1.5 text-xs font-bold text-zinc-300 transition cursor-pointer active:scale-95"
              title="Export formatted report to Excel"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
              Excel
            </button>
            <button
              onClick={handlePrintReport}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 hover:text-white px-3 py-1.5 text-xs font-bold text-zinc-300 transition cursor-pointer active:scale-95"
              title="Print report or save to PDF"
            >
              <Printer className="h-3.5 w-3.5 text-indigo-400" />
              Print / PDF
            </button>
            <button
              onClick={fetchReport}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-xl btn-theme-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-md transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-3 border-t border-zinc-800/80">
          {/* Live Search Input */}
          <div className="lg:col-span-5 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search across all columns (bill, customer, items, amounts)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-700/80 pl-9.5 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-pink-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs cursor-pointer"
              >
                &times;
              </button>
            )}
          </div>

          {/* Company Filter Dropdown */}
          <div className="lg:col-span-4">
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-700/80 px-3 py-2 text-xs font-bold text-white focus:outline-hidden focus:border-pink-500 cursor-pointer"
            >
              <option value="all">🏢 All Companies</option>
              {companiesList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter Dropdown */}
          <div className="lg:col-span-3">
            <select
              value={selectedPreset}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedPreset(val);
                setIsCustomOpen(val === 'custom');
              }}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-700/80 px-3 py-2 text-xs font-bold text-white focus:outline-hidden focus:border-pink-500 cursor-pointer"
            >
              {PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  📅 {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom Date Range Inputs */}
        {isCustomOpen && (
          <div className="p-3 rounded-2xl border border-zinc-800 bg-zinc-950 flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-pink-400">Custom Date Interval:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-1 text-xs text-white font-mono"
            />
            <span className="text-xs text-zinc-500">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-1 text-xs text-white font-mono"
            />
            <button
              onClick={fetchReport}
              className="rounded-xl btn-theme-primary px-3 py-1 text-xs font-bold text-white"
            >
              Apply
            </button>
          </div>
        )}

        {/* Audit Notes Alert if any */}
        {reportData?.notes && (
          <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-3 text-xs text-amber-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
            <span>{reportData.notes}</span>
          </div>
        )}

        {/* Report Data Table */}
        <div className="rounded-2xl border border-zinc-800 overflow-hidden bg-zinc-950/40">
          {isLoading ? (
            <div className="p-16 text-center text-zinc-500 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="h-7 w-7 animate-spin text-pink-500" />
              <span className="text-xs font-bold">Querying local MySQL database records...</span>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-16 text-center text-zinc-500">
              <FileText className="mx-auto mb-3 h-10 w-10 text-zinc-600" />
              <p className="text-base font-bold text-zinc-300">No records found</p>
              <p className="text-xs text-zinc-500 mt-1">
                {searchQuery ? 'Try clearing your search query filter.' : 'No transactions exist in this selected company and date range.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-900/90 text-[11px] font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                  <tr>
                    {reportData?.columns.map((col) => {
                      const isSorted = sortColumn === col.key;
                      return (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.key)}
                          className={`px-4 py-3.5 select-none cursor-pointer hover:text-white transition ${
                            col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                          }`}
                        >
                          <div className={`inline-flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                            <span>{col.label}</span>
                            {isSorted ? (
                              sortOrder === 'asc' ? (
                                <ArrowUp className="h-3.5 w-3.5 text-pink-400" />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5 text-pink-400" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 text-zinc-600 opacity-0 group-hover:opacity-100" />
                            )}
                          </div>
                        </th>
                      );
                    })}
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono">
                  {paginatedRows.map((row, idx) => (
                    <tr key={row.id || idx} className="hover:bg-zinc-800/40 transition">
                      {reportData?.columns.map((col) => {
                        const val = row[col.key];

                        if (col.format === 'currency') {
                          return (
                            <td key={col.key} className="px-4 py-3.5 text-right font-black text-white">
                              {currencySymbol}{Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          );
                        }

                        if (col.format === 'number') {
                          return (
                            <td key={col.key} className="px-4 py-3.5 text-center font-bold text-zinc-200">
                              {Number(val || 0).toLocaleString()}
                            </td>
                          );
                        }

                        if (col.format === 'date') {
                          return (
                            <td key={col.key} className="px-4 py-3.5 text-zinc-400 whitespace-nowrap text-[11px]">
                              {val ? new Date(val).toLocaleString() : '-'}
                            </td>
                          );
                        }

                        if (col.format === 'badge') {
                          return (
                            <td key={col.key} className="px-4 py-3.5">
                              <span className="inline-flex items-center rounded-md bg-zinc-800/90 border border-zinc-700/80 px-2 py-0.5 text-[10px] font-bold text-zinc-300">
                                {val || '-'}
                              </span>
                            </td>
                          );
                        }

                        // Company link click action
                        if (col.key === 'company_name') {
                          return (
                            <td key={col.key} className="px-4 py-3.5 font-sans font-bold text-white">
                              <button
                                onClick={() => {
                                  if (row.company_id) {
                                    setSelectedCompanyId(row.company_id);
                                    onFilterCompany(row.company_id);
                                  }
                                }}
                                className="text-pink-400 hover:text-pink-300 hover:underline cursor-pointer flex items-center gap-1"
                                title="Filter reports to this company"
                              >
                                {val}
                                <ExternalLink className="h-3 w-3 opacity-60" />
                              </button>
                            </td>
                          );
                        }

                        return (
                          <td key={col.key} className="px-4 py-3.5 text-zinc-300 font-sans font-medium">
                            {val !== null && val !== undefined ? String(val) : '-'}
                          </td>
                        );
                      })}

                      {/* Row Action: View details */}
                      <td className="px-4 py-3.5 text-right font-sans">
                        {row.bill_number || row.items ? (
                          <button
                            onClick={() => setInspectingBill(row)}
                            className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 text-[11px] font-bold text-zinc-300 hover:text-white transition cursor-pointer"
                            title="Inspect bill line items and receipt"
                          >
                            <Eye className="h-3 w-3 text-pink-400" />
                            View
                          </button>
                        ) : (
                          <span className="text-zinc-600 text-[10px]">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Summary Totals Row */}
                {Object.keys(reportData?.summary || {}).length > 0 && (
                  <tfoot className="bg-zinc-900 border-t-2 border-zinc-700 text-xs font-bold text-white">
                    <tr>
                      <td className="px-4 py-3 uppercase tracking-wider text-pink-400 font-sans">
                        Report Totals
                      </td>
                      {reportData?.columns.slice(1).map((col) => {
                        const sumVal = reportData.summary[col.key] || reportData.summary.grandTotal || reportData.summary.totalSales;

                        if (col.format === 'currency') {
                          return (
                            <td key={col.key} className="px-4 py-3 text-right font-mono text-emerald-400 text-sm font-black">
                              {sumVal ? `${currencySymbol}${Number(sumVal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : ''}
                            </td>
                          );
                        }

                        return <td key={col.key} className="px-4 py-3" />;
                      })}
                      <td className="px-4 py-3 text-right text-[11px] text-zinc-500 font-sans">
                        Verified
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {/* Pagination & Results Count */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-zinc-400 pt-2">
          <div className="flex items-center gap-3">
            <span>
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, filteredRows.length)} of{' '}
              <span className="font-bold text-white">{filteredRows.length}</span> records
            </span>

            <div className="flex items-center gap-1.5">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg bg-zinc-950 border border-zinc-700 px-2 py-1 text-xs text-white"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-bold hover:bg-zinc-800 hover:text-white disabled:opacity-40 transition cursor-pointer"
            >
              Previous
            </button>
            <span className="px-2 font-mono font-bold text-white">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-bold hover:bg-zinc-800 hover:text-white disabled:opacity-40 transition cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Bill Details Modal */}
      {inspectingBill && (
        <BillDetailsModal
          bill={inspectingBill}
          currencySymbol={currencySymbol}
          onClose={() => setInspectingBill(null)}
        />
      )}
    </div>
  );
}
