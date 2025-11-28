import { supabase } from './supabase';

let alerted = false;

export async function notifySessionExpired() {
  if (alerted) return;
  alerted = true;
  await supabase.auth.signOut();
}
