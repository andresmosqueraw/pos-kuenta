import * as React from 'react';

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile((prev) => {
        const newValue = window.innerWidth < MOBILE_BREAKPOINT;
        return prev !== newValue ? newValue : prev;
      });
    };
    mql.addEventListener('change', onChange);
    onChange(); // Call onChange instead of setIsMobile directly
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return !!isMobile;
}
