import {
  CloudOff,
  KeyRound,
  LayoutDashboard,
  Menu,
  Moon,
  PanelLeft,
  Server,
  Settings,
  Shield,
  Sun,
  Users,
} from "lucide-react";

export const lucideIcons = {
  menu: Menu,
  "panel-left": PanelLeft,
  settings: Settings,
  users: Users,
  shield: Shield,
  "key-round": KeyRound,
  "layout-dashboard": LayoutDashboard,
  server: Server,
  "cloud-off": CloudOff,
  moon: Moon,
  sun: Sun,
} as const;

export type SubHubLucideIconName = keyof typeof lucideIcons;

export {
  CloudOff,
  KeyRound,
  LayoutDashboard,
  Menu,
  Moon,
  PanelLeft,
  Server,
  Settings,
  Shield,
  Sun,
  Users,
};
