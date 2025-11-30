import { redirect } from 'next/navigation';

export default function CreatePOPage() {
  redirect('/purchasing/import?mode=manual');
}
