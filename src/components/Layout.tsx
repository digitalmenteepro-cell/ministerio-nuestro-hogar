import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3, CalendarDays, ClipboardCheck, FileText, Guitar, Home, LogOut,
  Megaphone, Menu, Music2, Search, Settings, User, Users, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlobalSearch } from '@/components/GlobalSearch';
import { OneSignalNotifications } from '@/components/OneSignalNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { cn, fullName, initials } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
}

const MEMBER_NAV: NavItem[] = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/calendario', label: 'Calendario', icon: CalendarDays },
  { to: '/repertorio', label: 'Repertorio', icon: Music2 },
  { to: '/archivos', label: 'Archivos', icon: FileText },
  { to: '/anuncios', label: 'Anuncios', icon: Megaphone },
  { to: '/perfil', label: 'Mi perfil', icon: User },
];

const ADMIN_NAV: NavItem[] = [
  { to: '/integrantes', label: 'Integrantes', icon: Users },
  { to: '/instrumentos', label: 'Instrumentos', icon: Guitar },
  { to: '/asistencia', label: 'Asistencia', icon: ClipboardCheck },
  { to: '/estadisticas', label: 'Estadísticas', icon: BarChart3 },
  { to: '/configuracion', label: 'Configuración', icon: Settings },
];

/** Bottom bar on phones — 5 slots max to stay tappable. */
const MOBILE_NAV: NavItem[] = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/calendario', label: 'Agenda', icon: CalendarDays },
  { to: '/repertorio', label: 'Canciones', icon: Music2 },
  { to: '/anuncios', label: 'Anuncios', icon: Megaphone },
  { to: '/perfil', label: 'Perfil', icon: User },
];

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const links = isAdmin ? [...MEMBER_NAV, ...ADMIN_NAV] : MEMBER_NAV;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand text-sm font-black text-white">
          NH
        </div>
        <div className="min-w-0">
          <p className="truncate font-bold leading-tight">Nuestro Hogar</p>
          <p className="truncate text-xs text-muted-foreground">Ministerio de Alabanza</p>
        </div>
      </div>

      <OneSignalNotifications />

      <Button
        variant="secondary"
        className="mb-4 w-full justify-start gap-2 text-muted-foreground"
        onClick={() => {
          setMenuOpen(false);
          setSearchOpen(true);
        }}
      >
        <Search className="h-4 w-4" />
        Buscar…
      </Button>

      <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-thin" aria-label="Navegación principal">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => setMenuOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-brand text-white' : 'text-zinc-300 hover:bg-accent',
              )
            }
          >
            <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-4 border-t border-border pt-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-brand/25 text-xs font-bold text-brand-200">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              initials(profile)
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{fullName(profile)}</p>
            <p className="text-xs text-muted-foreground">{isAdmin ? 'Administrador' : 'Músico'}</p>
          </div>
        </div>
        <Button variant="ghost" className="w-full justify-start gap-2" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-zinc-950 p-4 md:block">
        {sidebarContent}
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="relative h-full w-72 border-r border-border bg-zinc-950 p-4">
            <button
              type="button"
              aria-label="Cerrar menú"
              className="absolute right-3 top-3 rounded-md p-1 hover:bg-accent"
              onClick={() => setMenuOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-zinc-950/90 px-4 backdrop-blur md:hidden">
        <button type="button" aria-label="Abrir menú" onClick={() => setMenuOpen(true)}>
          <Menu className="h-6 w-6" />
        </button>
        <span className="flex-1 font-semibold">Nuestro Hogar</span>
        <button type="button" aria-label="Buscar" onClick={() => setSearchOpen(true)}>
          <Search className="h-5 w-5" />
        </button>
      </header>

      <main className="p-4 pb-28 md:ml-64 md:p-8 md:pb-8">
        <Outlet />
      </main>

      <nav
        className="pb-safe fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-border bg-zinc-950/95 p-1.5 backdrop-blur md:hidden"
        aria-label="Navegación inferior"
      >
        {MOBILE_NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-colors',
                isActive ? 'text-brand-300' : 'text-zinc-500',
              )
            }
          >
            <Icon className="h-5 w-5" aria-hidden />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
