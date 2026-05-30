import { NextResponse } from 'next/server';
import { crearCarrito } from '@/services/carrito.service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tipoPedido, carritoData } = body;

    const resultado = await crearCarrito(tipoPedido, carritoData);

    if (!resultado.success) {
      return NextResponse.json({ error: resultado.error }, { status: 400 });
    }

    return NextResponse.json(resultado);
  } catch (error) {
    console.error('❌ [API /carrito/crear] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
