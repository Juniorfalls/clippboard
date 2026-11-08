-- Subscription plan on each profile.

alter table public.profiles
  add column if not exists plan text not null default 'starter';

alter table public.profiles
  drop constraint if exists profiles_plan_check;

alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('starter', 'pro', 'agency'));
