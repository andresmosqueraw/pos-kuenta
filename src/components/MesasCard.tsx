'use client';

import type { Mesa } from '@/types/database';
import { AnimatePresence, motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type EstadoVisual = 'disponible' | 'ocupada';

const EMPTY_ARRAY: number[] = [];

export function MesasCard({
  mesas,
  mesasConCarrito = EMPTY_ARRAY,
  className,
}: {
  mesas: Mesa[];
  mesasConCarrito?: number[];
  className?: string;
}) {
  const [filter, setFilter] = React.useState('');

  // Log para debugging
  React.useEffect(() => {
    console.warn('📊 [MesasCard] Estado de mesas:', {
      totalMesas: mesas.length,
      mesasConCarrito: mesasConCarrito.length,
      mesasConCarritoIds: mesasConCarrito,
      mesasDetalle: mesas.map(m => ({
        id: m.id,
        numero: m.numero_mesa,
        tieneCarrito: mesasConCarrito.includes(m.id),
        estadoVisual: mesasConCarrito.includes(m.id) ? 'OCUPADA' : 'DISPONIBLE',
      })),
    });
  }, [mesas, mesasConCarrito]);

  // Función para determinar el estado visual de una mesa
  const getEstadoVisual = (mesa: Mesa): EstadoVisual => {
    // Si tiene carrito activo con productos → Ocupada
    if (mesasConCarrito.includes(mesa.id)) {
      return 'ocupada';
    }
    // Si no tiene pedidos → Disponible
    return 'disponible';
  };

  // Filtrar mesas basado en el filtro de búsqueda
  const mesasFiltradas = React.useMemo(() => {
    if (!filter.trim()) {
      return mesas;
    }
    const filterLower = filter.toLowerCase();
    return mesas.filter(mesa =>
      mesa.numero_mesa.toString().includes(filterLower)
      || mesa.capacidad?.toString().includes(filterLower)
      || mesa.restaurante_id.toString().includes(filterLower),
    );
  }, [mesas, filter]);

  const mesasDisponibles = mesasFiltradas.filter(m => getEstadoVisual(m) === 'disponible');
  const mesasOcupadas = mesasFiltradas.filter(m => getEstadoVisual(m) === 'ocupada');

  // Dividir mesas en grupos de máximo 10
  const gruposDeMesas = React.useMemo(() => {
    const grupos: Mesa[][] = [];
    for (let i = 0; i < mesasFiltradas.length; i += 10) {
      grupos.push(mesasFiltradas.slice(i, i + 10));
    }
    return grupos;
  }, [mesasFiltradas]);

  const router = useRouter();

  // Componente para renderizar una tabla de mesas
  const renderTablaMesas = (mesasGrupo: Mesa[], indiceGrupo: number) => {
    const coloresBadge = {
      disponible: 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 dark:bg-emerald-950/40',
      ocupada: 'bg-red-500/15 text-red-500 border border-red-500/30 dark:bg-red-950/40',
    };

    const textoEstado = {
      disponible: 'Disponible',
      ocupada: 'Ocupada',
    };

    const handleRowClick = (mesa: Mesa) => {
      router.push(`/pos?tipo=mesa&id=${mesa.id}&numero=${mesa.numero_mesa}&restauranteId=${mesa.restaurante_id}`);
    };

    return (
      <div key={indiceGrupo} className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="hide-scrollbar overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left">
                  <span className="text-sm font-semibold text-muted-foreground">Mesa</span>
                </th>
                <th className="px-4 py-3 text-left">
                  <span className="text-sm font-semibold text-muted-foreground">Capacidad</span>
                </th>
                <th className="px-4 py-3 text-left">
                  <span className="text-sm font-semibold text-muted-foreground">Estado</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {mesasGrupo.map((mesa, index) => {
                  const estadoVisual = getEstadoVisual(mesa);

                  return (
                    <motion.tr
                      key={mesa.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: index * 0.03, duration: 0.2 }}
                      onClick={() => handleRowClick(mesa)}
                      className="cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/20"
                    >
                      <td className="px-4 py-3">
                        <span className="text-base font-medium text-foreground">
                          Mesa
                          {' '}
                          {mesa.numero_mesa}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-base text-muted-foreground">
                          {mesa.capacidad || 'N/A'}
                          {' '}
                          personas
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-light ${coloresBadge[estadoVisual]}`}>
                          {textoEstado[estadoVisual]}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Mesas</h2>
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter mesas..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="h-8 w-40 pl-8 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-sm font-medium text-emerald-500 dark:bg-emerald-950/40">
          {mesasDisponibles.length}
          {' '}
          Disponibles
        </span>
        <span className="rounded-full border border-red-500/30 bg-red-500/15 px-3 py-1 text-sm font-medium text-red-500 dark:bg-red-950/40">
          {mesasOcupadas.length}
          {' '}
          Ocupadas
        </span>
      </div>

      {mesasFiltradas.length === 0
        ? (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="py-8 text-center text-sm text-muted-foreground">
                {mesas.length === 0 ? 'No hay mesas registradas' : 'No se encontraron mesas'}
              </div>
            </div>
          )
        : gruposDeMesas.length > 1
          ? (
              // Si hay más de 10 mesas, mostrar 2 tablas lado a lado
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {gruposDeMesas.map((grupo, indice) => renderTablaMesas(grupo, indice))}
              </div>
            )
          : (
              // Si hay 10 o menos, mostrar una sola tabla
              renderTablaMesas(gruposDeMesas[0] || [], 0)
            )}
    </div>
  );
}
