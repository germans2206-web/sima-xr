import { createComponent, Types } from '@iwsdk/core';

/** A maintenance finding card the planner can pick up and schedule. */
export const FindingCard = createComponent('FindingCard', {
  index: { type: Types.Int16, default: 0 },
});

/** A pressable 3D button; `action` is dispatched by the PlannerSystem. */
export const ActionButton = createComponent('ActionButton', {
  action: { type: Types.String, default: '' },
});
