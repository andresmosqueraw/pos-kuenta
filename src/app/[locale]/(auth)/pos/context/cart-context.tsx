'use client';

import type { ReactNode } from 'react';
import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react';

export type Product = {
  id: number;
  name: string;
  price: number;
  image: string;
  category: string;
  productoRestauranteId?: number;
};

type CartItem = {
  quantity: number;
} & Product;

type CartContextType = {
  cart: CartItem[];
  addToCart: (product: Product) => Promise<void>;
  removeFromCart: (productId: number) => Promise<void>;
  updateQuantity: (productId: number, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  cartTotal: number;
  itemCount: number;
  isLoading: boolean;
  carritoId: number | null;
  updatingItems: Set<number>;
};

type CartProviderProps = {
  children: ReactNode;
  tipo?: 'mesa' | 'domicilio' | null;
  id?: string | null;
  restauranteId?: string | null;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children, tipo, id, restauranteId }: CartProviderProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [carritoId, setCarritoId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingItems, setUpdatingItems] = useState<Set<number>>(new Set());

  const cargarCarrito = useCallback(async () => {
    if (!tipo || !id || !restauranteId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/carrito/obtener-completo?tipo=${tipo}&id=${id}&restauranteId=${restauranteId}`,
      );

      if (!response.ok) {
        setCart([]);
        setCarritoId(null);
        return;
      }

      const data = await response.json();
      if (data.success) {
        setCart(data.productos || []);
        setCarritoId(data.carritoId);
      } else {
        setCart([]);
        setCarritoId(null);
      }
    } catch (error) {
      console.error('Error al cargar carrito:', error);
      setCart([]);
      setCarritoId(null);
    } finally {
      setIsLoading(false);
    }
  }, [tipo, id, restauranteId]);

  useEffect(() => {
    cargarCarrito();
  }, [cargarCarrito]);

  const addToCart = useCallback(async (product: Product) => {
    if (!tipo || !id || !restauranteId) {
      console.error('Faltan parámetros para agregar al carrito');
      return;
    }

    setUpdatingItems(prev => new Set(prev).add(product.id));

    try {
      if (!carritoId) {
        // Primer producto: crear carrito
        const response = await fetch('/api/carrito/crear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipoPedido: {
              tipo,
              mesaId: tipo === 'mesa' ? Number.parseInt(id) : undefined,
              domicilioId: tipo === 'domicilio' ? Number.parseInt(id) : undefined,
            },
            carritoData: {
              restauranteId: Number.parseInt(restauranteId),
              productos: [{
                productoId: product.id,
                productoRestauranteId: product.productoRestauranteId,
                cantidad: 1,
                precioUnitario: product.price,
                subtotal: product.price,
              }],
            },
          }),
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        if (data.success) {
          setCarritoId(data.carritoId);
          // Actualizar estado local directamente
          setCart([{ ...product, quantity: 1 }]);
        }
      } else {
        // Carrito existente: agregar producto
        const response = await fetch('/api/carrito/agregar-producto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            carritoId,
            productoRestauranteId: product.productoRestauranteId,
            productoId: product.id,
            restauranteId: Number.parseInt(restauranteId),
            cantidad: 1,
            precioUnitario: product.price,
          }),
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        if (data.success) {
          // Actualizar estado local directamente (optimistic)
          setCart((prev) => {
            const existing = prev.find(i => i.id === product.id);
            if (existing) {
              return prev.map(i =>
                i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i,
              );
            }
            return [...prev, { ...product, quantity: 1 }];
          });
        }
      }
    } catch (error) {
      console.error('Error al agregar al carrito:', error);
    } finally {
      setUpdatingItems((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }
  }, [tipo, id, restauranteId, carritoId]);

  const removeFromCart = useCallback(async (productId: number) => {
    if (!carritoId || !restauranteId) {
      return;
    }

    setUpdatingItems(prev => new Set(prev).add(productId));

    try {
      const response = await fetch('/api/carrito/eliminar-producto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carritoId,
          restauranteId: Number.parseInt(restauranteId),
          productoId: productId,
        }),
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      if (data.success) {
        setCart(prev => prev.filter(i => i.id !== productId));
      }
    } catch (error) {
      console.error('Error al eliminar del carrito:', error);
    } finally {
      setUpdatingItems((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }
  }, [carritoId, restauranteId]);

  const updateQuantity = useCallback(async (productId: number, quantity: number) => {
    if (!carritoId || !restauranteId) {
      return;
    }

    if (quantity <= 0) {
      await removeFromCart(productId);
      return;
    }

    const item = cart.find(i => i.id === productId);
    if (!item) {
      return;
    }

    setUpdatingItems(prev => new Set(prev).add(productId));

    try {
      const response = await fetch('/api/carrito/actualizar-cantidad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carritoId,
          restauranteId: Number.parseInt(restauranteId),
          productoId: productId,
          cantidad: quantity,
          precioUnitario: item.price,
        }),
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      if (data.success) {
        setCart(prev =>
          prev.map(i => i.id === productId ? { ...i, quantity } : i),
        );
      }
    } catch (error) {
      console.error('Error al actualizar cantidad:', error);
    } finally {
      setUpdatingItems((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }
  }, [carritoId, restauranteId, cart, removeFromCart]);

  const clearCart = useCallback(async () => {
    if (!carritoId || !tipo || !id) {
      return;
    }

    try {
      const tipoPedido = {
        tipo,
        mesaId: tipo === 'mesa' ? Number.parseInt(id) : undefined,
        domicilioId: tipo === 'domicilio' ? Number.parseInt(id) : undefined,
      };

      const response = await fetch('/api/carrito/limpiar-vacio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carritoId, tipoPedido }),
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      if (data.success) {
        setCart([]);
        setCarritoId(null);
      }
    } catch (error) {
      console.error('Error al limpiar carrito:', error);
    }
  }, [carritoId, tipo, id]);

  const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);
  const itemCount = cart.reduce((count, item) => count + item.quantity, 0);

  const contextValue = useMemo(
    () => ({
      cart,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      cartTotal,
      itemCount,
      isLoading,
      carritoId,
      updatingItems,
    }),
    [cart, cartTotal, itemCount, addToCart, removeFromCart, updateQuantity, clearCart, isLoading, carritoId, updatingItems],
  );

  return <CartContext value={contextValue}>{children}</CartContext>;
}

export function useCart() {
  const context = use(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
