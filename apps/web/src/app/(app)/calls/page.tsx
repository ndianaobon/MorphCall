import { Phone } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';

export const metadata = { title: 'Calls' };

export default function CallsPage() {
  return (
    <ComingSoon
      title="Calls"
      when="Next update"
      icon={<Phone />}
      description="High-quality 1-to-1 video calls arrive in the next update, along with your call history."
    />
  );
}
