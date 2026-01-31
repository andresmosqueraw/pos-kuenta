'use client';

import type { DomicilioConRestaurantes } from '@/services/restaurante.service';
import type { Mesa } from '@/types/database';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { DomiciliosCard } from '@/components/DomiciliosCard';
import { MesasCard } from '@/components/MesasCard';
import { useRestaurant } from '@/contexts/RestaurantContext';

export function DashboardContent({
  todasLasMesas,
  todosLosDomicilios,
  mesasConCarrito,
  domiciliosConCarrito,
}: {
  todasLasMesas: Mesa[];
  todosLosDomicilios: DomicilioConRestaurantes[];
  mesasConCarrito: number[];
  domiciliosConCarrito: number[];
}) {
  const { selectedRestaurant } = useRestaurant();
  const router = useRouter();
  const [showReloadIndicator, setShowReloadIndicator] = React.useState(false);

  // Verificar si la página se recargó desde el botón "atrás" del navegador
  React.useEffect(() => {
    console.warn('🔍 [DashboardContent] Verificando sessionStorage...');
    const reloadFromBack = sessionStorage.getItem('dashboard_reload_from_back');
    const reloadTimestamp = sessionStorage.getItem('dashboard_reload_timestamp');

    console.warn('🔍 [DashboardContent] Valores encontrados:', {
      reloadFromBack,
      reloadTimestamp,
      timestamp: reloadTimestamp ? Number.parseInt(reloadTimestamp, 10) : null,
      now: Date.now(),
    });

    if (reloadFromBack === 'true' && reloadTimestamp) {
      const timestamp = Number.parseInt(reloadTimestamp, 10);
      const now = Date.now();
      const diff = now - timestamp;

      console.warn('🔍 [DashboardContent] Diferencia de tiempo:', diff, 'ms');

      // Verificar si debe recargar 2 veces
      const reloadTwice = sessionStorage.getItem('dashboard_reload_twice') === 'true';

      if (reloadTwice) {
        console.warn('🔄 [DashboardContent] Recargando página 2 veces...');
        // Limpiar el flag inmediatamente para evitar loops
        sessionStorage.removeItem('dashboard_reload_twice');
        sessionStorage.removeItem('dashboard_reload_from_back');
        sessionStorage.removeItem('dashboard_reload_timestamp');

        // Primera recarga
        setTimeout(() => {
          window.location.reload();
        }, 100);

        // Segunda recarga (se ejecutará después de la primera)
        setTimeout(() => {
          window.location.reload();
        }, 300);

        return;
      }

      // Mostrar indicador si la recarga fue hace menos de 5 segundos (aumentado para debug)
      if (diff < 5000) {
        console.warn('✅ [DashboardContent] ════════════════════════════════════════════════════');
        console.warn('✅ [DashboardContent] ✅ DASHBOARD RECARGADO DESDE BOTÓN ATRÁS');
        console.warn('✅ [DashboardContent] ✅ Timestamp:', timestamp, '| Ahora:', now, '| Diff:', diff, 'ms');
        console.warn('✅ [DashboardContent] ✅ Los datos se han actualizado correctamente');
        console.warn('✅ [DashboardContent] ════════════════════════════════════════════════════');

        setShowReloadIndicator(true);

        // Limpiar el flag después de mostrar el indicador
        sessionStorage.removeItem('dashboard_reload_from_back');
        sessionStorage.removeItem('dashboard_reload_timestamp');

        // Ocultar el indicador después de 5 segundos
        setTimeout(() => {
          setShowReloadIndicator(false);
        }, 5000);
      } else {
        console.warn('⚠️ [DashboardContent] Timestamp muy antiguo, limpiando flags');
        // Limpiar flags antiguos
        sessionStorage.removeItem('dashboard_reload_from_back');
        sessionStorage.removeItem('dashboard_reload_timestamp');
      }
    } else {
      console.warn('🔍 [DashboardContent] No se encontraron flags de recarga desde botón atrás');
    }
  }, []);

  // Auto-refresh cuando la página se vuelve visible (usuario regresa del POS o cambia de pestaña)
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.warn('🔄 [DashboardContent] Página visible, refrescando datos...');
        router.refresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [router]);

  // Filtrar mesas por restaurante seleccionado
  const mesasFiltradas = React.useMemo(() => {
    if (!selectedRestaurant) {
      return todasLasMesas;
    }
    return todasLasMesas.filter(mesa => mesa.restaurante_id === selectedRestaurant.id);
  }, [todasLasMesas, selectedRestaurant]);

  // Filtrar domicilios por restaurante seleccionado
  // Los domicilios están relacionados con restaurantes a través de: domicilio → tipo_pedido → carrito → restaurante
  const domiciliosFiltrados = React.useMemo(() => {
    if (!selectedRestaurant) {
      return todosLosDomicilios;
    }
    return todosLosDomicilios.filter(domicilio =>
      domicilio.restaurantes_ids.includes(selectedRestaurant.id),
    );
  }, [todosLosDomicilios, selectedRestaurant]);

  // Filtrar domiciliosConCarrito para incluir solo los que están en los domicilios filtrados
  const domiciliosConCarritoFiltrados = React.useMemo(() => {
    const domiciliosFiltradosIds = new Set(domiciliosFiltrados.map(d => d.id));
    return domiciliosConCarrito.filter(id => domiciliosFiltradosIds.has(id));
  }, [domiciliosFiltrados, domiciliosConCarrito]);

  React.useEffect(() => {
    console.warn('📊 [DashboardContent] Estado de domicilios:', {
      restaurante: selectedRestaurant?.nombre,
      restauranteId: selectedRestaurant?.id,
      totalDomicilios: todosLosDomicilios.length,
      domiciliosFiltrados: domiciliosFiltrados.length,
      domiciliosConCarrito: domiciliosConCarrito.length,
      domiciliosConCarritoIds: domiciliosConCarrito,
      domiciliosConCarritoFiltrados: domiciliosConCarritoFiltrados.length,
      domiciliosConCarritoFiltradosIds: domiciliosConCarritoFiltrados,
      detalleDomicilios: domiciliosFiltrados.map(d => ({
        id: d.id,
        direccion: d.direccion,
        tieneCarrito: domiciliosConCarritoFiltrados.includes(d.id),
        estadoVisual: domiciliosConCarritoFiltrados.includes(d.id) ? 'CON PEDIDO' : 'DISPONIBLE',
      })),
    });
  }, [selectedRestaurant, domiciliosFiltrados, domiciliosConCarrito, domiciliosConCarritoFiltrados, todosLosDomicilios.length]);

  const domiciliosMostrados = domiciliosFiltrados;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Indicador visual cuando se recarga desde el botón "atrás" */}
      {showReloadIndicator && (
        <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-3 text-center">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            ✅ Dashboard recargado - Datos actualizados correctamente
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Mesas y Domicilios
          {selectedRestaurant && (
            <span className="ml-2 text-2xl font-bold">
              -
              {' '}
              {selectedRestaurant.nombre}
            </span>
          )}
        </h1>
      </div>

      <div className="flex flex-col gap-6">
        <MesasCard mesas={mesasFiltradas} mesasConCarrito={mesasConCarrito} />
        <DomiciliosCard domicilios={domiciliosMostrados} domiciliosConCarrito={domiciliosConCarritoFiltrados} />
      </div>
    </div>
  );
}
