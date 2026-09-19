import { MessageCircle } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';

export const metadata = { title: 'Messages' };

export default function MessagesPage() {
  return (
    <ComingSoon
      title="Messages"
      when="Coming soon"
      icon={<MessageCircle />}
      description="Chat one-to-one, jump from a conversation straight into a video call, and manage message requests."
    />
  );
}
