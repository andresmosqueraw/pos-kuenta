import type { Product } from '@/app/[locale]/(auth)/pos/context/cart-context';
import type { Categoria } from '@/types/database';
import { createClient } from '@/libs/supabase/server';

// Helpers
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .trim();
}

// Imágenes disponibles para asignar según heurísticas (CLAVES NORMALIZADAS)
const IMAGENES_DISPONIBLES: Record<string, string> = {
  // 🥘 Platos caseros y ejecutivos (prioridad alta)
  'plato ejecutivo sin sopa para llevar': '/products/plato-ejecutivo-sin-sopa-para-llevar.png',
  'plato ejecutivo para llevar': '/products/plato-ejecutivo-sin-sopa-para-llevar.png',
  'plato ejecutivo sin sopa': '/products/plato-ejecutivo-sin-sopa.png',
  'plato ejecutivo': '/products/plato-ejecutivo.png',

  'plato casero sin sopa para llevar': '/products/plato-casero-sin-sopa-para-llevar.png',
  'plato casero para llevar': '/products/plato-casero-sin-sopa-para-llevar.png',
  'plato casero sin sopa': '/products/plato-casero-sin-sopa.png',
  'plato casero': '/products/plato-casero.png',

  // 🥩 Especiales (y para llevar)
  'costillas de cerdo especial para llevar': '/products/plato-especial.png',
  'churrasco especial para llevar': '/products/plato-especial.png',
  'sobrebarriga especial para llevar': '/products/plato-especial.png',
  'mojarra especial para llevar': '/products/plato-especial.png',
  'trucha especial para llevar': '/products/plato-especial.png',
  'pechuga gratinada para llevar': '/products/plato-especial.png',
  'lomo especial para llevar': '/products/plato-especial.png',
  'churrasquito para llevar': '/products/plato-especial.png',

  'costillas de cerdo especial': '/products/plato-especial.png',
  'churrasco especial': '/products/plato-especial.png',
  'sobrebarriga especial': '/products/plato-especial.png',
  'mojarra especial': '/products/plato-especial.png',
  'trucha especial': '/products/plato-especial.png',
  'pechuga gratinada': '/products/plato-especial.png',
  'lomo especial': '/products/plato-especial.png',
  'churrasquito': '/products/plato-especial.png',

  // 🍳 Desayunos y huevos
  'desayuno completo llevar': '/products-old/desayuno.png',
  'desayuno completo': '/products-old/desayuno.png',
  'huevos rancheros': '/products-old/huevos.png',
  'huevos con arroz': '/products-old/huevos.png',
  'cacerola de huevos': '/products-old/huevos.png',
  'huevo': '/products-old/huevos.png',

  // 🍲 Sopas y caldos
  'sopa grande de llevar': '/products-old/sopa.png',
  'sopa pequena de llevar': '/products-old/sopa.png',
  'sopa grande': '/products-old/sopa.png',
  'sopa pequena': '/products-old/sopa.png',
  'caldo para llevar': '/products-old/caldo.png',
  'caldo': '/products-old/caldo.png',

  // 🍗 Porciones y acompañamientos
  'porcion de papa a la francesa': '/products-old/crispy-french-fries.png',
  'porcion de patacon': '/products-old/crispy-french-fries.png',
  'porcion yuca': '/products-old/crispy-french-fries.png',
  'porcion de proteina': '/products-old/crispy-chicken-wings.png',
  'porcion de arroz': '/products-old/arroz.png',
  'porcion de torta': '/products-old/chocolate-cake-slice.png',
  'pan': '/products-old/apple-pie-slice.png',

  // 🍕 Otros
  'calentada microondas': '/products-old/delicious-pizza.png',
  'monona para llevar': '/products-old/delicious-pizza.png',
  'monona': '/products-old/delicious-pizza.png',

  // 🍉 Frutas y postres
  'carnaval de gelatina': '/products-old/ice-cream-sundae.png',
  'arroz con leche': '/products-old/cheesecake-slice.png',
  'fruta para llevar': '/products/fruta.png',
  'banano': '/products/fruta.png',
  'fruta': '/products/fruta.png',

  // 🥤 Bebidas
  'jugo naranja': '/products-old/glass-of-orange-juice.png',
  'jugo adicional': '/products-old/glass-of-orange-juice.png',
  'limonada natural': '/products-old/iced-tea.png',
  'coca cola': '/products-old/refreshing-cola.png',
  'botella de agua': '/products-old/bottled-water.png',
  'cafe con leche': '/products-old/latte-coffee.png',
  'tinto': '/products-old/latte-coffee.png',
  'aromatica': '/products-old/iced-tea.png',
  'chocolate': '/products-old/chocolate-cake-slice.png',

  // 📦 Empaques
  'icopor pequeno': '/products-old/bottled-water.png',
  'icopor grande': '/products-old/bottled-water.png',

  // Por defecto
  'default': '/products/plato-casero-sin-sopa.png',
};

