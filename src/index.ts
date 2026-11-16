import { World } from '@iwsdk/core';
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
  if (import.meta.env.DEV) (window as unknown as { __world: unknown }).__world = world;
});
