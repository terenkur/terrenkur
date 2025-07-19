'use client'
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

export default function Home() {
  const [items, setItems] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('items').select('*');
      setItems(data ?? []);
    }
    load();
  }, []);

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <Image className="dark:invert" src="/next.svg" alt="Next.js logo" width={180} height={38} priority />
        <ul className="list-disc pl-4">
          {items.map(item => (
            <li key={item.id}>{item.name}</li>
          ))}
        </ul>
      </main>
    </div>
  );
}
