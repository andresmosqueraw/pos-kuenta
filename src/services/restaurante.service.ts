import type { Domicilio, Mesa, Restaurante } from '@/types/database';
import { createClient } from '@/libs/supabase/server';

export async function getRestaurantes(): Promise<Restaurante[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('restaurante')
    .select('*')
    .order('id', { ascending: true }); // Ordenar por ID para obtener siempre el primer restaurante creado

  if (error) {
    console.error('Error fetching restaurantes:', error);
    return [];
  }

  return data || [];
}

export async function getMesas(): Promise<Mesa[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('mesa')
    .select('*')
    .order('restaurante_id', { ascending: true })
    .order('numero_mesa', { ascending: true });

  if (error) {
    console.error('Error fetching mesas:', error);
    return [];
  }

  return data || [];
}

export type DomicilioConRestaurantes = Domicilio & {
  restaurantes_ids: number[];
  cliente_nombre?: string;
};

export async function getDomicilios(): Promise<Domicilio[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('domicilio')
    .select('*')
    .order('creado_en', { ascending: false });

  if (error) {
    console.error('Error fetching domicilios:', error);
    return [];
  }

  return data || [];
}

/**
 * Obtiene todos los domicilios de clientes registrados en restaurantes usando RPC optimizado
 * Usa la función RPC get_clientes_y_domicilios_por_restaurante para máxima eficiencia
 *
 * @param restauranteId - Requerido: ID del restaurante para filtrar
 */
export async function getDomiciliosConRelaciones(restauranteId?: number): Promise<DomicilioConRestaurantes[]> {
  if (!restauranteId) {
    console.warn('⚠️ [getDomiciliosConRelaciones] restauranteId es requerido para usar RPC');
    return [];
  }

  const supabase = await createClient();

  // Llamar a la función RPC optimizada
  const { data: clientesData, error: rpcError } = await supabase.rpc('get_clientes_y_domicilios_por_restaurante', {
    p_restaurante_id: restauranteId,
  });

  if (rpcError) {
    console.error('❌ [getDomiciliosConRelaciones] Error en RPC get_clientes_y_domicilios_por_restaurante:', rpcError);
    return [];
  }

  if (!clientesData || clientesData.length === 0) {
    console.warn(`⚠️ [getDomiciliosConRelaciones] No hay clientes registrados para restaurante ${restauranteId}`);
    return [];
  }

  console.warn(`✅ [getDomiciliosConRelaciones] RPC retornó ${clientesData.length} clientes para restaurante ${restauranteId}`);

  // Obtener IDs de todos los domicilios para consultar campos faltantes (referencia, creado_en)
  const domicilioIds: number[] = [];
  clientesData.forEach((cliente: any) => {
    if (cliente.domicilios_json && Array.isArray(cliente.domicilios_json)) {
      cliente.domicilios_json.forEach((dom: any) => {
        if (dom.domicilio_id) {
          domicilioIds.push(dom.domicilio_id);
        }
      });
    }
  });

  // Obtener información completa de domicilios (solo campos faltantes)
  const domiciliosCompletos = new Map<number, { referencia: string | null; creado_en: string }>();
  if (domicilioIds.length > 0) {
    const { data: domiciliosData, error: domiciliosError } = await supabase
      .from('domicilio')
      .select('id, referencia, creado_en')
      .in('id', domicilioIds);

    if (!domiciliosError && domiciliosData) {
      domiciliosData.forEach((dom) => {
        domiciliosCompletos.set(dom.id, {
          referencia: dom.referencia,
          creado_en: dom.creado_en,
        });
      });
    }
  }

  // Obtener información de pedidos para determinar restaurantes que han hecho pedidos
  // Esto es para el estado "Con pedido" vs "Disponible"
  const [tiposPedidoResult, carritosResult] = await Promise.all([
    supabase
      .from('tipo_pedido')
      .select('id, domicilio_id')
      .not('domicilio_id', 'is', null)
      .in('domicilio_id', domicilioIds),
    supabase
      .from('carrito')
      .select('tipo_pedido_id, restaurante_id'),
  ]);

  const { data: tiposPedido } = tiposPedidoResult;
  const { data: carritos } = carritosResult;

  // Crear mapa de tipo_pedido_id -> restaurante_ids (para pedidos históricos)
  const tipoPedidoRestaurantesMap = new Map<number, Set<number>>();
  carritos?.forEach((carrito) => {
    if (!tipoPedidoRestaurantesMap.has(carrito.tipo_pedido_id)) {
      tipoPedidoRestaurantesMap.set(carrito.tipo_pedido_id, new Set());
    }
    if (carrito.restaurante_id) {
      tipoPedidoRestaurantesMap.get(carrito.tipo_pedido_id)!.add(carrito.restaurante_id);
    }
  });

  // Crear mapa de domicilio_id -> restaurantes_ids (de pedidos históricos)
  const domicilioPedidosMap = new Map<number, Set<number>>();
  tiposPedido?.forEach((tp) => {
    if (tp.domicilio_id) {
      if (!domicilioPedidosMap.has(tp.domicilio_id)) {
        domicilioPedidosMap.set(tp.domicilio_id, new Set());
      }
      const restaurantes = tipoPedidoRestaurantesMap.get(tp.id);
      if (restaurantes) {
        restaurantes.forEach((restId) => {
          domicilioPedidosMap.get(tp.domicilio_id)!.add(restId);
        });
      }
    }
  });

  // Transformar datos de RPC a formato DomicilioConRestaurantes
  const domiciliosConRestaurantes: DomicilioConRestaurantes[] = [];

  clientesData.forEach((cliente: any) => {
    const clienteId = cliente.cliente_id;
    const clienteNombre = cliente.nombre;
    const totalCompras = cliente.total_compras || 0;
    const domiciliosJson = cliente.domicilios_json || [];

    // Contar clientes activos vs potenciales
    if (totalCompras > 0) {
      console.warn(`📈 [getDomiciliosConRelaciones] Cliente ${clienteId} (${clienteNombre}): ACTIVO con ${totalCompras} compras`);
    }

    // Para cada domicilio del cliente, crear un objeto DomicilioConRestaurantes
    domiciliosJson.forEach((domJson: any) => {
      const domicilioId = domJson.domicilio_id;
      const domicilioCompleto = domiciliosCompletos.get(domicilioId);

      // Restaurantes que han hecho pedidos a este domicilio
      const restaurantesConPedidos = domicilioPedidosMap.get(domicilioId) || new Set();

      // Combinar: restaurante actual (donde está registrado) + restaurantes con pedidos
      const todosLosRestaurantes = new Set([restauranteId, ...Array.from(restaurantesConPedidos)]);

      domiciliosConRestaurantes.push({
        id: domicilioId,
        cliente_id: clienteId,
        direccion: domJson.direccion || '',
        ciudad: domJson.ciudad || null,
        referencia: domicilioCompleto?.referencia || null,
        creado_en: domicilioCompleto?.creado_en || new Date().toISOString(),
        restaurantes_ids: Array.from(todosLosRestaurantes),
        cliente_nombre: clienteNombre,
      } as DomicilioConRestaurantes);
    });
  });

  console.warn(`✅ [getDomiciliosConRelaciones] Retornando ${domiciliosConRestaurantes.length} domicilios (ya ordenados por RPC: activos primero)`);

  // Los datos ya vienen ordenados de la RPC (total_compras DESC, ultima_interaccion DESC)
  return domiciliosConRestaurantes;
}