/**
 * Asigna una imagen basada en coincidencia parcial (match más específico primero)
 */
export function asignarImagenAProducto(nombreProducto: string, _productoId: number): string {
  const n = norm(nombreProducto);

  const keys = Object.keys(IMAGENES_DISPONIBLES).filter(k => k !== 'default');

  // ordenar por "más específico primero": más palabras y más longitud
  keys.sort((a, b) => {
    const wa = a.split(' ').length;
    const wb = b.split(' ').length;
    if (wa !== wb) {
      return wb - wa;
    } // más palabras primero
    return b.length - a.length; // luego más largo
  });

  for (const k of keys) {
    if (n.includes(k)) {
      return IMAGENES_DISPONIBLES[k] || IMAGENES_DISPONIBLES.default as string;
    }
  }

  return IMAGENES_DISPONIBLES.default || '' as string;
}

/**
 * Mapea el nombre de categoría de Supabase a un slug usado en el frontend
 */
function mapearNombreCategoriaASlug(nombreCategoria: string): string {
  const nombreLower = nombreCategoria.toLowerCase();

  // Mapeo directo de nombres comunes
  if (nombreLower === 'comida' || nombreLower === 'food'
    || nombreLower === 'platos' || nombreLower === 'entradas') {
    return 'food';
  }

  if (nombreLower === 'bebidas' || nombreLower === 'drinks'
    || nombreLower === 'refrescos') {
    return 'drinks';
  }

  if (nombreLower === 'postres' || nombreLower === 'desserts'
    || nombreLower === 'dulces') {
    return 'desserts';
  }

  // Por defecto, crear slug (lowercase, sin espacios)
  return nombreCategoria.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Obtiene todos los productos disponibles de un restaurante
 * La relación es: producto_restaurante → producto → producto_categoria → categoria → categoria_restaurante → restaurante
 */
export async function getProductosByRestaurante(
  restauranteId: number,
): Promise<Product[]> {
  const supabase = await createClient();

  // Paso 1: Obtener productos_restaurante disponibles
  console.warn(`🔍 [getProductosByRestaurante] Buscando productos para restaurante ${restauranteId}`);
  const { data: productosRestaurante, error: errorProductosRestaurante } = await supabase
    .from('producto_restaurante')
    .select(`
      id,
      producto_id,
      precio_venta,
      disponible,
      producto:producto_id (
        id,
        nombre,
        descripcion,
        precio
      )
    `)
    .eq('restaurante_id', restauranteId)
    .eq('disponible', true);

  if (errorProductosRestaurante) {
    console.error('❌ [getProductosByRestaurante] Error fetching producto_restaurante:', errorProductosRestaurante);
    return [];
  }

  if (!productosRestaurante || productosRestaurante.length === 0) {
    console.warn(`⚠️ [getProductosByRestaurante] No hay productos disponibles para restaurante ${restauranteId}`);
    return [];
  }

  console.warn(`✅ [getProductosByRestaurante] Encontrados ${productosRestaurante.length} productos_restaurante`);

  // Paso 2: Obtener las categorías visibles para este restaurante
  const { data: categoriasRestaurante, error: errorCategoriasRestaurante } = await supabase
    .from('categoria_restaurante')
    .select('categoria_id, categoria:categoria_id (id, nombre)')
    .eq('restaurante_id', restauranteId)
    .eq('visible', true);

  if (errorCategoriasRestaurante) {
    console.error('❌ [getProductosByRestaurante] Error fetching categorias_restaurante:', errorCategoriasRestaurante);
  } else {
    console.warn(`✅ [getProductosByRestaurante] Encontradas ${categoriasRestaurante?.length || 0} categorías visibles para el restaurante`);
  }

  const categoriasVisiblesIds = new Set(
    categoriasRestaurante?.map(cr => cr.categoria_id) || [],
  );

  // Paso 3: Obtener las relaciones producto_categoria para todos los productos
  const productoIds = productosRestaurante.map(pr => pr.producto_id);
  console.warn(`🔍 [getProductosByRestaurante] Buscando categorías para ${productoIds.length} productos`);
  const { data: productoCategorias, error: errorProductoCategorias } = await supabase
    .from('producto_categoria')
    .select('producto_id, categoria_id, categoria:categoria_id (id, nombre)')
    .in('producto_id', productoIds);

  if (errorProductoCategorias) {
    console.error('❌ [getProductosByRestaurante] Error fetching producto_categoria:', errorProductoCategorias);
  } else {
    console.warn(`✅ [getProductosByRestaurante] Encontradas ${productoCategorias?.length || 0} relaciones producto_categoria`);
  }

  // Paso 4: Crear un mapa de producto_id -> categoría (solo categorías visibles para el restaurante)
  const productoCategoriaMap = new Map<number, string>();
  productoCategorias?.forEach((pc) => {
    const categoriaId = pc.categoria_id;
    // Solo incluir si la categoría está visible para este restaurante
    if (categoriasVisiblesIds.has(categoriaId)) {
      const categoria = Array.isArray(pc.categoria) ? pc.categoria[0] : pc.categoria;
      if (categoria && typeof categoria === 'object' && 'nombre' in categoria) {
        const nombreCategoria = String(categoria.nombre);
        // Usar la primera categoría encontrada (o podemos usar todas si el modelo lo requiere)
        if (!productoCategoriaMap.has(pc.producto_id)) {
          productoCategoriaMap.set(pc.producto_id, nombreCategoria);
        }
      }
    }
  });

  // Paso 5: Transformar los datos al formato Product
  const productos: Product[] = productosRestaurante
    .filter(item => item.producto) // Filtrar items sin producto
    .map((item) => {
      const producto = Array.isArray(item.producto) ? item.producto[0] : item.producto;

      // Type guard: asegurar que producto existe
      if (!producto) {
        throw new Error('Producto no encontrado después del filtro');
      }

      // Obtener nombre de categoría del mapa (o usar default)
      const nombreCategoria = productoCategoriaMap.get(producto.id) || 'food';
      const categoriaSlug = mapearNombreCategoriaASlug(nombreCategoria);

      // Usar precio_venta del producto_restaurante si está disponible, sino el precio base del producto
      const precio = item.precio_venta ? Number(item.precio_venta) : Number(producto.precio);

      return {
        id: producto.id,
        name: producto.nombre,
        price: precio,
        image: asignarImagenAProducto(producto.nombre, producto.id),
        category: categoriaSlug,
      };
    });

  console.warn(`✅ [getProductosByRestaurante] Cargados ${productos.length} productos para restaurante ${restauranteId}`);
  const primerProducto = productos[0];
  if (primerProducto) {
    console.warn(`📦 [getProductosByRestaurante] Primer producto:`, {
      id: primerProducto.id,
      name: primerProducto.name,
      price: primerProducto.price,
      category: primerProducto.category,
    });
  }

  return productos;
}

/**
 * Obtiene el producto_restaurante_id para un producto y restaurante dados
 */
export async function getProductoRestauranteId(
  productoId: number,
  restauranteId: number,
): Promise<number | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('producto_restaurante')
    .select('id')
    .eq('producto_id', productoId)
    .eq('restaurante_id', restauranteId)
    .single();

  if (error || !data) {
    console.error(`Error buscando producto_restaurante:`, error);
    return null;
  }

  return data.id;
}

