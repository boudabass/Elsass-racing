import {
  Camera,
  Car,
  CalendarDays,
  Euro,
  Folder,
  Handshake,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Plus,
  Search,
  Settings,
  Users,
  Wrench,
  House,
  type LucideIcon,
} from "lucide-react"

// Icônes des apps, par nom lucide (champ « icone » du catalogue). Une icône absente de
// cette table retombe sur Settings : mieux qu'une case vide.
const ICONES_APPS: Record<string, LucideIcon> = {
  "calendar-days": CalendarDays,
  euro: Euro,
  handshake: Handshake,
  car: Car,
  wrench: Wrench,
  users: Users,
  "list-checks": ListChecks,
  folder: Folder,
  camera: Camera,
  "layout-dashboard": LayoutDashboard,
  settings: Settings,
}

export function iconeApp(nom: string): LucideIcon {
  return ICONES_APPS[nom] ?? Settings
}

export { Inbox, Plus, Search, House }
