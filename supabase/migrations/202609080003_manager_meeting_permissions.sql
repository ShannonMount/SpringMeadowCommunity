insert into public.roles (
  community_id,
  key,
  name,
  description,
  permissions,
  system_role
)
select
  communities.id,
  'manager',
  'Manager',
  'Community operations management for meetings and compliance workflows.',
  array[
    'resident.portal.access',
    'board.workspace.access',
    'admin.meetings.manage',
    'admin.compliance.manage'
  ]::text[],
  true
from public.communities
where communities.slug = 'spring-meadow-community'
on conflict (community_id, key) do update
set
  name = excluded.name,
  description = excluded.description,
  permissions = excluded.permissions,
  system_role = true,
  updated_at = now();

update public.roles
set
  permissions = (
    select array_agg(distinct permission order by permission)
    from unnest(permissions || array['admin.meetings.manage', 'admin.compliance.manage']::text[]) as permission
  ),
  updated_at = now()
where key in ('admin', 'manager')
  and community_id in (
    select id from public.communities where slug = 'spring-meadow-community'
  );