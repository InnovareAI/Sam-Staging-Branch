
-- Create attachments table for conversation files
create table if not exists sam_conversation_attachments (
  id uuid default gen_random_uuid() primary key,
  thread_id uuid references sam_conversation_threads(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  workspace_id uuid references workspaces(id) on delete set null,
  message_id uuid references sam_conversation_messages(id) on delete set null,
  file_name text not null,
  file_type text,
  file_size bigint,
  mime_type text,
  storage_path text not null,
  storage_bucket text default 'sam-attachments',
  processing_status text default 'pending',
  created_at timestamptz default now()
);

-- Enable RLS
alter table sam_conversation_attachments enable row level security;

-- Policies
create policy "Users can view attachments in their threads"
  on sam_conversation_attachments for select
  using (
    auth.uid() = user_id
    or
    exists (
      select 1 from sam_conversation_threads t
      where t.id = sam_conversation_attachments.thread_id
      and t.user_id = auth.uid()
    )
  );

create policy "Users can insert their own attachments"
  on sam_conversation_attachments for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own attachments"
  on sam_conversation_attachments for update
  using (auth.uid() = user_id);

create policy "Users can delete their own attachments"
  on sam_conversation_attachments for delete
  using (auth.uid() = user_id);

-- Indexes
create index if not exists idx_sam_attachments_thread_id on sam_conversation_attachments(thread_id);
create index if not exists idx_sam_attachments_user_id on sam_conversation_attachments(user_id);
create index if not exists idx_sam_attachments_message_id on sam_conversation_attachments(message_id);
