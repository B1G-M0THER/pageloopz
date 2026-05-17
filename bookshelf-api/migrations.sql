-- ═══════════════════════════════════════════════════════════
-- BookShelf — SQL міграції для нової архітектури
-- Виконати в Supabase SQL Editor після попередніх міграцій
-- ═══════════════════════════════════════════════════════════

-- 1. Додаємо роль до profiles
-- ───────────────────────────────────────────────────────────
alter table profiles
  add column if not exists role text
  not null default 'user'
  check (role in ('user', 'moderator', 'admin'));

-- Зробити першого юзера адміном (вставте ваш UUID):
-- update profiles set role = 'admin' where id = 'ВАШ-USER-UUID';


-- 2. Додаємо статус до reviews (для модерації)
-- ───────────────────────────────────────────────────────────
alter table reviews
  add column if not exists status text
  not null default 'approved'
  check (status in ('pending', 'approved', 'rejected'));

alter table reviews
  add column if not exists updated_at timestamptz default now();

alter table reviews
  add column if not exists rejection_reason text;


-- 3. Таблиця custom_books (книги від користувачів)
-- ───────────────────────────────────────────────────────────
create table if not exists custom_books (
  id           uuid default gen_random_uuid() primary key,
  title        text not null,
  author       text not null,
  description  text,
  cover_url    text,
  isbn         text,
  submitted_by uuid references profiles(id) on delete set null,
  status       text not null default 'pending'
               check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  moderated_by uuid references profiles(id) on delete set null,
  moderated_at timestamptz,
  created_at   timestamptz default now()
);

-- Індекси для custom_books
create index if not exists idx_custom_books_status on custom_books(status);
create index if not exists idx_custom_books_submitted_by on custom_books(submitted_by);


-- 4. RLS для нових таблиць
-- ───────────────────────────────────────────────────────────

-- custom_books: читати схвалені — всі, писати — авторизовані, керувати — на сервері
alter table custom_books enable row level security;

create policy "Approved custom books are viewable by everyone"
  on custom_books for select
  using (status = 'approved');

create policy "Authenticated users can submit custom books"
  on custom_books for insert
  with check (auth.uid() = submitted_by);

-- Примітка: оновлення статусу (approve/reject) виконується через
-- серверний supabaseAdmin (service_role), який обходить RLS — OK.


-- 5. Оновлення RLS для reviews — лише approved відгуки публічні
-- ───────────────────────────────────────────────────────────
-- Видаляємо стару публічну policy і замінюємо на нову
drop policy if exists "Reviews are viewable by everyone" on reviews;

create policy "Approved reviews are viewable by everyone"
  on reviews for select
  using (status = 'approved');

-- Власник бачить всі свої відгуки (включаючи pending)
create policy "Users can view own reviews"
  on reviews for select
  using (auth.uid() = user_id);


-- 6. Функція для автоматичного оновлення updated_at
-- ───────────────────────────────────────────────────────────
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger reviews_updated_at
  before update on reviews
  for each row execute function update_updated_at_column();


-- 7. Як призначити собі роль admin (виконати один раз)
-- ───────────────────────────────────────────────────────────
-- Крок 1: зареєструйтесь через застосунок
-- Крок 2: знайдіть свій UUID: Supabase → Auth → Users
-- Крок 3: виконайте:
--
-- update profiles
--   set role = 'admin'
-- where id = 'ВАШ-USER-UUID-ТУТ';
