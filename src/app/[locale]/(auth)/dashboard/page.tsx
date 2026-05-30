import { AppSidebar } from '@/components/app-sidebar';
import { DashboardHeader } from '@/components/dashboard-header';
import { DashboardContent } from '@/components/DashboardContent';
import { RestaurantUrlSync } from '@/components/RestaurantUrlSync';
import {
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { RestaurantProvider } from '@/contexts/RestaurantContext';
import {
  getDomiciliosConCarritoActivo,
  getDomiciliosConRelaciones,
  getMesas,
  getMesasConCarritoActivo,
  getRestaurantes,
} from '@/services/restaurante.service';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ restauranteId?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  // Determinar qué restaurante usar: el de la URL o el primero por defecto
  const restauranteIdFromUrl = resolvedSearchParams?.restauranteId
    ? Number.parseInt(resolvedSearchParams.restauranteId, 10)
    : null;

  // Lanzar todas las queries en paralelo usando el restauranteId de la URL directamente
  const [mesas, restaurantes, domicilios, mesasConCarrito, domiciliosConCarrito] = await Promise.all([
    getMesas(),
    getRestaurantes(),
    restauranteIdFromUrl ? getDomiciliosConRelaciones(restauranteIdFromUrl) : Promise.resolve([]),
    restauranteIdFromUrl ? getMesasConCarritoActivo(restauranteIdFromUrl) : Promise.resolve([]),
    restauranteIdFromUrl ? getDomiciliosConCarritoActivo(restauranteIdFromUrl) : Promise.resolve([]),
  ]);

  const restauranteSeleccionado = restauranteIdFromUrl
    ? restaurantes.find(r => r.id === restauranteIdFromUrl) || restaurantes[0]
    : restaurantes[0];

  const restauranteDefault = restaurantes.length > 0 ? restauranteSeleccionado : undefined;

  return (
    <RestaurantProvider defaultRestaurant={restauranteDefault}>
      <RestaurantUrlSync restaurantes={restaurantes} />
      <SidebarProvider defaultOpen={false}>
        <AppSidebar restaurantes={restaurantes} />
        <SidebarInset>
          <DashboardHeader />
          <DashboardContent
            todasLasMesas={mesas}
            todosLosDomicilios={domicilios}
            mesasConCarrito={mesasConCarrito}
            domiciliosConCarrito={domiciliosConCarrito}
          />
        </SidebarInset>
      </SidebarProvider>
    </RestaurantProvider>
  );
}
