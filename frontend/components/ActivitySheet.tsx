'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from './ui/button';

const ActivityContent = dynamic(() => import('./ActivityContent'), {
  ssr: false,
});

export default function ActivitySheet() {
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <div className="md:hidden">
      <Button
        className="fixed bottom-4 right-4 z-30"
        onClick={() => setOpen(true)}
      >
        Activity
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-40 flex flex-col justify-end bg-black/50"
          onClick={close}
        >
          <div
            className="bg-muted rounded-t-lg p-4 space-y-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <ActivityContent />
          </div>
        </div>
      )}
    </div>
  );
}
