import type { Product } from '@/app/[locale]/(auth)/pos/context/cart-context';
import { createClient } from '@/libs/supabase/server';
import { asignarImagenAProducto, mapearProductosARestaurante } from './producto.service';

export type TipoPedidoData = {
  tipo: 'mesa' | 'domicilio';
  mesaId?: number;
  domicilioId?: number;
};

export type CarritoData = {
  restauranteId: number;
  clienteId?: number;
  productos: Array<{
    productoId: number;
    productoRestauranteId?: number; // Si viene del frontend, evita la query de mapeo
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
  }>;
};

export async function crearCarrito(
  tipoPedido: TipoPedidoData,
  carritoData: CarritoData,
) {
  const supabase = await createClient();

  try {
    // Paso 0: Resolver producto_restaurante_id (solo si no viene ya en el payload)
    const todosConId = carritoData.productos.every(p => p.productoRestauranteId);
    let mapaProductos = new Map<number, number>();

    if (!todosConId) {
      mapaProductos = await mapearProductosARestaurante(
        carritoData.productos.map(p => p.productoId),
        carritoData.restauranteId,
      );
      const invalidos = carritoData.productos.filter(p => !mapaProductos.has(p.productoId));
      if (invalidos.length > 0) {
        return {
          success: false,
          error: `Productos no disponibles en este restaurante: ${invalidos.map(p => p.productoId).join(', ')}`,
        };
      }
    }

    // Paso 1: Buscar o crear tipo_pedido
    const colFiltro = tipoPedido.mesaId ? 'mesa_id' : 'domicilio_id';
    const valFiltro = tipoPedido.mesaId ?? tipoPedido.domicilioId;

    let tipoPedidoId: number;
    const { data: tpExistente } = await supabase
      .from('tipo_pedido')
      .select('id')
      .eq(colFiltro, valFiltro!)
      .maybeSingle();

    if (tpExistente) {
      tipoPedidoId = tpExistente.id;
    } else {
      const { data: tpNuevo, error } = await supabase
        .from('tipo_pedido')
        .insert({
          mesa_id: tipoPedido.mesaId || null,
          domicilio_id: tipoPedido.domicilioId || null,
        })
        .select('id')
        .single();
      if (error || !tpNuevo) {
        throw new Error('Failed to create tipo_pedido');
      }
      tipoPedidoId = tpNuevo.id;
    }

    // Paso 2: Buscar o crear carrito
    const { data: carritoExistente } = await supabase
      .from('carrito')
      .select('id, estado')
      .eq('tipo_pedido_id', tipoPedidoId)
      .maybeSingle();

    let carritoId: number;
    let esNuevoOReabierto = false;

    if (carritoExistente) {
      carritoId = carritoExistente.id;
      const activo = ['pendiente', 'en preparación'].includes(carritoExistente.estado);
      if (!activo) {
        // Reabrir carrito cerrado
        await supabase.from('carrito').update({ estado: 'pendiente' }).eq('id', carritoId);
        esNuevoOReabierto = true;
      }
    } else {
      const { data: nuevoCarrito, error } = await supabase
        .from('carrito')
        .insert({
          restaurante_id: carritoData.restauranteId,
          tipo_pedido_id: tipoPedidoId,
          cliente_id: carritoData.clienteId || null,
          estado: 'pendiente',
        })
        .select('id')
        .single();
      if (error || !nuevoCarrito) {
        throw new Error('Failed to create carrito');
      }
      carritoId = nuevoCarrito.id;
      esNuevoOReabierto = true;
    }

    // Paso 3: Upsert productos
    const productosParaUpsert = carritoData.productos.map(prod => ({
      carrito_id: carritoId,
      producto_restaurante_id: prod.productoRestauranteId ?? mapaProductos.get(prod.productoId)!,
      cantidad: prod.cantidad,
      precio_unitario: prod.precioUnitario,
      subtotal: prod.subtotal,
    }));

    const { error: errorUpsert } = await supabase
      .from('carrito_producto')
      .upsert(productosParaUpsert, {
        onConflict: 'carrito_id,producto_restaurante_id',
        ignoreDuplicates: false,
      });

    if (errorUpsert) {
      throw new Error('Failed to upsert carrito_producto');
    }

    // Paso 4: Si es mesa nueva o reabierta, marcarla como ocupada
    if (tipoPedido.tipo === 'mesa' && tipoPedido.mesaId && esNuevoOReabierto) {
      await supabase.from('mesa').update({ estado: 'ocupada' }).eq('id', tipoPedido.mesaId);
    }

    return { success: true, carritoId, tipoPedidoId };
  } catch (error) {
    console.error('❌ [crearCarrito] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Agrega un producto a un carrito existente
 * Optimizado: usa UPSERT para evitar SELECT + INSERT/UPDATE
 */
export async function agregarProductoACarrito(
  carritoId: number,
  productoRestauranteId: number,
  cantidad: number,
  precioUnitario: number,
) {
  const supabase = await createClient();

  // Usar UPSERT con ON CONFLICT para incrementar cantidad si existe
  // Esto evita el SELECT previo y hace todo en una sola operación
  const startTime = Date.now();
  const { error } = await supabase.rpc('upsert_carrito_producto', {
    p_carrito_id: carritoId,
    p_producto_restaurante_id: productoRestauranteId,
    p_cantidad: cantidad,
    p_precio_unitario: precioUnitario,
  });
  const duration = Date.now() - startTime;

  if (error) {
    // Si la función RPC no existe, usar el método tradicional
    if (error.code === '42883' || error.message.includes('function') || error.message.includes('does not exist')) {
      console.warn('⚠️ [agregarProductoACarrito] Función RPC no disponible, usando método fallback');
      return await agregarProductoACarritoFallback(
        carritoId,
        productoRestauranteId,
        cantidad,
        precioUnitario,
      );
    }
    console.error('❌ [agregarProductoACarrito] Error en función RPC:', error);
    return { success: false, error: error.message };
  }

  console.warn(`✅ [agregarProductoACarrito] Función RPC optimizada usada exitosamente (${duration}ms)`);
  return { success: true };
}

/**
 * Método fallback si la función RPC no está disponible
 * Usa una consulta optimizada con SELECT solo de los campos necesarios
 */
async function agregarProductoACarritoFallback(
  carritoId: number,
  productoRestauranteId: number,
  cantidad: number,
  precioUnitario: number,
) {
  const supabase = await createClient();
  const startTime = Date.now();

  // SELECT optimizado: solo campos necesarios, usando índice compuesto si existe
  const { data: productoExistente } = await supabase
    .from('carrito_producto')
    .select('id, cantidad')
    .eq('carrito_id', carritoId)
    .eq('producto_restaurante_id', productoRestauranteId)
    .maybeSingle();

  if (productoExistente) {
    // Actualizar cantidad existente
    const nuevaCantidad = productoExistente.cantidad + cantidad;
    const { error } = await supabase
      .from('carrito_producto')
      .update({
        cantidad: nuevaCantidad,
        subtotal: nuevaCantidad * precioUnitario,
      })
      .eq('id', productoExistente.id);

    if (error) {
      console.error('Error updating carrito_producto:', error);
      return { success: false, error: error.message };
    }
  } else {
    // Insertar nuevo producto
    const { error } = await supabase
      .from('carrito_producto')
      .insert({
        carrito_id: carritoId,
        producto_restaurante_id: productoRestauranteId,
        cantidad,
        precio_unitario: precioUnitario,
        subtotal: cantidad * precioUnitario,
      });

    if (error) {
      console.error('Error inserting carrito_producto:', error);
      return { success: false, error: error.message };
    }
  }

  const duration = Date.now() - startTime;
  console.warn(`⚠️ [agregarProductoACarrito] Método fallback usado (${duration}ms) - Considera ejecutar optimizaciones_carrito.sql en Supabase`);
  return { success: true };
}

/**
 * Actualiza la cantidad de un producto en el carrito
 */
export async function actualizarCantidadProducto(
  carritoId: number,
  productoRestauranteId: number,
  nuevaCantidad: number,
  precioUnitario: number,
) {
  const supabase = await createClient();

  if (nuevaCantidad <= 0) {
    // Eliminar el producto si la cantidad es 0
    const { error } = await supabase
      .from('carrito_producto')
      .delete()
      .eq('carrito_id', carritoId)
      .eq('producto_restaurante_id', productoRestauranteId);

    if (error) {
      console.error('Error deleting carrito_producto:', error);
      return { success: false, error: error.message };
    }
  } else {
    // Actualizar cantidad
    const { error } = await supabase
      .from('carrito_producto')
      .update({
        cantidad: nuevaCantidad,
        subtotal: nuevaCantidad * precioUnitario,
      })
      .eq('carrito_id', carritoId)
      .eq('producto_restaurante_id', productoRestauranteId);

    if (error) {
      console.error('Error updating carrito_producto:', error);
      return { success: false, error: error.message };
    }
  }

  return { success: true };
}

/**
 * Elimina un producto del carrito
 */
export async function eliminarProductoDeCarrito(
  carritoId: number,
  productoRestauranteId: number,
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('carrito_producto')
    .delete()
    .eq('carrito_id', carritoId)
    .eq('producto_restaurante_id', productoRestauranteId);

  if (error) {
    console.error('Error deleting carrito_producto:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Obtiene el carrito activo de una mesa o domicilio
 */
export async function obtenerCarritoActivo(
  tipo: 'mesa' | 'domicilio',
  id: number,
) {
  const supabase = await createClient();

  // Primero obtener el tipo_pedido
  const query = supabase
    .from('tipo_pedido')
    .select('id');

  if (tipo === 'mesa') {
    query.eq('mesa_id', id);
  } else {
    query.eq('domicilio_id', id);
  }

  const { data: tipoPedido, error: errorTipoPedido } = await query.single();

  if (errorTipoPedido || !tipoPedido) {
    return { success: false, carrito: null };
  }

  // Obtener el carrito con ese tipo_pedido_id
  const { data: carrito, error: errorCarrito } = await supabase
    .from('carrito')
    .select(`
      *,
      carrito_producto(*)
    `)
    .eq('tipo_pedido_id', tipoPedido.id)
    .in('estado', ['pendiente', 'en preparación'])
    .single();

  if (errorCarrito) {
    return { success: false, carrito: null };
  }

  return { success: true, carrito };
}

/**
 * Obtiene el carrito activo con productos en formato para el frontend
 * Retorna los productos como CartItem[] (con id, name, price, image, category, quantity)
 */
export async function obtenerCarritoCompleto(
  tipo: 'mesa' | 'domicilio',
  id: number,
  restauranteId: number,
): Promise<{ success: boolean; carritoId: number | null; productos: Array<Product & { quantity: number }> }> {
  const supabase = await createClient();

  console.warn('🛒 [Service obtenerCarritoCompleto] Obteniendo carrito completo:', {
    tipo,
    id,
    restauranteId,
  });

  try {
    // Obtener el carrito activo
    const resultado = await obtenerCarritoActivo(tipo, id);

    if (!resultado.success || !resultado.carrito) {
      console.warn('🛒 [Service obtenerCarritoCompleto] No hay carrito activo');
      return { success: true, carritoId: null, productos: [] };
    }

    const carrito = resultado.carrito;
    const carritoProductos = carrito.carrito_producto as Array<{
      id: number;
      carrito_id: number;
      producto_restaurante_id: number;
      cantidad: number;
      precio_unitario: number;
      subtotal: number;
    }>;

    if (!carritoProductos || carritoProductos.length === 0) {
      console.warn('🛒 [Service obtenerCarritoCompleto] Carrito sin productos');
      return { success: true, carritoId: carrito.id, productos: [] };
    }

    // Obtener todos los producto_restaurante_id
    const productoRestauranteIds = carritoProductos.map(cp => cp.producto_restaurante_id);

    // Paso 1: Obtener producto_restaurante con producto
    const productosRestaurantePromise = supabase
      .from('producto_restaurante')
      .select(`
        id,
        producto_id,
        precio_venta,
        producto:producto_id (
          id,
          nombre,
          descripcion,
          precio
        )
      `)
      .in('id', productoRestauranteIds)
      .eq('restaurante_id', restauranteId);

    // Paso 2: Obtener las categorías visibles para este restaurante
    const categoriasRestaurantePromise = supabase
      .from('categoria_restaurante')
      .select('categoria_id, categoria:categoria_id (id, nombre)')
      .eq('restaurante_id', restauranteId)
      .eq('visible', true);

    // Ejecutar ambas consultas en paralelo
    const [
      { data: productosRestaurante, error: errorProductos },
      { data: categoriasRestaurante },
    ] = await Promise.all([
      productosRestaurantePromise,
      categoriasRestaurantePromise,
    ]);

    if (errorProductos || !productosRestaurante) {
      console.error('❌ [Service obtenerCarritoCompleto] Error obteniendo productos:', errorProductos);
      return { success: false, carritoId: carrito.id, productos: [] };
    }

    const categoriasVisiblesIds = new Set(
      categoriasRestaurante?.map(cr => cr.categoria_id) || [],
    );

    // Paso 3: Obtener las relaciones producto_categoria para todos los productos
    // Usar los producto_id que ya tenemos de la primera consulta
    const productoIds = productosRestaurante.map(pr => pr.producto_id);

    // Si no hay productos, retornar vacío
    if (productoIds.length === 0) {
      return { success: true, carritoId: carrito.id, productos: [] };
    }

    const { data: productoCategorias } = await supabase
      .from('producto_categoria')
      .select('producto_id, categoria_id, categoria:categoria_id (id, nombre)')
      .in('producto_id', productoIds);

    // Paso 4: Crear un mapa de producto_id -> categoría (solo categorías visibles para el restaurante)
    const productoCategoriaMap = new Map<number, { id: number; nombre: string }>();
    productoCategorias?.forEach((pc) => {
      const categoriaId = pc.categoria_id;
      // Solo incluir si la categoría está visible para este restaurante
      if (categoriasVisiblesIds.has(categoriaId)) {
        const categoria = Array.isArray(pc.categoria) ? pc.categoria[0] : pc.categoria;
        if (categoria && typeof categoria === 'object' && 'nombre' in categoria) {
          // Usar la primera categoría encontrada
          if (!productoCategoriaMap.has(pc.producto_id)) {
            productoCategoriaMap.set(pc.producto_id, {
              id: categoria.id,
              nombre: String(categoria.nombre),
            });
          }
        }
      }
    });

    // Convertir a formato Product[] con quantity
    const productos: Array<Product & { quantity: number }> = carritoProductos.map((cp) => {
      const prodRest = productosRestaurante.find(
        pr => pr.id === cp.producto_restaurante_id,
      );

      if (!prodRest) {
        console.error('❌ [Service obtenerCarritoCompleto] Producto restaurante no encontrado:', cp.producto_restaurante_id);
        return null;
      }

      // Supabase retorna los datos anidados como objetos
      const producto = (prodRest as any).producto;
      if (!producto) {
        console.error('❌ [Service obtenerCarritoCompleto] Producto no encontrado para producto_restaurante:', cp.producto_restaurante_id);
        return null;
      }

      // Obtener categoría del mapa
      const categoria = productoCategoriaMap.get(producto.id);

      // Asignar imagen usando las mismas heurísticas que en el punto de venta
      const imagen = asignarImagenAProducto(producto.nombre, producto.id);

      // Mapear categoría a slug
      let categoriaSlug = 'all';
      if (categoria) {
        const nombreLower = categoria.nombre.toLowerCase();
        if (nombreLower === 'comida' || nombreLower === 'food' || nombreLower === 'platos') {
          categoriaSlug = 'food';
        } else if (nombreLower === 'bebidas' || nombreLower === 'drinks' || nombreLower === 'refrescos') {
          categoriaSlug = 'drinks';
        } else if (nombreLower === 'postres' || nombreLower === 'desserts' || nombreLower === 'dulces') {
          categoriaSlug = 'desserts';
        }
      }

      return {
        id: producto.id,
        name: producto.nombre,
        price: Number(cp.precio_unitario),
        image: imagen,
        category: categoriaSlug,
        quantity: cp.cantidad,
      };
    }).filter((p): p is Product & { quantity: number } => p !== null);

    console.warn('✅ [Service obtenerCarritoCompleto] Carrito obtenido:', {
      carritoId: carrito.id,
      productosCount: productos.length,
    });

    return { success: true, carritoId: carrito.id, productos };
  } catch (error) {
    console.error('❌ [Service obtenerCarritoCompleto] Error inesperado:', error);
    return { success: false, carritoId: null, productos: [] };
  }
}

/**
 * Limpia un carrito cuando queda vacío:
 * - Elimina todos los productos de carrito_producto
 * - Actualiza mesa a 'disponible' si es mesa
 * - Opcionalmente elimina el carrito
 */
export async function limpiarCarritoVacio(
  carritoId: number,
  tipoPedido: TipoPedidoData,
) {
  const supabase = await createClient();
  const serviceStartTime = Date.now();

  console.warn('🧹 [Service limpiarCarritoVacio] INICIO - Limpiando carrito vacío:', {
    carritoId,
    tipo: tipoPedido.tipo,
    mesaId: tipoPedido.mesaId,
    domicilioId: tipoPedido.domicilioId,
  });

  try {
    // Paso 1: Eliminar todos los productos del carrito
    console.warn('📝 [Service limpiarCarritoVacio] PASO 1: Eliminando todos los productos...');
    const paso1StartTime = Date.now();

    const { error: errorEliminarProductos } = await supabase
      .from('carrito_producto')
      .delete()
      .eq('carrito_id', carritoId);

    const paso1Duration = Date.now() - paso1StartTime;

    if (errorEliminarProductos) {
      console.error('❌ [Service limpiarCarritoVacio] Error eliminando productos:', {
        error: errorEliminarProductos,
        mensaje: errorEliminarProductos?.message,
      });
      throw new Error('Failed to delete carrito_producto');
    }

    console.warn(`✅ [Service limpiarCarritoVacio] Productos eliminados en ${paso1Duration}ms`);

    // Paso 2: Si es mesa, actualizar estado a 'disponible'
    if (tipoPedido.tipo === 'mesa' && tipoPedido.mesaId) {
      console.warn('📝 [Service limpiarCarritoVacio] PASO 2: Actualizando mesa a DISPONIBLE...');
      console.warn(`  ↳ UPDATE mesa SET estado='disponible' WHERE id=${tipoPedido.mesaId}`);

      const paso2StartTime = Date.now();
      const { data: mesaActualizada, error: errorMesa } = await supabase
        .from('mesa')
        .update({ estado: 'disponible' })
        .eq('id', tipoPedido.mesaId)
        .select();

      const paso2Duration = Date.now() - paso2StartTime;

      if (errorMesa) {
        console.error(`❌ [Service limpiarCarritoVacio] Error actualizando mesa después de ${paso2Duration}ms:`, {
          error: errorMesa,
          mensaje: errorMesa?.message,
          detalles: errorMesa?.details,
          hint: errorMesa?.hint,
          mesaId: tipoPedido.mesaId,
        });
        // No lanzar error, los productos ya fueron eliminados
      } else {
        console.warn(`✅ [Service limpiarCarritoVacio] Mesa actualizada a DISPONIBLE en ${paso2Duration}ms:`, {
          mesaId: tipoPedido.mesaId,
          estadoAnterior: mesaActualizada?.[0]?.estado || 'desconocido',
          estadoNuevo: 'disponible',
          mesaActualizada: mesaActualizada?.[0],
        });
      }
    } else {
      console.warn('⏭️ [Service limpiarCarritoVacio] PASO 2: Omitido (no es mesa o no tiene mesaId)');
    }

    // Paso 3: Opcionalmente, eliminar el carrito (o marcarlo como cerrado)
    // Por ahora, dejamos el carrito en la BD pero sin productos
    // Si quieres eliminarlo completamente, descomenta esto:
    /*
    console.warn('📝 [Service limpiarCarritoVacio] PASO 3: Eliminando carrito...');
    const { error: errorEliminarCarrito } = await supabase
      .from('carrito')
      .delete()
      .eq('id', carritoId);

    if (errorEliminarCarrito) {
      console.error('❌ [Service limpiarCarritoVacio] Error eliminando carrito:', errorEliminarCarrito);
      // No lanzar error, los productos ya fueron eliminados
    } else {
      console.warn('✅ [Service limpiarCarritoVacio] Carrito eliminado');
    }
    */

    const totalServiceDuration = Date.now() - serviceStartTime;
    console.warn(`🎉 [Service limpiarCarritoVacio] PROCESO COMPLETADO EXITOSAMENTE en ${totalServiceDuration}ms`);
    console.warn('🎉 [Service limpiarCarritoVacio] Resumen:', {
      carritoId,
      productosEliminados: 'TODOS',
      mesaActualizada: tipoPedido.tipo === 'mesa' && tipoPedido.mesaId
        ? `SÍ - Mesa ${tipoPedido.mesaId} → DISPONIBLE`
        : 'N/A (domicilio)',
      tiempoTotal: `${totalServiceDuration}ms`,
      siguientePaso: 'API debe revalidar dashboard para que refleje el cambio',
    });
    console.warn('🧹 [Service limpiarCarritoVacio] ═══════════════════════════════════\n');

    return {
      success: true,
      carritoId,
    };
  } catch (error) {
    const totalServiceDuration = Date.now() - serviceStartTime;
    console.error(`❌ [Service limpiarCarritoVacio] Error inesperado después de ${totalServiceDuration}ms:`, {
      error,
      mensaje: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'N/A',
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
