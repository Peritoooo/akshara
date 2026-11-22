-- Let a signed-in user permanently delete their own account and every row that
-- belongs to it. Everything runs in one transaction, so a failure leaves the
-- account untouched.
--
-- The function is SECURITY DEFINER because deleting the auth identity requires
-- privileges the `authenticated` role does not have. It still only ever touches
-- the caller: auth.uid() is the only id used, and the execute grant is limited
-- to signed-in users.

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  -- Explicit deletes keep this correct even if a foreign key ever loses its
  -- cascade; they are all scoped to the caller.
  delete from public.collection_books where user_id = uid;
  delete from public.collections where user_id = uid;
  delete from public.bookmarks where user_id = uid;
  delete from public.highlights where user_id = uid;
  delete from public.reading_sessions where user_id = uid;
  delete from public.reading_positions where user_id = uid;
  delete from public.library_entries where user_id = uid;
  delete from public.books where user_id = uid;
  delete from public.profiles where id = uid;

  -- Remove the login itself. Cascades cover any rows added by future tables.
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_account() from public;
revoke all on function public.delete_account() from anon;
grant execute on function public.delete_account() to authenticated;

comment on function public.delete_account() is
  'Permanently deletes the calling user, their reading metadata, and their login.';
