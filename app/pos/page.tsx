'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function POs() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new purchasing view page
    router.push('/purchasing/view');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#f9f9f8] dark:bg-stone-900 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600"></div>
    </div>
  );
}
