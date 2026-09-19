import Link from 'next/link';
import { Badge, Button, Card, EmptyState } from '@morphcall/ui';

export function ComingSoon({
  title,
  description,
  icon,
  when,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  when: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="text-h1 font-bold">{title}</h1>
        <Badge>{when}</Badge>
      </div>
      <Card>
        <EmptyState
          icon={icon}
          title={`${title} is on its way`}
          description={description}
          action={
            <Button variant="secondary" asChild>
              <Link href="/discover">Discover people meanwhile</Link>
            </Button>
          }
        />
      </Card>
    </div>
  );
}
