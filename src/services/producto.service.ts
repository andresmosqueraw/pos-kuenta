import type { Product } from '@/app/[locale]/(auth)/pos/context/cart-context';
import type { Categoria } from '@/types/database';
import { createClient } from '@/libs/supabase/server';

// Imágenes disponibles para asignar según heurísticas
const IMAGENES_DISPONIBLES = {
  // Platos principales (orden específico primero)
  'plato ejecutivo': '/plato-ejecutivo.png',
  'plato casero': '/plato-casero.png',
  'ejecutivo': '/plato-ejecutivo.png',
  'casero': '/plato-casero.png',
  'plato': '/plato-casero.png',
  // Sopas
  'sopa': '/sopa.png',
  'caldo': '/caldo.png',
  // Bebidas
  'jugo': '/glass-of-orange-juice.png',
  'agua': '/bottled-water.png',
  'cola': '/refreshing-cola.png',
  'limonada': '/iced-tea.png',
  // Café y bebidas calientes
  'cafe': '/latte-coffee.png',
  'chocolate': '/chocolate-cake-slice.png',
  'tinto': '/latte-coffee.png',
  'aromatica': '/iced-tea.png',
  // Desayunos
  'desayuno': '/desayuno.png',
  'huevo': '/huevos.png',
  'huevos': '/huevos.png',
  'pan': '/apple-pie-slice.png',
  // Proteínas y especiales
  'especial': '/plato-especial.png',
  'sobrebarriga': '/plato-especial.png',
  'mojarra': '/plato-especial.png',
  'lomo': '/plato-especial.png',
  'churrasco': '/plato-especial.png',
  'costillas': '/plato-especial.png',
  'churrasquito': '/plato-especial.png',
  'pechuga': '/plato-especial.png',
  // Acompañamientos
  'proteina': '/crispy-chicken-wings.png',
  'papa': '/crispy-french-fries.png',
  'patacon': '/crispy-french-fries.png',
  'arroz': '/arroz.png',
  // Postres y dulces
  'fruta': '/fruta.png',
  'banano': '/fruta.png',
  'torta': '/chocolate-cake-slice.png',
  'gelatina': '/ice-cream-sundae.png',
  'leche': '/cheesecake-slice.png',
  // Otros
  'icopor': '/bottled-water.png',
  'calentada': '/delicious-pizza.png',
  'moñona': '/delicious-pizza.png',
  'rancheros': '/huevos.png',
  'cacerola': '/huevos.png',
  // Por defecto
  'default': '/plato-casero.png',
};

/**
 * Asigna una imagen basada en heurísticas del nombre del producto
 */
export function asignarImagenAProducto(nombreProducto: string, _productoId: number): string {
  const nombreLower = nombreProducto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036F]/g, ''); // Normalizar y quitar acentos

  // Buscar palabras clave en el nombre del producto
  const palabrasClave = Object.keys(IMAGENES_DISPONIBLES).filter(key => key !== 'default');

  // Buscar coincidencias (ordenadas por especificidad: frases completas primero, luego palabras más largas)
  const palabrasOrdenadas = palabrasClave.sort((a, b) => {
    // Priorizar frases de múltiples palabras
    const aIsPhrase = a.includes(' ');
    const bIsPhrase = b.includes(' ');
    if (aIsPhrase && !bIsPhrase) {
      return -1;
    }
    if (!aIsPhrase && bIsPhrase) {
      return 1;
    }
    // Si ambos son frases o palabras, ordenar por longitud
    return b.length - a.length;
  });

  for (const palabra of palabrasOrdenadas) {
    if (nombreLower.includes(palabra)) {
      return IMAGENES_DISPONIBLES[palabra as keyof typeof IMAGENES_DISPONIBLES] || IMAGENES_DISPONIBLES.default;
    }
  }

  // Si no hay coincidencia, usar imagen por defecto
  return IMAGENES_DISPONIBLES.default;
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
