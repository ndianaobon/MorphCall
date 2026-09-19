import { Radio } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';

export const metadata = { title: 'Live' };

export default function LivePage() {
  return (
    <ComingSoon
      title="Live"
      when="Coming later"
      icon={<Radio />}
      description="Go live to your followers, join streams and chat with creators in real time."
    />
  );
}