// Función antigua eliminada - ahora usamos RPC para mejor rendimiento

export async function getMesasByRestaurante(restauranteId: number): Promise<Mesa[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('mesa')
    .select('*')
    .eq('restaurante_id', restauranteId)
    .order('numero_mesa', { ascending: true });

  if (error) {
    console.error('Error fetching mesas by restaurante:', error);
    return [];
  }

  return data || [];
}

export async function getDomiciliosByCliente(clienteId: number): Promise<Domicilio[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('domicilio')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('creado_en', { ascending: false });

  if (error) {
    console.error('Error fetching domicilios by cliente:', error);
    return [];
  }

  return data || [];
}

export async function getDomiciliosByRestaurante(restauranteId: number): Promise<Domicilio[]> {
  const supabase = await createClient();

  // Paso 1: Obtener todos los carritos de este restaurante
  const { data: carritos, error: carritosError } = await supabase
    .from('carrito')
    .select('tipo_pedido_id')
    .eq('restaurante_id', restauranteId);

  if (carritosError || !carritos || carritos.length === 0) {
    console.error('Error fetching carritos:', carritosError);
    return [];
  }

  // Paso 2: Obtener los tipo_pedido_ids
  const tipoPedidoIds = carritos.map(c => c.tipo_pedido_id);

  // Paso 3: Obtener los domicilio_ids desde tipo_pedido
  const { data: tiposPedido, error: tiposError } = await supabase
    .from('tipo_pedido')
    .select('domicilio_id')
    .in('id', tipoPedidoIds)
    .not('domicilio_id', 'is', null);

  if (tiposError || !tiposPedido || tiposPedido.length === 0) {
    console.error('Error fetching tipos_pedido:', tiposError);
    return [];
  }

  // Paso 4: Obtener los domicilios
  const domicilioIds = tiposPedido
    .map(tp => tp.domicilio_id)
    .filter((id): id is number => id !== null);

  if (domicilioIds.length === 0) {
    return [];
  }

  const { data: domicilios, error: domiciliosError } = await supabase
    .from('domicilio')
    .select('*')
    .in('id', domicilioIds)
    .order('creado_en', { ascending: false });

  if (domiciliosError) {
    console.error('Error fetching domicilios:', domiciliosError);
    return [];
  }

  return domicilios || [];
}

