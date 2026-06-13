
-- Revoke anon EXECUTE from all internal SECURITY DEFINER helpers.
-- Public-facing functions are explicitly re-granted at the bottom.

REVOKE EXECUTE ON FUNCTION public._enqueue_auto_structure(text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.add_credits(uuid, uuid, text, integer, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.archive_prior_validations() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_structure_candidate_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_structure_job_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION public.candidates_missing_embeddings(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.client_can_see_candidate(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.client_can_see_job(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.client_org_for_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.client_portal_notify(uuid, uuid[], text, text, text, text, uuid, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.client_tenant_for_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.deduct_credits(uuid, uuid, text, integer, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.deduct_user_ai_credits(uuid, integer, uuid, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_invoice_number() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_tenant_id(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.hard_delete_user(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_sufficient_credits(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_user_ai_credits(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_promo_uses(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_client_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_manager(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_owner(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_owner_in_tenant(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_owner_or_manager_in_tenant(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_recruiter(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_client_feedback_to_activity() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_submission_status_change() FROM anon;
REVOKE EXECUTE ON FUNCTION public.match_candidates_for_job(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_admin_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_candidate_discussion() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_candidate_feedback() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_interview_request() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_job_client_share() FROM anon;
REVOKE EXECUTE ON FUNCTION public.promote_to_super_admin(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.recruiter_intelligence_summary(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.restore_user(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_submission_status(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.soft_delete_user(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sweep_pending_structuring() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_client_to_organization() FROM anon;
REVOKE EXECUTE ON FUNCTION public.tg_candidate_submissions_status_activity() FROM anon;
REVOKE EXECUTE ON FUNCTION public.tg_cemail_audit() FROM anon;
REVOKE EXECUTE ON FUNCTION public.tg_cspf_audit() FROM anon;
REVOKE EXECUTE ON FUNCTION public.tg_csr_audit_after() FROM anon;
REVOKE EXECUTE ON FUNCTION public.tg_csr_audit_before() FROM anon;
REVOKE EXECUTE ON FUNCTION public.tg_submission_recipients_activity() FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_belongs_to_tenant(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fix_invited_user_profile(uuid, text, uuid) FROM anon;

-- Re-affirm public access for functions that legitimately need anon callers.
GRANT EXECUTE ON FUNCTION public.create_chat_conversation(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.add_chat_message(uuid, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_chat_messages(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_visitor_conversation(text) TO anon;
GRANT EXECUTE ON FUNCTION public.owns_chat_conversation(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_client_invitation_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_candidate_share(text) TO anon;
