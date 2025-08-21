import { supabase } from './supabase';
import type { TFunction } from 'i18next';

let alerted = false;

export async function notifySessionExpired(t: TFunction) {
  if (alerted) return;
  alerted = true;
  await supabase.auth.signOut();
  if (typeof window !== 'undefined') {
    alert(t('sessionExpired'));
  }
}
