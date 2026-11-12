'use server';

import { isLocalMySqlMode } from '@/lib/mysql';
import { ensureLocalMySqlInitialized } from '@/lib/mysql-init';
import { getAuthorizedCompanyPool } from '@/lib/mysql-company';
import { getSession } from '@/lib/auth-session';
import { getDb } from '@/lib/actions/db';
import { recordAuditLog } from '@/lib/actions/audit';
import { cookies } from 'next/headers';
import { RowDataPacket } from 'mysql2';
import { EXPENSE_CATEGORIES, type ExpenseCategory, type ExpenseRecord } from '@/types/expenses';

export type { ExpenseCategory, ExpenseRecord };

/**
 * Record a New Operating Expense
 * Validates category, amounts, and logs to audit trail.
 */
export async function createExpense(params: {
  expenseDate: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paymentMethod?: string;
  paymentReference?: string;
  supplierId?: string;
  attachmentUrl?: string;
}): Promise<{ success: boolean; error?: string; expense?: ExpenseRecord }> {
  try {
    const session = await getSession();
    const cookieStore = await cookies();
    const rawRole = session?.role || cookieStore.get('auth_role')?.value;
    const authRole = rawRole === 'admin' ? 'company_admin' : rawRole;
    const currentUserId = session?.userId || session?.username || cookieStore.get('auth_username')?.value || 'admin';

    const amount = Number(params.amount);
    if (!amount || amount <= 0) {
      return { success: false, error: 'A positive expense amount is required.' };
    }

    if (!params.description || params.description.trim().length < 2) {
      return { success: false, error: 'A valid expense description is required.' };
    }

    const expenseId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const expenseDate = params.expenseDate || new Date().toISOString().split('T')[0];
    const paymentMethod = params.paymentMethod || 'Cash';

    // If recorded by Company Admin or Super Admin, auto-approve; otherwise 'Pending'
    const status = authRole === 'company_admin' || authRole === 'super_admin' ? 'Approved' : 'Pending';
    const approvedBy = status === 'Approved' ? currentUserId : null;

    if (isLocalMySqlMode()) {
      await ensureLocalMySqlInitialized();
      const { pool, company } = await getAuthorizedCompanyPool();

      await pool.query(
        `INSERT INTO expenses (
          id, company_id, branch_id, expense_date, category, description, amount,
          payment_method, payment_reference, recorded_by_user_id, approved_by_user_id,
          supplier_id, attachment_url, status, created_at
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          expenseId,
          company.id,
          expenseDate,
          params.category,
          params.description.trim(),
          amount,
          paymentMethod,
          params.paymentReference || null,
          currentUserId,
          approvedBy,
          params.supplierId || null,
          params.attachmentUrl || null,
          status,
        ]
      );

      await recordAuditLog({
        companyId: company.id,
        userId: currentUserId,
        action: 'EXPENSE_CREATE',
        entityType: 'EXPENSE',
        entityId: expenseId,
        details: {
          category: params.category,
          amount,
          description: params.description,
          paymentMethod,
          status,
        },
      });

      return {
        success: true,
        expense: {
          id: expenseId,
          companyId: company.id,
          expenseDate,
          category: params.category,
          description: params.description,
          amount,
          paymentMethod,
          paymentReference: params.paymentReference,
          recordedByUserId: currentUserId,
          approvedByUserId: approvedBy,
          status,
          createdAt: new Date().toISOString(),
        },
      };
    }

    // Live MongoDB Mode
    const db = await getDb();
    const authCompanyId = cookieStore.get('auth_company_id')?.value || 'comp_default';

    const newExpense = {
      id: expenseId,
      companyId: authCompanyId,
      expenseDate,
      category: params.category,
      description: params.description.trim(),
      amount,
      paymentMethod,
      paymentReference: params.paymentReference || null,
      recordedByUserId: currentUserId,
      approvedByUserId: approvedBy,
      supplierId: params.supplierId || null,
      attachmentUrl: params.attachmentUrl || null,
      status,
      createdAt: new Date(),
    };

    await db.collection('expenses').insertOne(newExpense);
    return { success: true, expense: newExpense as any };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to record expense.' };
  }
}

/**
 * Approve or Reject an Operating Expense
 * Enforces company admin permission.
 */
export async function updateExpenseStatus(
  expenseId: string,
  newStatus: 'Approved' | 'Rejected' | 'Paid',
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    const cookieStore = await cookies();
    const rawRole = session?.role || cookieStore.get('auth_role')?.value;
    const authRole = rawRole === 'admin' ? 'company_admin' : rawRole;
    const currentUserId = session?.username || cookieStore.get('auth_username')?.value || 'admin';

    if (authRole !== 'company_admin' && authRole !== 'super_admin') {
      return { success: false, error: 'Permission denied: Only Company Admin or Super Admin can approve expenses.' };
    }

    if (isLocalMySqlMode()) {
      await ensureLocalMySqlInitialized();
      const { pool, company } = await getAuthorizedCompanyPool();

      const [existing] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM expenses WHERE id = ? AND company_id = ?',
        [expenseId, company.id]
      );
      if (existing.length === 0) {
        return { success: false, error: 'Expense record not found.' };
      }

      await pool.query(
        'UPDATE expenses SET status = ?, approved_by_user_id = ?, updated_at = NOW() WHERE id = ? AND company_id = ?',
        [newStatus, currentUserId, expenseId, company.id]
      );

      await recordAuditLog({
        companyId: company.id,
        userId: currentUserId,
        action: `EXPENSE_${newStatus.toUpperCase()}`,
        entityType: 'EXPENSE',
        entityId: expenseId,
        details: { beforeStatus: existing[0].status, afterStatus: newStatus, reason },
      });

      return { success: true };
    }

    // Live MongoDB Mode
    const db = await getDb();
    await db.collection('expenses').updateOne(
      { id: expenseId },
      { $set: { status: newStatus, approvedByUserId: currentUserId, updatedAt: new Date() } }
    );

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Status update failed.' };
  }
}
