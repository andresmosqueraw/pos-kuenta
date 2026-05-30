import { createClient } from '@/libs/supabase/server';

export type CrearVentaData = {
  carritoId: number;
  restauranteId: number;
  clienteId?: number | null;
  total: number;
  dineroRecibido: number;
  cambioDado: number;
  tipoDePedido: 'MESA' | 'DOMICILIO';
  metodoPago: string;
};

export async function crearVenta(data: CrearVentaData) {
  const supabase = await createClient();

  try {
    // Paso 1: Obtener carrito con tipo_pedido y productos
    const { data: carrito, error: errorCarrito } = await supabase
      .from('carrito')
      .select(`
        *,
        tipo_pedido(*),
        carrito_producto(
          cantidad,
          precio_unitario,
          subtotal,
          producto_restaurante:producto_restaurante_id(
            producto_id,
            producto:producto_id(id, nombre)
          )
        )
      `)
      .eq('id', data.carritoId)
      .single();

    if (errorCarrito || !carrito) {
      console.error('❌ [crearVenta] Error obteniendo carrito:', errorCarrito);
      throw new Error('Carrito no encontrado');
    }

    // Paso 2: Verificar si ya existe una venta para este carrito
    const { data: ventaExistente } = await supabase
      .from('venta')
      .select('*')
      .eq('carrito_id', data.carritoId)
      .maybeSingle();

    let ventaCreada: Record<string, unknown>;

    if (ventaExistente) {
      ventaCreada = ventaExistente;
    } else {
      // Paso 3: Insertar venta
      const { data: ventaNueva, error: errorVenta } = await supabase
        .from('venta')
        .insert({
          carrito_id: data.carritoId,
          restaurante_id: data.restauranteId,
          cliente_id: data.clienteId || null,
          total: data.total,
          dinero_recibido: data.dineroRecibido,
          cambio_dado: data.cambioDado,
          tipo_de_pedido: data.tipoDePedido,
          metodo_pago: data.metodoPago,
          fecha: new Date().toISOString(),
        })
        .select()
        .single();

      if (errorVenta || !ventaNueva) {
        console.error('❌ [crearVenta] Error insertando venta:', errorVenta);
        throw new Error('Error al crear la venta');
      }

      ventaCreada = ventaNueva;

      // Paso 4: Insertar venta_detalle con los productos del carrito
      const carritoProductos = (carrito.carrito_producto as any[]) || [];
      if (carritoProductos.length > 0) {
        const detalles = carritoProductos.map((cp: any) => {
          const prod = Array.isArray(cp.producto_restaurante)
            ? cp.producto_restaurante[0]
            : cp.producto_restaurante;
          const producto = prod?.producto
            ? (Array.isArray(prod.producto) ? prod.producto[0] : prod.producto)
            : null;

          return {
            venta_id: ventaCreada.id,
            producto_id: prod?.producto_id ?? 0,
            nombre_producto: producto?.nombre ?? 'Producto',
            cantidad: cp.cantidad,
            precio_unitario: cp.precio_unitario,
            subtotal: cp.subtotal,
          };
        });

        const { error: errorDetalle } = await supabase
          .from('venta_detalle')
          .insert(detalles);

        if (errorDetalle) {
          console.error('⚠️ [crearVenta] Error insertando venta_detalle:', errorDetalle);
          // No lanzar error — la venta principal ya se creó
        }
      }

      // Paso 5: Actualizar estado del carrito a 'completado'
      await supabase
        .from('carrito')
        .update({ estado: 'completado' })
        .eq('id', data.carritoId);

      // Paso 6: Si es mesa, liberarla
      const tipoPedido = Array.isArray(carrito.tipo_pedido)
        ? carrito.tipo_pedido[0]
        : carrito.tipo_pedido;

      if (data.tipoDePedido === 'MESA' && tipoPedido?.mesa_id) {
        await supabase
          .from('mesa')
          .update({ estado: 'disponible' })
          .eq('id', tipoPedido.mesa_id);
      }
    }

    return {
      success: true,
      venta: ventaCreada,
    };
  } catch (error) {
    console.error('❌ [crearVenta] Error general:', error);
    throw error;
  }
}
