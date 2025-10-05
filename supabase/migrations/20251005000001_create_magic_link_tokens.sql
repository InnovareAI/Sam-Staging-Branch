-- Create magic_link_tokens table for 3cubed enterprise one-time login links
CREATE TABLE IF NOT EXISTS public.magic_link_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  used BOOLEAN DEFAULT false NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_token ON public.magic_link_tokens(token);
CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_user_id ON public.magic_link_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_expires_at ON public.magic_link_tokens(expires_at);

-- Enable RLS
ALTER TABLE public.magic_link_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policies (only service role can manage these)
CREATE POLICY "Service role can manage magic link tokens" ON public.magic_link_tokens
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE public.magic_link_tokens IS 'One-time use magic links for 3cubed enterprise customer onboarding';
