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
update public.roles
set permissions = array_cat(permissions, array['admin.settings.manage']::text[])
from admin_role ar
where roles.id = ar.id
  and not ('admin.settings.manage' = any(ar.permissions));
