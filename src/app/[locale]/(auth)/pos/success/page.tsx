'use client';

import { Check, Printer } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { createClient } from '@/libs/supabase/client';
import { useCart } from '../context/cart-context';

type Restaurante = {
  id: number;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  nit: number | null;
};

export default function SuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeParams = useParams<{ locale: string }>();
  const { cart, cartTotal, clearCart } = useCart();

  const total = cartTotal;
  const ventaId = searchParams.get('ventaId');
  const mesaNumero = searchParams.get('numero');
  const restauranteId = searchParams.get('restauranteId');

  const [receiptNumber] = useState(() => ventaId ?? String(Date.now()));
  const [date] = useState(() =>
    new Intl.DateTimeFormat('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date()),
  );
  const [restaurante, setRestaurante] = useState<Restaurante | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);

  useEffect(() => {
    if (!restauranteId) {
      return;
    }
    const supabase = createClient();
    supabase
      .from('restaurante')
      .select('id, nombre, direccion, telefono, nit')
      .eq('id', Number(restauranteId))
      .single()
      .then(({ data }) => {
        if (data) {
          setRestaurante(data as Restaurante);
        }
      });
  }, [restauranteId]);

  useEffect(() => {
    if (cart.length === 0) {
      const locale = routeParams.locale ?? 'es';
      const dashboardUrl = restauranteId
        ? `/${locale}/dashboard?restauranteId=${restauranteId}`
        : `/${locale}/dashboard`;
      router.push(dashboardUrl);
    }
  }, [cart, router, restauranteId, routeParams.locale]);

  const handleBackToDashboard = () => {
    const locale = routeParams.locale ?? 'es';
    clearCart();
    const dashboardUrl = restauranteId
      ? `/${locale}/dashboard?restauranteId=${restauranteId}`
      : `/${locale}/dashboard`;
    router.push(dashboardUrl);
  };

  const handlePrint = async () => {
    setPrintError(null);
    const payload = JSON.stringify({ restaurante, cart, total, receiptNumber, date, mesaNumero });
    try {
      const res = await fetch('http://localhost:6543/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      if (!res.ok) {
        const { error } = await res.json();
        setPrintError(`Error al imprimir: ${error}`);
      }
    } catch {
      setPrintError('Impresora no disponible. ¿Está corriendo el servidor de impresión?');
    }
  };

  if (cart.length === 0) {
    return null;
  }

  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="container mx-auto max-w-md py-8">
      <div className="print-hidden mb-4 flex items-center justify-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20">
          <Check className="h-4 w-4 text-emerald-600" />
        </div>
        <span className="font-medium text-emerald-600">Pago registrado</span>
      </div>

      <div className="mx-auto w-[80mm] bg-white p-4 font-mono text-sm text-black shadow-md print:shadow-none">
        <div className="text-center">
          <h2 className="text-lg font-bold">{restaurante?.nombre ?? 'MI RESTAURANTE'}</h2>
          {restaurante?.nit && (
            <p>
              NIT:
              {' '}
              {restaurante.nit.toLocaleString('es-CO')}
            </p>
          )}
          {restaurante?.direccion && <p>{restaurante.direccion}</p>}
          {restaurante?.telefono && (
            <p>
              Tel:
              {' '}
              {restaurante.telefono}
            </p>
          )}
          <div className="mt-4">
            <p className="font-bold">FACTURA DE VENTA</p>
            <p>
              Recibo #
              {receiptNumber}
            </p>
          </div>
        </div>

        <div className="my-3 border-t border-dashed border-black" />

        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Fecha</span>
            <span>{date}</span>
          </div>
          {mesaNumero && (
            <div className="flex justify-between">
              <span>Mesa</span>
              <span>{mesaNumero}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Cliente</span>
            <span>Consumidor Final</span>
          </div>
        </div>

        <div className="my-3 border-t border-dashed border-black" />

        {cart.map(item => (
          <div key={item.id} className="mb-2">
            <div className="flex justify-between gap-2">
              <span className="flex-1 break-words">
                {item.quantity}
                {' '}
                x
                {' '}
                {item.name}
              </span>
              <span className="shrink-0">
                $
                {(item.price * item.quantity).toLocaleString('es-CO')}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              $
              {item.price.toLocaleString('es-CO')}
              {' '}
              c/u
            </div>
          </div>
        ))}

        <div className="my-3 border-t border-dashed border-black" />

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>
              {totalItems}
              {' '}
              {totalItems === 1 ? 'artículo' : 'artículos'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>
              $
              {total.toLocaleString('es-CO')}
            </span>
          </div>
          <div className="flex justify-between text-base font-bold">
            <span>TOTAL</span>
            <span>
              $
              {total.toLocaleString('es-CO')}
            </span>
          </div>
        </div>

        <div className="my-3 border-t border-dashed border-black" />

        <div className="text-center text-xs">
          <p>Forma de pago: Efectivo</p>
          <p>¡Gracias por su compra!</p>
        </div>
      </div>

      <div className="print-hidden mt-6 flex flex-col gap-3">
        <Button onClick={handlePrint} variant="outline" className="mx-auto w-[80mm]">
          <Printer className="mr-2 h-4 w-4" />
          Imprimir Recibo
        </Button>
        {printError && (
          <p className="mx-auto w-[80mm] text-center text-xs text-red-500">{printError}</p>
        )}
        <Button onClick={handleBackToDashboard} className="mx-auto w-[80mm]">
          Volver a las mesas
        </Button>
      </div>
    </div>
  );
}
