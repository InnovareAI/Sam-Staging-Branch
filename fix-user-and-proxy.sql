-- First, ensure your user exists in the users table
INSERT INTO users (id, email, created_at, updated_at)
VALUES (
  'f6885ff3-deef-4781-8721-93011c990b1b',
  'tl@innovareai.com',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- OR, if the foreign key is causing issues, we can make it optional
-- (This allows proxy assignments even if user record doesn't exist yet)
ALTER TABLE linkedin_proxy_assignments 
DROP CONSTRAINT IF EXISTS linkedin_proxy_assignments_user_id_fkey;

ALTER TABLE linkedin_proxy_assignments
ADD CONSTRAINT linkedin_proxy_assignments_user_id_fkey
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
NOT VALID;
