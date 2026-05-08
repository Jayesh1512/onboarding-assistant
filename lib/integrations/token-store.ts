import { createSupabaseServerClient } from '@/lib/supabase/server';

export type IntegrationProvider = 'google_calendar' | 'calendly';

export interface IntegrationRow {
  id: string;
  user_id: string;
  provider: IntegrationProvider;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  metadata: Record<string, string>;
}

export async function getIntegration(provider: IntegrationProvider): Promise<IntegrationRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('user_integrations')
    .select('*')
    .eq('provider', provider)
    .maybeSingle();
  return (data as IntegrationRow | null) ?? null;
}

export async function upsertIntegration(
  provider: IntegrationProvider,
  tokens: {
    access_token: string;
    refresh_token?: string | null;
    expires_at?: string | null;
    metadata?: Record<string, string>;
  },
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  await supabase.from('user_integrations').upsert(
    {
      user_id: user.id,
      provider,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: tokens.expires_at ?? null,
      metadata: tokens.metadata ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,provider' },
  );
}

export async function deleteIntegration(provider: IntegrationProvider): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.from('user_integrations').delete().eq('provider', provider);
}
