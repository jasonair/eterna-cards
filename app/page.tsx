'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new purchasing import page
    router.push('/purchasing/import');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#f9f9f8] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
        <p className="text-stone-400">Redirecting to invoice import...</p>
      </div>
    </div>
  );
}
