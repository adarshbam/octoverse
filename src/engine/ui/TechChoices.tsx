import type { ComponentProps, ReactNode } from 'react';
import { choiceRemoved } from '../artifacts/strategies';
import type { ArtifactConfig, StageId } from '../config/types';
import { OrbButtons } from './OrbButtons';
import { OrbTray } from './OrbTray';

/**
 * The ways to choose a technology: a button over each bubble and the tray, with `children` (the
 * tooltips) between them. In a stage the world does not let a technology be chosen in
 * (`artifacts.choosableIn`, strategies.ts `choiceRemoved`) neither is drawn; the tooltips still are.
 */
export function TechChoices({ stage, artifacts, buttons, tray, children }: {
  stage: StageId;
  artifacts: Pick<ArtifactConfig, 'choosableIn'>;
  buttons: ComponentProps<typeof OrbButtons>;
  tray: ComponentProps<typeof OrbTray>;
  children?: ReactNode;
}) {
  const removed = choiceRemoved(stage, artifacts);
  return (
    <>
      {!removed && <OrbButtons {...buttons} />}
      {children}
      {!removed && <OrbTray {...tray} />}
    </>
  );
}
