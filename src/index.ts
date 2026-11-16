import { VisibilityState, World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { PanelSystem } from './panel.js';
import { PlannerSystem } from './planner-system.js';
import { ActionButton, FindingCard } from './sima-components.js';

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  world.registerComponent(FindingCard).registerComponent(ActionButton);
  world.registerSystem(PanelSystem);
  world.registerSystem(PlannerSystem, { priority: 30 });

  // A plain, always-visible "Enter XR" button for the Quest Browser.
  const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
  xr?.isSessionSupported('immersive-ar').then((ok) => {
    if (!ok) return;
    const btn = document.createElement('button');
    btn.textContent = 'Enter XR';
    btn.setAttribute('aria-label', 'Enter mixed reality');
    Object.assign(btn.style, {
      position: 'fixed',
      left: '50%',
      bottom: '24px',
      transform: 'translateX(-50%)',
      padding: '14px 32px',
      font: '700 20px system-ui, sans-serif',
      color: '#111',
      background: '#ff7a1a',
      border: 'none',
      borderRadius: '999px',
      cursor: 'pointer',
      zIndex: '10',
    });
    btn.addEventListener('click', () => world.launchXR());
    document.body.appendChild(btn);
    world.visibilityState.subscribe((s) => {
      btn.style.display = s === VisibilityState.NonImmersive ? 'block' : 'none';
    });
  });
});
