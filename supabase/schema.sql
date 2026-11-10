-- 在全新的 Supabase 项目的 SQL Editor 中完整执行一次。
begin;
create table public.teachers (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.teachers enable row level security;
revoke all on public.teachers from anon, authenticated;

create or replace function public.is_teacher() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.teachers where user_id = (select auth.uid()));
$$;
revoke all on function public.is_teacher() from public;
grant execute on function public.is_teacher() to anon, authenticated;

create table public.questions (
 id uuid primary key default gen_random_uuid(),
 chapter text not null check (length(trim(chapter)) between 1 and 100),
 section text not null check (length(trim(section)) between 1 and 100),
 subject text not null default '' check (length(subject)<=80),
 content text not null default '' check (length(content)<=20000),
 answer text not null default '' check (length(answer)<=20000),
 difficulty integer not null default 1 check (difficulty between 1 and 5),
 images text[] not null default '{}' check (cardinality(images)<=6),
 base_attempts integer not null default 0 check (base_attempts between 0 and 1000000),
 base_errors integer not null default 0 check (base_errors between 0 and base_attempts),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (length(trim(content))>0 or cardinality(images)>0)
);
create table public.student_records (
 id uuid primary key default gen_random_uuid(),
 question_id uuid not null references public.questions(id) on delete cascade,
 student_label text not null check (length(trim(student_label)) between 1 and 60),
 attempts integer not null default 0 check (attempts between 0 and 1000000),
 errors integer not null default 0 check (errors between 0 and attempts),
 updated_at timestamptz not null default now(),
 unique(question_id,student_label)
);
create index student_records_question on public.student_records(question_id);
create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = clock_timestamp(); return new; end;
$$;
create trigger questions_touch before update on public.questions for each row execute function public.touch_updated_at();
create trigger records_touch before update on public.student_records for each row execute function public.touch_updated_at();
alter table public.questions enable row level security;
alter table public.student_records enable row level security;
create policy questions_read on public.questions for select to anon, authenticated using (true);
create policy questions_teacher on public.questions for all to authenticated using ((select public.is_teacher())) with check ((select public.is_teacher()));
create policy records_teacher on public.student_records for all to authenticated using ((select public.is_teacher())) with check ((select public.is_teacher()));
revoke all on public.questions, public.student_records from anon, authenticated;
grant select on public.questions to anon, authenticated;
grant insert, update, delete on public.questions to authenticated;
grant select, insert, update, delete on public.student_records to authenticated;

-- 此视图故意以数据库所有者身份聚合个人记录，只输出题目和汇总数字。
-- 不要把 student_label、记录 id 或逐人数据添加到此公开视图。
create view public.question_public with (security_barrier=true) as
 select q.*, (q.base_attempts + coalesce(r.attempts,0))::bigint as attempts,
 (q.base_errors + coalesce(r.errors,0))::bigint as errors
 from public.questions q
 left join (select question_id, sum(attempts) as attempts, sum(errors) as errors
            from public.student_records group by question_id) r on r.question_id=q.id;
revoke all on public.question_public from anon, authenticated;
grant select on public.question_public to anon, authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('question-images','question-images',true,3145728,array['image/png','image/jpeg','image/webp','image/gif']);
create policy question_images_read on storage.objects for select to anon, authenticated using (bucket_id='question-images');
create policy question_images_insert on storage.objects for insert to authenticated with check (bucket_id='question-images' and (select public.is_teacher()));
create policy question_images_delete on storage.objects for delete to authenticated using (bucket_id='question-images' and (select public.is_teacher()));
commit;

-- 接着在 Authentication > Users 创建教师账号，复制账号 UUID。
-- 将下一行的占位符替换为真实 UUID 后单独执行：
-- insert into public.teachers(user_id) values ('教师账号的UUID');
