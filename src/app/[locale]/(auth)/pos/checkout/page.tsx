'use client';

import { ArrowLeft, CreditCard, MapPin, Table, Wallet } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { useCart } from '../context/cart-context';

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ locale: string }>();
  const { cart, cartTotal, carritoId, isLoading } = useCart();
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [cashReceived, setCashReceived] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Obtener información del tipo de pedido
  const tipo = searchParams.get('tipo');
  const id = searchParams.get('id');
  const numero = searchParams.get('numero');
  const clienteId = searchParams.get('clienteId');
  const restauranteId = searchParams.get('restauranteId');

  const total = cartTotal;

  // Validar y calcular cambio solo si el valor es un número válido
  const cashReceivedNumber = cashReceived ? Number.parseFloat(cashReceived) : Number.NaN;
  const isValidCashAmount = !Number.isNaN(cashReceivedNumber) && Number.isFinite(cashReceivedNumber);
  const change = paymentMethod === 'cash' && isValidCashAmount
    ? Math.max(0, cashReceivedNumber - total)
    : 0;

  const handlePayment = async () => {
    setPaymentError(null);

    if (!carritoId || !restauranteId) {
      setPaymentError('Error interno: faltan datos del carrito. Recarga la página.');
      return;
    }

    if (paymentMethod === 'cash') {
      if (!cashReceived || cashReceived.trim() === '') {
        setPaymentError('Ingresa el monto recibido.');
        return;
      }
      const cashValue = Number.parseFloat(cashReceived);
      if (Number.isNaN(cashValue) || !Number.isFinite(cashValue)) {
        setPaymentError('Ingresa un número válido.');
        return;
      }
      if (cashValue < total) {
        setPaymentError('El dinero recibido debe ser mayor o igual al total.');
        return;
      }
    }

    setIsProcessing(true);

    try {
      const dineroRecibido = paymentMethod === 'cash'
        ? Number.parseFloat(cashReceived)
        : total;

      const tipoDePedido = tipo === 'mesa' ? 'MESA' : 'DOMICILIO';
      const locale = params.locale ?? 'es';

      const response = await fetch('/api/venta/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carritoId,
          restauranteId: Number(restauranteId),
          clienteId: clienteId ? Number(clienteId) : null,
          total,
          dineroRecibido,
          cambioDado: change,
          tipoDePedido,
          metodoPago: paymentMethod === 'card' ? 'nequi' : 'efectivo',
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Error al procesar el pago');
      }

      const successParams = new URLSearchParams();
      if (tipo) {
        successParams.set('tipo', tipo);
      }
      if (id) {
        successParams.set('id', id);
      }
      if (numero) {
        successParams.set('numero', numero);
      }
      if (clienteId) {
        successParams.set('clienteId', clienteId);
      }
      if (restauranteId) {
        successParams.set('restauranteId', restauranteId);
      }
      successParams.set('metodo', paymentMethod);
      successParams.set('ventaId', result.venta.id);

      router.push(`/${locale}/pos/success?${successParams.toString()}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      setPaymentError(`Error al procesar el pago: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const getPosUrl = () => {
    const locale = params.locale ?? 'es';
    const urlParams = new URLSearchParams();
    if (tipo) {
      urlParams.set('tipo', tipo);
    }
    if (id) {
      urlParams.set('id', id);
    }
    if (numero) {
      urlParams.set('numero', numero);
    }
    if (clienteId) {
      urlParams.set('clienteId', clienteId);
    }
    if (restauranteId) {
      urlParams.set('restauranteId', restauranteId);
    }
    return `/${locale}/pos?${urlParams.toString()}`;
  };

  if (cart.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Tu carrito está vacío</h1>
          <p className="mt-2 text-muted-foreground">Agrega algunos productos antes de pagar</p>
          <Button className="mt-4" onClick={() => router.push(getPosUrl())}>
            Volver al POS
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <Button variant="ghost" className="mb-6" onClick={() => router.push(getPosUrl())}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver al POS
      </Button>

      {/* Banner de tipo de pedido */}
      {tipo && (
        <div
          className={`mb-6 rounded-lg border p-4 ${
            tipo === 'mesa'
              ? 'border-emerald-500/30 bg-emerald-500/20 dark:border-emerald-500/50 dark:bg-emerald-500/10'
              : 'border-blue-500/30 bg-blue-500/20 dark:border-blue-500/50 dark:bg-blue-500/10'
          }`}
        >
          <div className="flex items-center gap-2">
            {tipo === 'mesa'
              ? (
                  <>
                    <Table className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-semibold text-emerald-900 dark:text-emerald-100">
                      Mesa
                      {' '}
                      {numero}
                    </span>
                    <span className="text-sm text-emerald-700 dark:text-emerald-300">
                      (ID:
                      {' '}
                      {id}
                      )
                    </span>
                  </>
                )
              : (
                  <>
                    <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span className="font-semibold text-blue-900 dark:text-blue-100">Pedido a Domicilio</span>
                    <span className="text-sm text-blue-700 dark:text-blue-300">
                      (Cliente ID:
                      {' '}
                      {clienteId}
                      )
                    </span>
                  </>
                )}
          </div>
        </div>
      )}

      <h1 className="mb-6 text-3xl font-bold">Pago</h1>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-4 text-xl font-semibold">Resumen del Pedido</h2>
          <div className="rounded-lg border bg-card p-4">
            {cart.map(item => (
              <div key={item.id} className="mb-3 flex justify-between">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    $
                    {item.price.toFixed(2)}
                    {' '}
                    ×
                    {' '}
                    {item.quantity}
                  </p>
                </div>
                <p className="font-medium">
                  $
                  {(item.price * item.quantity).toFixed(2)}
                </p>
              </div>
            ))}

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
          </div>
        </div>

        <div>
          <h2 className="mb-4 text-xl font-semibold">Método de Pago</h2>
          <div className="rounded-lg border bg-card p-4">
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
              <div
                className="flex cursor-pointer items-center space-x-2 rounded-md border p-3 transition-colors hover:bg-accent"
                onClick={() => setPaymentMethod('card')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setPaymentMethod('card');
                  }
                }}
              >
                <RadioGroupItem value="card" id="card" />
                <Label htmlFor="card" className="flex cursor-pointer items-center">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Nequi
                </Label>
              </div>

              <div
                className="mt-3 flex cursor-pointer items-center space-x-2 rounded-md border p-3 transition-colors hover:bg-accent"
                onClick={() => setPaymentMethod('cash')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setPaymentMethod('cash');
                  }
                }}
              >
                <RadioGroupItem value="cash" id="cash" />
                <Label htmlFor="cash" className="flex cursor-pointer items-center">
                  <Wallet className="mr-2 h-4 w-4" />
                  Efectivo
                </Label>
              </div>
            </RadioGroup>

            {paymentMethod === 'cash' && (
              <div className="mt-4 space-y-2">
                <Label htmlFor="cashReceived" className="text-lg font-semibold">
                  Cantidad con la que paga el cliente
                </Label>
                <Input
                  id="cashReceived"
                  type="text"
                  inputMode="decimal"
                  value={cashReceived}
                  onChange={e => setCashReceived(e.target.value)}
                  placeholder={`Ingrese la cantidad recibida (mínimo: $${total.toFixed(2)})`}
                  className="h-12 text-lg"
                  readOnly
                />
                {cashReceived && isValidCashAmount && cashReceivedNumber >= total && (
                  <p className="text-lg text-muted-foreground">
                    Cambio: $
                    {change.toFixed(2)}
                  </p>
                )}
                {cashReceived && !isValidCashAmount && (
                  <p className="text-lg text-red-500">
                    Por favor ingrese un número válido
                  </p>
                )}

                {/* Teclado numérico personalizado */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <Button
                      key={num}
                      type="button"
                      variant="outline"
                      className="h-14 text-xl font-semibold"
                      onClick={() => setCashReceived(prev => prev + num.toString())}
                    >
                      {num}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-14 text-xl font-semibold"
                    onClick={() => setCashReceived(prev => `${prev}0`)}
                  >
                    0
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-14 text-xl font-semibold"
                    onClick={() => setCashReceived((prev) => {
                      if (!prev.includes('.')) {
                        return `${prev}.`;
                      }
                      return prev;
                    })}
                  >
                    .
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-14 text-lg font-semibold text-red-600 hover:text-red-700 dark:text-red-400"
                    onClick={() => setCashReceived(prev => prev.slice(0, -1))}
                  >
                    ⌫
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-14 text-lg font-semibold text-red-600 hover:text-red-700 dark:text-red-400"
                    onClick={() => setCashReceived('')}
                  >
                    Limpiar
                  </Button>
                </div>
              </div>
            )}

            {paymentError && (
              <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
                {paymentError}
              </p>
            )}

            <Button
              className="mt-6 w-full"
              size="lg"
              onClick={handlePayment}
              disabled={
                isProcessing
                || isLoading
                || !carritoId
                || (paymentMethod === 'cash' && (!cashReceived || !isValidCashAmount || cashReceivedNumber < total))
              }
            >
              {isLoading ? 'Cargando carrito...' : isProcessing ? 'Procesando...' : 'Completar Pago'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
