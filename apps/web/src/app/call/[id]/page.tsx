import type { Metadata } from 'next';
import { CallScreen } from '@/components/calls/call-screen';

export const metadata: Metadata = { title: 'Call' };

export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CallScreen callId={id} />;
}
