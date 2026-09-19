import {
  Bell,
  Compass,
  Crown,
  Home,
  MessageCircle,
  Phone,
  Radio,
  Settings,
  User,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Arrives in a later stage — shown, but labelled. */
  soon?: boolean;
}

/** Navigation from the Uizard mockup (docs/06 §4). */
export const NAV: NavItem[] = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/live', label: 'Live', icon: Radio, soon: true },
  { href: '/messages', label: 'Messages', icon: MessageCircle, soon: true },
  { href: '/calls', label: 'Calls', icon: Phone, soon: true },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/premium', label: 'Premium', icon: Crown },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export const MOBILE_NAV = ['/home', '/discover', '/messages', '/notifications', '/profile'];