/**
 * Obtiene los IDs de las mesas que tienen carritos activos con productos
 * Optimizado: reduce consultas y elimina logs innecesarios
 */
export async function getMesasConCarritoActivo(restauranteId: number): Promise<number[]> {
  const supabase = await createClient();

  // Paso 1: Obtener carritos activos
  const { data: carritos, error: carritosError } = await supabase
    .from('carrito')
    .select('id, tipo_pedido_id')
    .eq('restaurante_id', restauranteId)
    .in('estado', ['pendiente', 'en preparación']);

  if (carritosError || !carritos || carritos.length === 0) {
    return [];
  }

  // Paso 2: Verificar productos (en paralelo con paso 3)
  const carritoIds = carritos.map(c => c.id);
  const [productosResult, tiposPedidoResult] = await Promise.all([
    supabase
      .from('carrito_producto')
      .select('carrito_id')
      .in('carrito_id', carritoIds),
    supabase
      .from('tipo_pedido')
      .select('id, mesa_id')
      .in('id', carritos.map(c => c.tipo_pedido_id))
      .not('mesa_id', 'is', null),
  ]);

  const { data: productos } = productosResult;
  const { data: tiposPedido, error: tiposError } = tiposPedidoResult;

  if (!productos || productos.length === 0 || tiposError || !tiposPedido) {
    return [];
  }

  // Filtrar: solo tipo_pedido de carritos que tienen productos
  const carritosConProductos = new Set(productos.map(p => p.carrito_id));
  const tipoPedidoIdsConProductos = new Set(
    carritos
      .filter(c => carritosConProductos.has(c.id))
      .map(c => c.tipo_pedido_id),
  );

  return tiposPedido
    .filter(tp => tipoPedidoIdsConProductos.has(tp.id))
    .map(tp => tp.mesa_id)
    .filter((id): id is number => id !== null);
}

/**
 * Obtiene los IDs de los domicilios que tienen carritos activos con productos
 * Optimizado: reduce consultas y elimina logs innecesarios
 */
export async function getDomiciliosConCarritoActivo(restauranteId: number): Promise<number[]> {
  const supabase = await createClient();

  // Paso 1: Obtener carritos activos
  const { data: carritos, error: carritosError } = await supabase
    .from('carrito')
    .select('id, tipo_pedido_id')
    .eq('restaurante_id', restauranteId)
    .in('estado', ['pendiente', 'en preparación']);

  if (carritosError || !carritos || carritos.length === 0) {
    return [];
  }

  // Paso 2 y 3: Verificar productos y obtener tipo_pedido en paralelo
  const carritoIds = carritos.map(c => c.id);
  const tipoPedidoIds = carritos.map(c => c.tipo_pedido_id);

  const [productosResult, tiposPedidoResult] = await Promise.all([
    supabase
      .from('carrito_producto')
      .select('carrito_id')
      .in('carrito_id', carritoIds),
    supabase
      .from('tipo_pedido')
      .select('id, domicilio_id')
      .in('id', tipoPedidoIds)
      .not('domicilio_id', 'is', null),
  ]);

  const { data: productos } = productosResult;
  const { data: tiposPedido, error: tiposError } = tiposPedidoResult;

  if (!productos || productos.length === 0 || tiposError || !tiposPedido) {
    return [];
  }

  // Filtrar: solo tipo_pedido de carritos que tienen productos
  const carritosConProductos = new Set(productos.map(p => p.carrito_id));
  const tipoPedidoIdsConProductos = new Set(
    carritos
      .filter(c => carritosConProductos.has(c.id))
      .map(c => c.tipo_pedido_id),
  );

  return tiposPedido
    .filter(tp => tipoPedidoIdsConProductos.has(tp.id))
    .map(tp => tp.domicilio_id)
    .filter((id): id is number => id !== null);
}
