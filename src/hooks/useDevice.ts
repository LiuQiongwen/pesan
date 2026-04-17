import { useState, useEffect } from 'react';

export type DeviceClass = 'phone' | 'tablet' | 'desktop';

interface DeviceInfo {
  device: DeviceClass;
  isTouch: boolean;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

function detect(): DeviceInfo {
  if (typeof window === 'undefined') {
    return { device: 'desktop', isTouch: false, isPhone: false, isTablet: false, isDesktop: true };
  }
  const w = window.innerWidth;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const isPhone  = w < 768 || (coarse && w < 768);
  const isTablet = !isPhone && w < 1200 && coarse;
  const device: DeviceClass = isPhone ? 'phone' : isTablet ? 'tablet' : 'desktop';
  return { device, isTouch: coarse, isPhone, isTablet, isDesktop: device === 'desktop' };
}

export function useDevice(): DeviceInfo {
  const [info, setInfo] = useState<DeviceInfo>(detect);

  useEffect(() => {
    const update = () => setInfo(detect());
    const mql768 = window.matchMedia('(max-width: 767px)');
    const mql1200 = window.matchMedia('(max-width: 1199px)');
    mql768.addEventListener('change', update);
    mql1200.addEventListener('change', update);
    window.addEventListener('orientationchange', update);
    return () => {
      mql768.removeEventListener('change', update);
      mql1200.removeEventListener('change', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return info;
}
