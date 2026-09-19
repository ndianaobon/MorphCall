import type { UserSettings } from '@morphcall/contracts';

export const CALL_OPTIONS: {
  value: UserSettings['whoCanCall'];
  label: string;
  description: string;
}[] = [
  { value: 'everyone', label: 'Everyone', description: 'Anyone on MorphCall can ring you' },
  { value: 'followers', label: 'People who follow me', description: 'Recommended' },
  { value: 'friends', label: 'Friends only', description: 'Mutual connections (coming soon)' },
  { value: 'nobody', label: 'Nobody', description: 'You can still call others' },
];

export const MESSAGE_OPTIONS: {
  value: UserSettings['whoCanMessage'];
  label: string;
  description: string;
}[] = [
  { value: 'everyone', label: 'Everyone', description: 'New people land in message requests' },
  { value: 'followers', label: 'People who follow me', description: 'Others can’t message you' },
  { value: 'friends', label: 'Friends only', description: 'Mutual connections (coming soon)' },
  { value: 'nobody', label: 'Nobody', description: 'Turn off new messages' },
];

export const ONLINE_OPTIONS: {
  value: UserSettings['onlineVisibility'];
  label: string;
  description: string;
}[] = [
  { value: 'everyone', label: 'Everyone', description: 'Show when you’re online' },
  { value: 'followers', label: 'People I follow back', description: 'Only people you follow' },
  { value: 'nobody', label: 'Nobody', description: 'Always appear offline' },
];

export const PROFILE_OPTIONS: {
  value: UserSettings['profileVisibility'];
  label: string;
  description: string;
}[] = [
  { value: 'public', label: 'Public', description: 'Anyone can see your bio and interests' },
  { value: 'followers', label: 'Followers', description: 'Details visible to followers only' },
  { value: 'private', label: 'Private', description: 'You approve every new follower' },
];
