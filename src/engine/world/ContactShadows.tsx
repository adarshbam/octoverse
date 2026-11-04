import { useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { ContactShadowEffect, type ContactShadowSettings } from './contactShadowEffect';

/** Contact shadows for the stage, made with the stage camera; place inside the EffectComposer. */
export function ContactShadows({ settings }: { settings: ContactShadowSettings }) {
  const camera = useThree(state => state.camera);
  const effect = useMemo(() => new ContactShadowEffect(settings, camera), [settings, camera]);
  return <primitive object={effect} dispose={null} />;
}
