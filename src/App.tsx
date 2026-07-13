import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminRoute, ProtectedRoute } from '@/components/RouteGuards';
import { Layout } from '@/components/Layout';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { isSupabaseConfigured } from '@/lib/supabase';
import { ConfigMissing } from '@/pages/ConfigMissing';
import { Login } from '@/pages/Login';
import { Recover } from '@/pages/Recover';
import { ChangePassword } from '@/pages/ChangePassword';
import { Unauthorized } from '@/pages/Unauthorized';
import { NotFound } from '@/pages/NotFound';
import { Dashboard } from '@/pages/Dashboard';
import { Profile } from '@/pages/Profile';
import { CalendarPage } from '@/pages/Calendar';
import { Songs } from '@/pages/Songs';
import { Files } from '@/pages/Files';
import { Announcements } from '@/pages/Announcements';
import { Members } from '@/pages/Members';
import { Instruments } from '@/pages/Instruments';
import { Attendance } from '@/pages/Attendance';
import { Stats } from '@/pages/Stats';
import { Settings } from '@/pages/Settings';

export default function App() {
  // Without env vars there is no client at all — show setup instructions.
  if (!isSupabaseConfigured) return <ConfigMissing />;

  return (
    <>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/recuperar" element={<Recover />} />
        <Route path="/cambiar-contrasena" element={<ChangePassword />} />
        <Route path="/sin-acceso" element={<Unauthorized />} />

        {/* Authenticated */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="perfil" element={<Profile />} />
            <Route path="calendario" element={<CalendarPage />} />
            <Route path="repertorio" element={<Songs />} />
            <Route path="archivos" element={<Files />} />
            <Route path="anuncios" element={<Announcements />} />

            {/* Admin only — mirrored by RLS policies in Supabase */}
            <Route element={<AdminRoute />}>
              <Route path="integrantes" element={<Members />} />
              <Route path="instrumentos" element={<Instruments />} />
              <Route path="asistencia" element={<Attendance />} />
              <Route path="estadisticas" element={<Stats />} />
              <Route path="configuracion" element={<Settings />} />
            </Route>
          </Route>
        </Route>

        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>

      <UpdatePrompt />
    </>
  );
}
