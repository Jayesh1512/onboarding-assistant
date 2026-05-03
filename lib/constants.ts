/** Supabase table for persisted onboarding calls (transcript, Q&A, summary). */
export const SUPABASE_CALLS_TABLE = 'calls' as const;

export const CALLS_LIST_LIMIT = 100;

/** Delay (ms) after summary streaming ends before PATCHing Supabase so final chunks are flushed. */
export const SUMMARY_PERSIST_DEBOUNCE_MS = 400;
