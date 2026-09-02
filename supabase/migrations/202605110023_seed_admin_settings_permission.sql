-- Migration: seed admin.settings.manage permission to the admin role only

with spring_meadow as (
  select id as community_id
  from public.communities
  where slug = 'spring-meadow-community'
), admin_role as (
  select id, permissions
  from public.roles r
  join spring_meadow sm on sm.community_id = r.community_id
  where r.key = 'admin'
  limit 1
)
-- Migration: seed admin.settings.manage permission to the admin role only

update public.roles as target_role
set
  permissions = array_append(
    coalesce(target_role.permissions, '{}'::text[]),
    'admin.settings.manage'
  ),
  updated_at = now()
from public.communities as community
where target_role.community_id = community.id
  and community.slug = 'spring-meadow-community'
  and target_role.key = 'admin'
  and not (
    'admin.settings.manage' = any(
      coalesce(target_role.permissions, '{}'::text[])
    )
  );