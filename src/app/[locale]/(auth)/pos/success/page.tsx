'use client';

import { Check, Printer } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useThermalPrinter } from '@/hooks/useThermalPrinter';
import { createClient } from '@/libs/supabase/client';
import { useCart } from '../context/cart-context';

type Restaurante = {
  id: number;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  nit: number | null;
};

type PrintError = 'not-installed' | 'no-printer' | 'error' | null;

export default function SuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeParams = useParams<{ locale: string }>();
  const { cart, cartTotal, clearCart } = useCart();
  const { print } = useThermalPrinter();

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
  const [printError, setPrintError] = useState<PrintError>(null);
  const [printing, setPrinting] = useState(false);

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
      router.push(restauranteId
        ? `/${locale}/dashboard?restauranteId=${restauranteId}`
        : `/${locale}/dashboard`);
    }
  }, [cart, router, restauranteId, routeParams.locale]);

  const handleBackToDashboard = () => {
    const locale = routeParams.locale ?? 'es';
    clearCart();
    router.push(restauranteId
      ? `/${locale}/dashboard?restauranteId=${restauranteId}`
      : `/${locale}/dashboard`);
  };

  const handlePrint = async () => {
    setPrintError(null);
    setPrinting(true);
    const result = await print({ restaurante, cart, total, receiptNumber, date, mesaNumero });
    setPrinting(false);
    if (!result.ok) {
      setPrintError(result.reason);
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
        <Button
          onClick={handlePrint}
          disabled={printing}
          variant="outline"
          className="mx-auto w-[80mm]"
        >
          <Printer className="mr-2 h-4 w-4" />
          {printing ? 'Imprimiendo...' : 'Imprimir Recibo'}
        </Button>

        {printError && (
          <div className="mx-auto w-[80mm] space-y-2 rounded-md border border-red-200 bg-red-50 p-3 text-center text-xs">
            {printError === 'not-installed'
              ? (
                  <>
                    <p className="font-medium text-red-600">
                      QZ Tray no está instalado en este computador.
                    </p>
                    <p className="text-gray-600">
                      Descárgalo e instálalo como cualquier programa (doble clic):
                    </p>
                    <a
                      href="https://qz.io/download/"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block font-medium text-blue-600 underline"
                    >
                      Descargar QZ Tray
                    </a>
                    <p className="text-gray-400">
                      Disponible para Windows, Mac y Linux. Solo se instala una vez.
                    </p>
                  </>
                )
              : printError === 'no-printer'
                ? (
                    <p className="text-red-600">
                      No se encontró ninguna impresora. Verifica que esté conectada y encendida.
                    </p>
                  )
                : (
                    <p className="text-red-600">
                      Error al imprimir. Verifica que la impresora esté lista.
                    </p>
                  )}
          </div>
        )}

        <Button onClick={handleBackToDashboard} className="mx-auto w-[80mm]">
          Volver a las mesas
        </Button>
      </div>
    </div>
  );
}
