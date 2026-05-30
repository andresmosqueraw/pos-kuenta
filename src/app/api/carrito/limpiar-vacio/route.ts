import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { limpiarCarritoVacio } from '@/services/carrito.service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { carritoId, tipoPedido } = body;

    const resultado = await limpiarCarritoVacio(carritoId, tipoPedido);

    if (!resultado.success) {
      return NextResponse.json({ error: resultado.error }, { status: 400 });
    }

    revalidatePath('/[locale]/dashboard', 'page');

    return NextResponse.json(resultado);
  } catch (error) {
    console.error('❌ [API /carrito/limpiar-vacio] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
