# Raw Material & Recipe Management Implementation Plan

This is a comprehensive plan to safely implement the Raw Material system into the existing architecture without breaking the online/offline sync flow or existing checkout process.

## Phase 1: Database Models & SQLite Setup
- Create Mongoose `RawMaterial` model.
- Update Mongoose `Product` model to include `recipeYield`, `recipeUnit`, and a `rawMaterials` array.
- Create Mongoose `StockTransaction` model.
- Update `lib/storage.ts` to add SQLite tables:
  - `local_raw_materials`
  - `local_stock_transactions`
- Update SQLite `local_products` schema to store recipe JSON.

## Phase 2: Core Inventory Logic & API
- Create server actions (`lib/actions/inventory.ts`) for CRUD on Raw Materials.
- Build the core deduction engine `calculateRecipeDeduction(product, quantity)` that handles unit conversion (kg -> g, litre -> ml).
- Create `deductStock` logic that writes to both MongoDB (if online) and SQLite (if offline).

## Phase 3: Dashboard UI (Admin)
- Create `/app/(dashboard)/raw-materials/page.tsx` with a data table showing Stock, Minimum Stock, and Status (In Stock, Low Stock, Out of Stock).
- Update the `Sidebar` to include the "Raw Materials" navigation link.
- Create a reusable modal `RawMaterialForm` to add/edit materials.

## Phase 4: Product Recipe UI
- Modify `ProductForm.tsx` to include the "Raw Materials / Recipe Ingredients" section.
- Add dynamic input rows allowing users to select a Raw Material, enter quantity, and set the Recipe Yield.

## Phase 5: Billing & POS Integration
- Update `CartPanel.tsx` to pre-calculate if sufficient raw materials exist before allowing "Complete Bill".
- Hook into the `Block Billing When Raw Material Is Insufficient` setting.
- Update `app/api/db/recordSale/route.ts` to deduct raw materials upon sale completion.

## Phase 6: Offline-to-Online Synchronization
- Update `app/api/storage/sync/route.ts` to process offline bills and correctly sync raw material deductions to MongoDB without duplicating stock deductions.
- Ensure cancelled bills reverse the stock deduction logic.

---
*Note: We will execute these phases step-by-step to guarantee no existing billing functionality is broken.*
