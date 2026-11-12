import { RowDataPacket } from 'mysql2';
import { getMysqlPool, isLocalMySqlMode } from '@/lib/mysql';
import { resolveCompanyPoolAndContext } from '@/lib/mysql-company';

export interface PersistedTerminalDesign {
  displayStyle?: 'default' | 'image-grid' | 'compact-grid' | 'search-based';
  gridColumns?: number;
  cardAspectRatio?: '4/3' | '1/1' | '16/10' | '3/2';
  cardRadius?: 'rounded-lg' | 'rounded-xl' | 'rounded-2xl' | 'rounded-3xl';
  cardGap?: 'gap-2' | 'gap-3' | 'gap-4' | 'gap-6';
  namePlacement?: 'bottom-gradient' | 'top-badge' | 'bottom-bar' | 'none';
  pricePlacement?: 'bottom-right' | 'bottom-left' | 'top-right';
  priceStyle?: 'dark-navy' | 'theme-accent' | 'glass' | 'white';
  themePreset?: string;
  themeMode?: 'dark' | 'light' | 'system';
  accentColor?: string;
  activeBorderColor?: string;
  bannerBgColor?: string;
  bannerTextColor?: string;
  showTapBanner?: boolean;
  tapBannerText?: string;
  tapBannerBadgeText?: string;
  currencySymbol?: string;
  showCartBadge?: boolean;
  quickDoubleTap?: boolean;

  // Category Design options
  categoryStyle?: 'card-tile' | 'compact-list' | 'grid-2col';
  categoryCardHeight?: 'h-20' | 'h-24' | 'h-28';
  categoryThumbnailShape?: 'rounded-full' | 'rounded-xl' | 'rounded-lg';
  showCategoryCount?: boolean;
  categorySearchPlaceholder?: string;
  isFixedCategorySection?: boolean;
  categoryVisibleCount?: number;
}

export const DEFAULT_PERSISTED_TERMINAL_DESIGN: PersistedTerminalDesign = {
  displayStyle: 'default',
  gridColumns: 4,
  cardAspectRatio: '4/3',
  cardRadius: 'rounded-2xl',
  cardGap: 'gap-4',
  namePlacement: 'bottom-gradient',
  pricePlacement: 'bottom-right',
  priceStyle: 'dark-navy',
  themePreset: 'black-cherry',
  themeMode: 'dark',
  accentColor: '#DB2777',
  activeBorderColor: '#DB2777',
  bannerBgColor: '#1F0715',
  bannerTextColor: '#f4f4f5',
  showTapBanner: true,
  tapBannerText: 'Tap to Add to Cart • Double-tap to +1 Qty',
  tapBannerBadgeText: 'TAP MODE ACTIVE',
  currencySymbol: '₹',
  showCartBadge: true,
  quickDoubleTap: true,

  // Category Design defaults
  categoryStyle: 'card-tile',
  categoryCardHeight: 'h-24',
  categoryThumbnailShape: 'rounded-full',
  showCategoryCount: true,
  categorySearchPlaceholder: 'Search category...',
  isFixedCategorySection: false,
  categoryVisibleCount: 4,
};

/**
 * Resolves the terminal design for a specific company from MySQL company_settings.
 */
export async function getCompanyTerminalDesign(
  companyId: string
): Promise<{ design: PersistedTerminalDesign; isCustom: boolean }> {
  if (!isLocalMySqlMode() || !companyId) {
    return { design: DEFAULT_PERSISTED_TERMINAL_DESIGN, isCustom: false };
  }

  try {
    const { pool } = await resolveCompanyPoolAndContext(companyId);
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT terminal_design FROM company_settings WHERE company_id = ? LIMIT 1',
      [companyId]
    );

    if (rows && rows.length > 0 && rows[0].terminal_design) {
      const val = rows[0].terminal_design;
      const parsed = typeof val === 'string' ? JSON.parse(val) : val;
      if (parsed && typeof parsed === 'object') {
        return {
          design: {
            ...DEFAULT_PERSISTED_TERMINAL_DESIGN,
            ...parsed,
          },
          isCustom: true,
        };
      }
    }
  } catch (err) {
    console.error(`Error loading terminal_design for company ${companyId}:`, err);
  }

  return {
    design: DEFAULT_PERSISTED_TERMINAL_DESIGN,
    isCustom: false,
  };
}

/**
 * Saves a company-specific terminal design configuration into company_settings.
 */
export async function saveCompanyTerminalDesign(
  companyId: string,
  design: Partial<PersistedTerminalDesign>
): Promise<boolean> {
  if (!isLocalMySqlMode() || !companyId) return false;

  const { pool } = await resolveCompanyPoolAndContext(companyId);
  const designJson = JSON.stringify(design);
  const settingsId = `cs_${companyId}`;

  await pool.query(
    `INSERT INTO company_settings (id, company_id, terminal_design)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE terminal_design = VALUES(terminal_design), updated_at = CURRENT_TIMESTAMP`,
    [settingsId, companyId, designJson]
  );

  return true;
}

/**
 * Resets a company's terminal design to inherit system defaults (sets terminal_design = NULL).
 */
export async function resetCompanyTerminalDesign(companyId: string): Promise<boolean> {
  if (!isLocalMySqlMode() || !companyId) return false;

  const { pool } = await resolveCompanyPoolAndContext(companyId);
  await pool.query(
    'UPDATE company_settings SET terminal_design = NULL, updated_at = CURRENT_TIMESTAMP WHERE company_id = ?',
    [companyId]
  );

  return true;
}
