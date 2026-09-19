'use client';

import { Chip, Skeleton } from '@morphcall/ui';
import { useInterests } from '@/lib/queries';

export const MAX_INTERESTS = 10;

export function InterestPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (slugs: string[]) => void;
}) {
  const { data, isLoading } = useInterests();
  if (isLoading) {
    return (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Interests">
        {data?.map((i) => {
          const selected = value.includes(i.slug);
          return (
            <Chip
              key={i.slug}
              selected={selected}
              disabled={!selected && value.length >= MAX_INTERESTS}
              onClick={() =>
                onChange(selected ? value.filter((s) => s !== i.slug) : [...value, i.slug])
              }
            >
              {i.label}
            </Chip>
          );
        })}
      </div>
      <p className="text-caption text-muted" aria-live="polite">
        {value.length}/{MAX_INTERESTS} selected
      </p>
    </div>
  );
}
