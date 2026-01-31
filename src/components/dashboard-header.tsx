'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useRestaurant } from '@/contexts/RestaurantContext';

export function DashboardHeader() {
  const { selectedRestaurant } = useRestaurant();
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') {
      return 'dark';
    }
    const savedTheme = localStorage.getItem('kuenta-theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      return savedTheme;
    }
    const htmlElement = document.documentElement;
    const bodyElement = document.body;
    const isDark = htmlElement.classList.contains('dark') || bodyElement.classList.contains('dark');
    return isDark ? 'dark' : 'light';
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Aplicar el tema guardado al DOM
    const htmlElement = document.documentElement;
    const bodyElement = document.body;

    if (theme === 'dark') {
      htmlElement.classList.add('dark');
      bodyElement.classList.add('dark');
    } else {
      htmlElement.classList.remove('dark');
      bodyElement.classList.remove('dark');
    }
    // Guardar el tema en localStorage
    localStorage.setItem('kuenta-theme', theme);
  }, [theme]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);

    // Aplicar el tema al documento HTML y body
    const htmlElement = document.documentElement;
    const bodyElement = document.body;

    if (newTheme === 'dark') {
      htmlElement.classList.add('dark');
      bodyElement.classList.add('dark');
    } else {
      htmlElement.classList.remove('dark');
      bodyElement.classList.remove('dark');
    }

    // Guardar la preferencia en localStorage
    localStorage.setItem('kuenta-theme', newTheme);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/50 backdrop-blur-sm">
      <div className="relative flex h-16 shrink-0 items-center gap-2 px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <div className="flex items-center gap-3">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-base font-bold sm:text-lg">
                    Mesas y Domicilios
                    {selectedRestaurant && (
                      <span className="ml-2">
                        -
                        {' '}
                        <span className="font-bold">{selectedRestaurant.nombre}</span>
                      </span>
                    )}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </div>

        <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3">
          <span className="hidden rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-500 sm:inline-block">
            LIVE
          </span>
          <h1 className="hidden text-xl font-bold tracking-tight text-foreground sm:block">Kuenta</h1>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <div className="hidden flex-col items-end font-mono text-sm sm:flex">
            <span className="text-xs text-muted-foreground">{formatDate(currentTime)}</span>
            <span className="text-foreground tabular-nums">{formatTime(currentTime)}</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
