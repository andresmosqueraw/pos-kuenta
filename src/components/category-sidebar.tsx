'use client';

import type React from 'react';

import type { CategoriaConSlug } from '@/services/producto.service';
import { ArrowLeft, Coffee, IceCream, LayoutGrid, Loader2, ShoppingBag, Utensils } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const EMPTY_CATEGORIAS: CategoriaConSlug[] = [];

type CategorySidebarProps = {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  categorias?: CategoriaConSlug[];
};

type CategoryItem = {
  id: string;
  name: string;
  icon: React.ElementType;
};

// Categorías por defecto (fallback)
const categoriasEstaticas: CategoryItem[] = [
  {
    id: 'all',
    name: 'Todos',
    icon: LayoutGrid,
  },
  {
    id: 'food',
    name: 'Food',
    icon: Utensils,
  },
  {
    id: 'drinks',
    name: 'Drinks',
    icon: Coffee,
  },
  {
    id: 'desserts',
    name: 'Desserts',
    icon: IceCream,
  },
];

// Mapa de iconos por slug de categoría
const ICONOS_POR_CATEGORIA: Record<string, React.ElementType> = {
  all: LayoutGrid,
  food: Utensils,
  comida: Utensils,
  drinks: Coffee,
  bebidas: Coffee,
  desserts: IceCream,
  postres: IceCream,
  default: ShoppingBag,
};

export default function CategorySidebar({
  selectedCategory,
  onSelectCategory,
  categorias = EMPTY_CATEGORIAS,
}: CategorySidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);

  // Construir lista de categorías dinámicamente
  const categoriasMostradas = useMemo(() => {
    if (categorias.length === 0) {
      return categoriasEstaticas;
    }

    // Agregar "All Products" al inicio
    const todasLasCategorias: CategoryItem[] = [
      {
        id: 'all',
        name: 'Todos',
        icon: LayoutGrid,
      },
    ];

    // Agregar categorías de Supabase
    categorias.forEach((cat) => {
      const icon = ICONOS_POR_CATEGORIA[cat.slug] || ICONOS_POR_CATEGORIA.default || ShoppingBag;
      todasLasCategorias.push({
        id: cat.slug,
        name: cat.nombre,
        icon,
      });
    });

    return todasLasCategorias;
  }, [categorias]);

  const handleBackToDashboard = async () => {
    setIsNavigating(true);
    console.warn('🔄 [CategorySidebar] Navegando a dashboard y refrescando datos...');

    try {
      // Obtener restauranteId de la URL del POS para mantener el restaurante seleccionado
      const restauranteId = searchParams.get('restauranteId');

      // Construir URL del dashboard con restauranteId si existe
      const dashboardUrl = restauranteId
        ? `/dashboard?restauranteId=${restauranteId}`
        : '/dashboard';

      // Navegar al dashboard - el revalidatePath del API ya invalidó el cache
      // pero hacemos refresh explícito para asegurar datos frescos
      router.push(dashboardUrl);
      router.refresh();
    } catch (error) {
      console.error('Error al navegar al dashboard:', error);
      setIsNavigating(false);
    }
  };

  return (
    <div className="flex h-screen w-40 flex-col border-r bg-background p-4">
      <button
        type="button"
        className="group relative mb-4 w-full shrink-0 overflow-hidden rounded border border-blue-400 bg-blue-900 px-6 py-3 font-mono tracking-wider text-blue-300 uppercase transition-all duration-300 hover:border-blue-300 disabled:pointer-events-none disabled:opacity-50"
        onClick={handleBackToDashboard}
        disabled={isNavigating}
      >
        {isNavigating
          ? (
              <Loader2 className="mr-2 inline-block h-5 w-5 animate-spin" />
            )
          : (
              <ArrowLeft className="mr-2 inline-block h-5 w-5" />
            )}
        {isNavigating ? 'Cargando...' : 'Guardar y volver a mesas'}
        <div className="absolute inset-0 rounded border-2 border-blue-400 opacity-0 transition-opacity duration-300 group-hover:animate-pulse group-hover:opacity-100" />
        <div className="absolute top-1/2 left-1/2 h-0 w-0 -translate-x-10 -translate-y-10 rounded-full border-2 border-blue-400 transition-all duration-500 group-hover:h-20 group-hover:w-20" />
      </button>
      <h2 className="mb-4 shrink-0 text-lg font-semibold">Categorías</h2>
      <div className="flex-1 overflow-y-auto">
        <div className="grid gap-3">
          {categoriasMostradas.map((category) => {
            const Icon = category.icon;
            return (
              <Button
                key={category.id}
                variant="ghost"
                className={cn(
                  'flex h-auto flex-col items-center justify-center py-4 border bg-transparent',
                  selectedCategory === category.id
                    ? 'border-2 border-primary text-foreground font-medium'
                    : 'border-muted text-muted-foreground hover:border-muted-foreground hover:text-foreground',
                  'hover:bg-transparent',
                )}
                onClick={() => onSelectCategory(category.id)}
              >
                <Icon className="mb-2 h-6 w-6" />
                <span className="text-sm">{category.name}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
