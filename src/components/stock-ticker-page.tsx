'use client';

import type { Stock } from '@/lib/stock-types';
import { useCallback, useEffect, useState } from 'react';
import { generateInitialStocks, simulateStockUpdate } from '@/lib/stock-data';
import { Header } from './header';
import { OverviewPanels } from './overview-panels';
import { WatchlistTable } from './watchlist-table';

export function StockTickerPage() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [stocks, setStocks] = useState<Stock[]>(() => generateInitialStocks());

  // Simulate live updates every 3-5 seconds
  useEffect(() => {
    const updateStocks = () => {
      setStocks((prevStocks) => {
        const updatedStocks = [...prevStocks];
        const numToUpdate = Math.floor(Math.random() * 5) + 2;
        const indicesToUpdate = new Set<number>();

        while (indicesToUpdate.size < Math.min(numToUpdate, updatedStocks.length)) {
          indicesToUpdate.add(Math.floor(Math.random() * updatedStocks.length));
        }

        indicesToUpdate.forEach((index) => {
          const stock = updatedStocks[index];
          if (stock) {
            updatedStocks[index] = simulateStockUpdate(stock);
          }
        });

        return updatedStocks;
      });
    };

    const interval = setInterval(updateStocks, 3000 + Math.random() * 2000);

    return () => clearInterval(interval);
  }, []);

  const addStock = useCallback((symbol: string, name: string) => {
    const newStock: Stock = {
      id: crypto.randomUUID(),
      symbol: symbol.toUpperCase(),
      name: name || symbol.toUpperCase(),
      price: Math.random() * 500 + 10,
      prevClose: 0,
      change: 0,
      changePercent: 0,
      direction: 'flat',
    };
    newStock.prevClose = newStock.price;
    setStocks(prev => [...prev, newStock]);
  }, []);

  const removeStock = useCallback((id: string) => {
    setStocks(prev => prev.filter(stock => stock.id !== id));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="bg-background pb-8 text-foreground transition-colors duration-300">
        <Header theme={theme} onToggleTheme={toggleTheme} />
        <main className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <WatchlistTable
                stocks={stocks}
                onAddStock={addStock}
                onRemoveStock={removeStock}
              />
            </div>
            <div className="lg:col-span-1">
              <OverviewPanels stocks={stocks} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