/**
 * Obtiene todos los IDs de producto_restaurante para una lista de productos
 */
export async function mapearProductosARestaurante(
  productosIds: number[],
  restauranteId: number,
): Promise<Map<number, number>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('producto_restaurante')
    .select('id, producto_id')
    .eq('restaurante_id', restauranteId)
    .in('producto_id', productosIds);

  if (error || !data) {
    console.error('Error mapeando productos:', error);
    return new Map();
  }

  // Crear mapa: producto_id -> producto_restaurante_id
  const mapa = new Map<number, number>();
  data.forEach((item) => {
    mapa.set(item.producto_id, item.id);
  });

  return mapa;
}

/**
 * Obtiene todas las categorías ordenadas
 */
export async function getCategorias(): Promise<Categoria[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('categoria')
    .select('*')
    .order('orden', { ascending: true })
    .order('nombre', { ascending: true });

  if (error) {
    console.error('Error fetching categorias:', error);
    return [];
  }

  return data || [];
}

/**
 * Obtiene las categorías visibles para un restaurante específico
 * La relación es: categoria_restaurante → categoria
 */
export async function getCategoriasByRestaurante(
  restauranteId: number,
): Promise<Categoria[]> {
  const supabase = await createClient();

  console.warn(`🔍 [getCategoriasByRestaurante] Buscando categorías para restaurante ${restauranteId}`);

  const { data, error } = await supabase
    .from('categoria_restaurante')
    .select(`
      orden,
      categoria:categoria_id (
        id,
        nombre,
        descripcion
      )
    `)
    .eq('restaurante_id', restauranteId)
    .eq('visible', true)
    .order('orden', { ascending: true });

  if (error) {
    console.error('❌ [getCategoriasByRestaurante] Error fetching categorias_restaurante:', error);
    return [];
  }

  if (!data || data.length === 0) {
    console.warn(`⚠️ [getCategoriasByRestaurante] No hay categorías visibles para restaurante ${restauranteId}`);
    return [];
  }

  // Extraer las categorías del resultado anidado
  const categorias: Categoria[] = data
    .map((item) => {
      const categoria = Array.isArray(item.categoria) ? item.categoria[0] : item.categoria;
      if (!categoria || typeof categoria !== 'object') {
        return null;
      }
      return {
        id: categoria.id,
        nombre: categoria.nombre,
        descripcion: categoria.descripcion || null,
        orden: item.orden || 0,
      } as Categoria;
    })
    .filter((cat): cat is Categoria => cat !== null);

  console.warn(`✅ [getCategoriasByRestaurante] Encontradas ${categorias.length} categorías visibles para el restaurante`);

  return categorias;
}

/**
 * Tipo para categorías con slug para el frontend
 */
export type CategoriaConSlug = Categoria & {
  slug: string;
};

/**
 * Obtiene categorías y agrega slug para el frontend
 * Si se proporciona restauranteId, solo retorna las categorías visibles para ese restaurante
 */
export async function getCategoriasConSlug(
  restauranteId?: number,
): Promise<CategoriaConSlug[]> {
  const categorias = restauranteId
    ? await getCategoriasByRestaurante(restauranteId)
    : await getCategorias();

  return categorias.map(cat => ({
    ...cat,
    slug: mapearNombreCategoriaASlug(cat.nombre),
  }));
}
