import { NextResponse } from 'next/server';
import { agregarProductoACarrito } from '@/services/carrito.service';
import { getProductoRestauranteId } from '@/services/producto.service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      carritoId,
      productoRestauranteId,
      productoId,
      restauranteId,
      cantidad,
      precioUnitario,
    } = body;

    let finalProductoRestauranteId = productoRestauranteId;

    // Solo buscar si no viene directo del frontend (fallback)
    if (!finalProductoRestauranteId && productoId && restauranteId) {
      finalProductoRestauranteId = await getProductoRestauranteId(productoId, restauranteId);

      if (!finalProductoRestauranteId) {
        return NextResponse.json(
          { error: 'No se encontró el producto en este restaurante' },
          { status: 404 },
        );
      }
    }

    if (!finalProductoRestauranteId) {
      return NextResponse.json(
        { error: 'Se requiere productoRestauranteId o (productoId + restauranteId)' },
        { status: 400 },
      );
    }

    const resultado = await agregarProductoACarrito(
      carritoId,
      finalProductoRestauranteId,
      cantidad,
      precioUnitario,
    );

    if (!resultado.success) {
      return NextResponse.json({ error: resultado.error }, { status: 400 });
    }

    return NextResponse.json(resultado);
  } catch (error) {
    console.error('❌ [API /carrito/agregar-producto] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
