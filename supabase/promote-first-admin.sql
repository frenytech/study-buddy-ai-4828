-- Promote the existing first-created account if no admin exists yet.
insert into public.user_roles (user_id, role)
select u.id, 'super_admin'::text::public.app_role from auth.users u
where not exists (select 1 from public.user_roles where role::text in ('admin','super_admin'))
order by u.created_at asc limit 1
on conflict do nothing;
