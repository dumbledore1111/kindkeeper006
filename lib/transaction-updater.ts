import { supabase } from '@/lib/supabase'
import type { Transaction, CategoryType } from '@/types/database'

// Add interface to include categories
interface TransactionUpdate extends Partial<Transaction> {
  categories?: CategoryType[];
}

export async function updateTransaction(
  id: string,
  userId: string,
  updates: TransactionUpdate  // Use new interface instead of Partial<Transaction>
) {
  const { categories, ...transactionUpdates } = updates;

  // Start a transaction
  const { data, error } = await supabase.rpc('update_transaction', {
    p_transaction_id: id,
    p_user_id: userId,
    p_updates: transactionUpdates,
    p_categories: categories
  });

  if (error) {
    throw new Error(`Failed to update transaction: ${error.message}`);
  }

  return data;
}

// Add this stored procedure to your Supabase database:
/*
create or replace function update_transaction(
  p_transaction_id uuid,
  p_user_id uuid,
  p_updates jsonb,
  p_categories text[] default null
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_transaction jsonb;
begin
  -- Update transaction
  update transactions
  set amount = coalesce((p_updates->>'amount')::numeric, amount),
      description = coalesce(p_updates->>'description', description),
      type = coalesce((p_updates->>'type')::transaction_type, type),
      updated_at = now()
  where id = p_transaction_id
  and user_id = p_user_id
  returning to_jsonb(transactions.*) into v_transaction;

  -- Update categories if provided
  if p_categories is not null then
    delete from transaction_categories
    where transaction_id = p_transaction_id;

    insert into transaction_categories (transaction_id, category)
    select p_transaction_id, unnest(p_categories);
  end if;

  return v_transaction;
end;
$$;
*/ 