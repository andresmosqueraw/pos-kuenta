'use client';

import { Check, Printer } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useCart } from '../context/cart-context';

export default function SuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { cart, cartTotal, clearCart } = useCart();

  const total = cartTotal;
  const [receiptNumber] = useState(() => Math.floor(100000 + Math.random() * 900000));
  const [date] = useState(() => new Date().toLocaleString('es-ES'));

  useEffect(() => {
    // If there's no cart data, redirect to dashboard
    if (cart.length === 0) {
      const restauranteId = searchParams.get('restauranteId');
      const dashboardUrl = restauranteId
        ? `/dashboard?restauranteId=${restauranteId}`
        : '/dashboard';
      router.push(dashboardUrl);
    }
  }, [cart, router, searchParams]);

  const handleBackToDashboard = () => {
    clearCart();
    const restauranteId = searchParams.get('restauranteId');
    const dashboardUrl = restauranteId
      ? `/dashboard?restauranteId=${restauranteId}`
      : '/dashboard';
    router.push(dashboardUrl);
  };

  const handlePrint = () => {
    window.print();
  };

  if (cart.length === 0) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="container mx-auto max-w-md py-8">
      <div className="rounded-lg border bg-card p-6 print:border-none">
        <div className="mb-6 flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 dark:bg-emerald-500/10">
            <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>

        <h1 className="mb-2 text-center text-2xl font-bold">Pago Exitoso</h1>
        <p className="mb-6 text-center text-muted-foreground">¡Gracias por tu compra!</p>

        <div className="mb-6 text-center">
          <p className="font-medium">
            Recibo #
            {receiptNumber}
          </p>
          <p className="text-sm text-muted-foreground">{date}</p>
        </div>

        <Separator className="my-4" />

        <div className="space-y-3">
          {cart.map(item => (
            <div key={item.id} className="flex justify-between">
              <div>
                <p>
                  {item.name}
                  {' '}
                  ×
                  {item.quantity}
                </p>
              </div>
              <p>
                $
                {(item.price * item.quantity).toFixed(2)}
              </p>
            </div>
          ))}
        </div>

        <Separator className="my-4" />

        <div className="space-y-2">
          <div className="flex justify-between font-bold">
            <p>Total</p>
            <p>
              $
              {total.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 print:hidden">
          <Button onClick={handlePrint} variant="outline" className="w-full">
            <Printer className="mr-2 h-4 w-4" />
            Imprimir Recibo
          </Button>
          <Button onClick={handleBackToDashboard} className="w-full">
            Volver a las mesas
          </Button>
        </div>
      </div>
    </div>
  );
}
