import { supabase } from '@/lib/supabaseClient';

/**
 * Logs an action to the audit trail via the `log_audit` RPC (see migration
 * 0006). Fire-and-forget by design — a logging failure should never block
 * the user's actual action, so callers don't need to await or handle errors.
 */
export function logAudit(
  actionType: string,
  targetTable?: string,
  targetId?: string,
  metadata?: Record<string, unknown>
) {
  supabase
    .rpc('log_audit', {
      p_action_type: actionType,
      p_target_table: targetTable ?? null,
      p_target_id: targetId ?? null,
      p_metadata: metadata ?? null,
    })
    .then(({ error }) => {
      if (error) {
        // eslint-disable-next-line no-console
        console.error('Audit log failed:', error);
      }
    });
}
