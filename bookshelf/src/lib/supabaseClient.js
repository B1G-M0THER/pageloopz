import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
      'Missing Supabase env variables. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// ─── Auth Helpers ───────────────────────────────────────────────────────────

export const signUp = async ({ email, password, username }) => {
  // username passed via metadata — DB trigger creates profile automatically
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
    },
  });
  if (error) throw error;
  return data;
};

export const signIn = async ({ email, password }) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

// ─── Profile Helpers ─────────────────────────────────────────────────────────

export const getProfile = async (userId) => {
  const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
  if (error) throw error;
  return data;
};

export const updateProfile = async (userId, updates) => {
  const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
  if (error) throw error;
  return data;
};

export const uploadAvatar = async (userId, file) => {
  const fileExt = file.name.split('.').pop();
  const filePath = `${userId}/avatar.${fileExt}`;

  const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

  await updateProfile(userId, { avatar_url: data.publicUrl });
  return data.publicUrl;
};

// ─── Books Helpers ────────────────────────────────────────────────────────────

export const upsertBook = async (bookData) => {
  // ignoreDuplicates — INSERT only, skip if exists
  const { error } = await supabase
      .from('books')
      .upsert(bookData, { onConflict: 'id', ignoreDuplicates: true });
  if (error) {
    console.warn('[upsertBook] Could not cache book:', error.message);
    // missing cache is not critical
  }
};

export const getBookById = async (bookId) => {
  const { data, error } = await supabase
      .from('books')
      .select('*')
      .eq('id', bookId)
      .maybeSingle();
  if (error) throw error;
  return data;
};

// ─── User Book Activity ───────────────────────────────────────────────────────

export const getUserBookActivity = async (userId, bookId) => {
  const { data, error } = await supabase
      .from('user_book_activity')
      .select('*')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .maybeSingle();
  if (error) throw error;
  return data;
};

export const setBookStatus = async (userId, bookId, status) => {
  const { data, error } = await supabase
      .from('user_book_activity')
      .upsert(
          { user_id: userId, book_id: bookId, status, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,book_id' }
      )
      .select()
      .single();
  if (error) throw error;
  return data;
};

export const getUserBooksByStatus = async (userId, status) => {
  const query = supabase
      .from('user_book_activity')
      .select('*, books(*)')
      .eq('user_id', userId);

  if (status) query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return data;
};

// ─── Reviews Helpers ──────────────────────────────────────────────────────────

export const getBookReviews = async (bookId) => {
  const { data, error } = await supabase
      .from('reviews')
      .select('*, profiles(username, avatar_url)')
      .eq('book_id', bookId)
      .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const getUserReview = async (userId, bookId) => {
  const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .maybeSingle();
  if (error) throw error;
  return data;
};

export const upsertReview = async ({ userId, bookId, rating, comment, isSpoiler }) => {
  const { data, error } = await supabase
      .from('reviews')
      .upsert(
          {
            user_id: userId,
            book_id: bookId,
            rating,
            comment,
            is_spoiler: isSpoiler,
          },
          { onConflict: 'user_id,book_id' }
      )
      .select()
      .single();
  if (error) throw error;
  return data;
};

export const deleteReview = async (reviewId) => {
  const { error } = await supabase.from('reviews').delete().eq('id', reviewId);
  if (error) throw error;
};