import {
  createSystem,
  DistanceGrabbable,
  type Entity,
  Euler,
  Grabbed,
  Group,
  Hovered,
  MovementMode,
  Pressed,
  Quaternion,
  RayInteractable,
  Vector3,
  VisibilityState,
  XRPlane,
} from '@iwsdk/core';
import {
  BOARD,
  CanvasPlane,
  CARD_H,
  CARD_W,
  cellCenter,
  cellSize,
  drawBoard,
  drawButton,
  drawCard,
  drawSimi,
  drawStats,
} from './art.js';
import {
  CELL_CAPACITY,
  type Finding,
  TECHNICIANS,
  todaysFindings,
} from './data.js';
import { ActionButton, FindingCard } from './sima-components.js';

type Slot = { tech: number; day: number } | null;

interface CardView {
  entity: Entity;
  plane: CanvasPlane;
  targetPos: Vector3;
  targetQuat: Quaternion;
  targetScale: number;
}

interface ButtonView {
  plane: CanvasPlane;
  label: string;
  primary: boolean;
}

interface Suggestion {
  index: number;
  tech: number;
  day: number;
  reason: string;
}

const STORAGE_KEY = 'sima-xr-v1';
const TRAY_SCALE = 1;
const BOARD_SCALE = 0.55;

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The next five working days starting today (weekends roll to Monday). */
function nextWorkingDays(from: Date): string[] {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const out: string[] = [];
  const d = new Date(from);
  while (out.length < 5) {
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) out.push(names[wd]);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export class PlannerSystem extends createSystem({
  cards: { required: [FindingCard] },
  grabbedCards: { required: [FindingCard, Grabbed] },
  pressedCards: { required: [FindingCard, Pressed] },
  buttons: { required: [ActionButton] },
  hoveredButtons: { required: [ActionButton, Hovered] },
  pressedButtons: { required: [ActionButton, Pressed] },
  planes: { required: [XRPlane] },
}) {
  private findings: Finding[] = [];
  private slots: Slot[] = [];
  private dayLabels: string[] = [];
  private cardViews = new Map<number, CardView>();
  private buttonViews = new Map<string, ButtonView>();

  private root!: Group;
  private rootEntity!: Entity;
  private boardEntity!: Entity;
  private board!: CanvasPlane;
  private simi!: CanvasPlane;
  private stats!: CanvasPlane;

  private selected = -1;
  private suggestion: Suggestion | null = null;
  private onboarding = 0; // 0: pick a card, 1: drop it, 2: try SIMI, 3: free
  private planQueue: number[] = [];
  private planTimer = 0;
  private placeTimer = -1; // frames until the next automatic placement
  private distanceCheck = 0;
  private snappedToDesk = false;
  private streak = 0;
  private lastDone = '';
  private listening = false;
  private recognition: any = null;
  private audio: AudioContext | null = null;
  private simiText = { title: '', body: '', footer: '' };

  // scratch
  private v1 = new Vector3();
  private v2 = new Vector3();

  init(): void {
    const today = new Date();
    this.findings = todaysFindings(today);
    this.slots = this.findings.map(() => null);
    this.dayLabels = nextWorkingDays(today);
    this.restore(today);

    this.root = new Group();
    this.rootEntity = this.world.createTransformEntity(this.root);
    if (import.meta.env.DEV) {
      // Dev-only probe: dispatch `sima-debug` on document to get state.
      const probe = () => {
        const cam = this.world.camera.getWorldPosition(new Vector3());
        const root = this.root.getWorldPosition(new Vector3());
        document.body.dataset.simaDebug = JSON.stringify({
          vis: this.world.visibilityState.peek(),
          cam: cam.toArray().map((v) => +v.toFixed(2)),
          root: root.toArray().map((v) => +v.toFixed(2)),
          rootParent: this.root.parent?.type,
          snapped: this.snappedToDesk,
          planes: this.queries.planes.entities.size,
          slots: this.slots,
        });
      };
      const action = (e: Event) => this.onButton(String((e as CustomEvent).detail));
      document.addEventListener('sima-debug', probe);
      document.addEventListener('sima-action', action);
      this.cleanupFuncs.push(
        () => document.removeEventListener('sima-debug', probe),
        () => document.removeEventListener('sima-action', action),
      );
    }
    this.buildBoard();
    this.buildPanels();
    this.buildCards();
    this.layoutAll(true);
    this.refreshAll();
    this.welcome();
    // Browser preview: put the workspace in front of the default camera.
    this.placeWorkspace();

    this.queries.pressedButtons.subscribe('qualify', (e) => {
      this.onButton(e.getValue(ActionButton, 'action') as string);
    });
    this.queries.hoveredButtons.subscribe('qualify', (e) =>
      this.paintButton(e.getValue(ActionButton, 'action') as string, true),
    );
    this.queries.hoveredButtons.subscribe('disqualify', (e) =>
      this.paintButton(e.getValue(ActionButton, 'action') as string, false),
    );
    this.queries.pressedCards.subscribe('qualify', (e) => {
      this.selectCard(e.getValue(FindingCard, 'index') as number);
    });
    this.queries.grabbedCards.subscribe('qualify', (e) => {
      const i = e.getValue(FindingCard, 'index') as number;
      this.selectCard(i);
      if (this.onboarding === 0) {
        this.onboarding = 1;
        const s = this.suggestion;
        this.say(
          'Now drop it on the board',
          s
            ? `Drop it on a day in ${TECHNICIANS[s.tech].name}'s row. ${s.reason}`
            : 'Drop it on a technician’s day.',
          'Release the pinch over a highlighted slot.',
        );
      }
    });
    this.queries.grabbedCards.subscribe('disqualify', (e) => {
      this.dropCard(e.getValue(FindingCard, 'index') as number);
    });
    this.queries.planes.subscribe('qualify', () => {
      if (!this.snappedToDesk && this.world.visibilityState.peek() !== VisibilityState.NonImmersive) {
        this.placeTimer = 10;
      }
    });
    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((state) => {
        if (state === VisibilityState.Visible) {
          this.snappedToDesk = false;
          this.placeTimer = 30; // let the head pose settle first
          try {
            this.world.session?.updateTargetFrameRate?.(72);
          } catch {
            /* optional */
          }
        }
        if (state === VisibilityState.NonImmersive) this.placeWorkspace();
      }),
    );
  }

  // ---------------------------------------------------------------- build

  private buildBoard() {
    this.board = new CanvasPlane(BOARD.width, BOARD.height, 1400);
    this.boardEntity = this.world.createTransformEntity(this.board.mesh, {
      parent: this.rootEntity,
    });
    const o = this.boardEntity.object3D!;
    o.position.set(0, 0.29, -0.13);
    o.rotation.set(-0.12, 0, 0);
  }

  private buildPanels() {
    // SIMI assistant, right side, angled toward the user.
    this.simi = new CanvasPlane(0.3, 0.3, 1300);
    const simiE = this.world.createTransformEntity(this.simi.mesh, { parent: this.rootEntity });
    simiE.object3D!.position.set(0.54, 0.31, -0.02);
    simiE.object3D!.rotation.set(-0.08, -0.62, 0);

    // Daily stats, left side.
    this.stats = new CanvasPlane(0.28, 0.3, 1300);
    const statsE = this.world.createTransformEntity(this.stats.mesh, { parent: this.rootEntity });
    statsE.object3D!.position.set(-0.53, 0.31, -0.02);
    statsE.object3D!.rotation.set(-0.08, 0.62, 0);

    const right: [string, string, boolean][] = [
      ['suggest', 'Suggest', false],
      ['accept', 'Accept', true],
      ['planall', 'Plan all', true],
      ['voice', 'Talk', false],
    ];
    right.forEach(([action, label, primary], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      this.addButton(action, label, primary, simiE.object3D!.position, -0.62, col, row);
    });
    const left: [string, string, boolean][] = [
      ['recenter', 'Recenter', false],
      ['reset', 'Reset day', false],
    ];
    left.forEach(([action, label, primary], i) => {
      this.addButton(action, label, primary, statsE.object3D!.position, 0.62, i, 0);
    });
  }

  private addButton(
    action: string,
    label: string,
    primary: boolean,
    anchor: Vector3,
    yaw: number,
    col: number,
    row: number,
  ) {
    const plane = new CanvasPlane(0.135, 0.042, 1500);
    const e = this.world.createTransformEntity(plane.mesh, { parent: this.rootEntity });
    // offset along the panel's local X axis
    const dx = (col - 0.5) * 0.145;
    const o = e.object3D!;
    o.position.set(
      anchor.x + Math.cos(yaw) * dx,
      anchor.y - 0.185 - row * 0.05,
      anchor.z - Math.sin(yaw) * dx,
    );
    o.rotation.set(-0.08, yaw, 0);
    e.addComponent(RayInteractable);
    e.addComponent(ActionButton, { action });
    this.buttonViews.set(action, { plane, label, primary });
    drawButton(plane, label, false, primary);
  }

  private buildCards() {
    this.findings.forEach((f, i) => {
      const plane = new CanvasPlane(CARD_W, CARD_H, 2600);
      const e = this.world.createTransformEntity(plane.mesh, { parent: this.rootEntity });
      e.addComponent(FindingCard, { index: i });
      e.addComponent(RayInteractable);
      e.addComponent(DistanceGrabbable, {
        movementMode: MovementMode.MoveFromTarget,
        rotate: false,
        scale: false,
        translate: true,
      });
      this.cardViews.set(i, {
        entity: e,
        plane,
        targetPos: new Vector3(),
        targetQuat: new Quaternion(),
        targetScale: TRAY_SCALE,
      });
    });
  }

  // --------------------------------------------------------------- layout

  private trayPose(order: number, count: number, pos: Vector3, quat: Quaternion) {
    const spacing = 0.108;
    const x = (order - (count - 1) / 2) * spacing;
    pos.set(x, 0, 0.07 + Math.abs(x) * 0.12);
    quat.setFromEuler(this.tmpEuler(-0.75, -x * 0.5, 0));
  }

  private euler = new Euler();
  private tmpEuler(x: number, y: number, z: number) {
    return this.euler.set(x, y, z);
  }

  private slotPose(i: number, slot: { tech: number; day: number }, pos: Vector3, quat: Quaternion) {
    // index within the cell decides left/right
    let k = 0;
    for (let j = 0; j < i; j++) {
      const s = this.slots[j];
      if (s && s.tech === slot.tech && s.day === slot.day) k++;
    }
    const [cx, cy] = cellCenter(slot.tech, slot.day);
    const [cw] = cellSize();
    const offset = (k - 0.5) * (cw * 0.42);
    const board = this.boardEntity.object3D!;
    pos.set(cx + offset, cy - 0.006, 0.006);
    pos.applyQuaternion(board.quaternion).add(board.position);
    quat.copy(board.quaternion);
  }

  private layoutAll(snap = false) {
    const unscheduled = this.findings
      .map((_, i) => i)
      .filter((i) => this.slots[i] === null);
    for (const [i, view] of this.cardViews) {
      const slot = this.slots[i];
      if (slot) {
        this.slotPose(i, slot, view.targetPos, view.targetQuat);
        view.targetScale = BOARD_SCALE;
      } else {
        this.trayPose(unscheduled.indexOf(i), unscheduled.length, view.targetPos, view.targetQuat);
        view.targetScale = TRAY_SCALE;
      }
      if (snap) {
        const o = view.entity.object3D!;
        o.position.copy(view.targetPos);
        o.quaternion.copy(view.targetQuat);
        o.scale.setScalar(view.targetScale);
      }
    }
  }

  /** Put the workspace ~0.6 m in front of the user, at seated desk height. */
  private placeWorkspace() {
    const head = this.world.camera;
    head.updateWorldMatrix(true, false);
    const headPos = head.getWorldPosition(this.v1);
    const fwd = head.getWorldDirection(this.v2);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
    fwd.normalize();
    const dist = 0.62;
    this.root.position.set(
      headPos.x + fwd.x * dist,
      headPos.y - 0.4,
      headPos.z + fwd.z * dist,
    );
    this.root.rotation.set(0, Math.atan2(-fwd.x, -fwd.z), 0);

    // Mixed reality: if a real table is detected under the workspace,
    // rest the card tray on it.
    let bestY = Number.NaN;
    let bestD = Infinity;
    for (const e of this.queries.planes.entities) {
      const plane = e.getValue(XRPlane, '_plane') as { orientation?: string } | undefined;
      if (!plane || plane.orientation !== 'horizontal' || !e.object3D) continue;
      const p = e.object3D.getWorldPosition(this.v1);
      const dy = headPos.y - p.y;
      if (dy < 0.25 || dy > 0.85) continue; // floor or ceiling, not a desk
      const d = Math.hypot(p.x - this.root.position.x, p.z - this.root.position.z);
      if (d < 0.9 && d < bestD) {
        bestD = d;
        bestY = p.y;
      }
    }
    if (!Number.isNaN(bestY)) {
      this.root.position.y = bestY + 0.075;
      if (!this.snappedToDesk) {
        this.snappedToDesk = true;
        this.blip(880);
        if (this.onboarding < 3) {
          this.say(
            'Workspace placed on your desk',
            'I found your table and laid today’s findings on it. Pinch a card to pick it up.',
            'Tip: tap Recenter any time.',
          );
        }
      }
    }
  }

  // ---------------------------------------------------------------- logic

  private load(): { load: number[][]; hours: number[][] } {
    const load = TECHNICIANS.map(() => this.dayLabels.map(() => 0));
    const hours = TECHNICIANS.map(() => this.dayLabels.map(() => 0));
    this.slots.forEach((s, i) => {
      if (!s) return;
      load[s.tech][s.day]++;
      hours[s.tech][s.day] += this.findings[i].hours;
    });
    return { load, hours };
  }

  /** The planning agent: picks technician + day for a finding. */
  private suggest(i: number): Suggestion | null {
    const f = this.findings[i];
    const tech = TECHNICIANS.findIndex((t) => t.discipline === f.discipline);
    const { load, hours } = this.load();
    let best = -1;
    let bestScore = Infinity;
    for (let d = 0; d < this.dayLabels.length; d++) {
      if (load[tech][d] >= CELL_CAPACITY) continue;
      let score = d * (f.foodSafety ? 6 : 1) + hours[tech][d] * 0.8;
      if (d > f.dueDay) score += 50 + (d - f.dueDay) * 10;
      if (score < bestScore) {
        bestScore = score;
        best = d;
      }
    }
    if (best < 0) return null;
    const t = TECHNICIANS[tech];
    const due = this.dayLabels[Math.min(f.dueDay, this.dayLabels.length - 1)];
    const parts: string[] = [];
    if (f.foodSafety) parts.push('Food-safety risk, so I put it first.');
    parts.push(`${f.discipline} job → ${t.name}.`);
    parts.push(
      best <= f.dueDay
        ? `${this.dayLabels[best]} meets the due date (${due}).`
        : `Heads up: ${this.dayLabels[best]} is after the due date (${due}); the week is full.`,
    );
    if (hours[tech][best] > 0) parts.push(`${t.name} already has ${hours[tech][best]}h that day.`);
    return { index: i, tech, day: best, reason: parts.join(' ') };
  }

  private nextUnscheduled(): number {
    const order = this.findings
      .map((f, i) => ({ f, i }))
      .filter(({ i }) => this.slots[i] === null)
      .sort(
        (a, b) =>
          Number(b.f.foodSafety) - Number(a.f.foodSafety) ||
          a.f.dueDay - b.f.dueDay ||
          b.f.daysOpen - a.f.daysOpen,
      );
    return order.length ? order[0].i : -1;
  }

  private selectCard(i: number) {
    const prev = this.selected;
    this.selected = i;
    this.suggestion = this.slots[i] ? null : this.suggest(i);
    if (prev >= 0 && prev !== i) this.paintCard(prev);
    this.paintCard(i);
    this.paintBoard();
    if (this.onboarding >= 1) {
      const f = this.findings[i];
      if (this.suggestion) {
        const s = this.suggestion;
        this.say(
          `${f.id} → ${TECHNICIANS[s.tech].name}, ${this.dayLabels[s.day]}`,
          s.reason,
          'Drop it there, or tap Accept.',
        );
      } else if (this.slots[i]) {
        const s = this.slots[i]!;
        this.say(
          `${f.id} is booked`,
          `${TECHNICIANS[s.tech].name} on ${this.dayLabels[s.day]}. Drag it to another day, or back to the tray to unschedule it.`,
          '',
        );
      } else {
        this.say(`No slot for ${f.id}`, `${f.discipline} is fully booked this week. Consider a contractor or overtime.`, '');
      }
    }
  }

  private assign(i: number, slot: Slot, fromAgent = false) {
    this.slots[i] = slot;
    if (this.selected === i) this.suggestion = null;
    this.layoutAll();
    this.refreshAll();
    this.persist();
    this.blip(slot ? 660 : 440);
    if (slot && this.onboarding <= 1 && !fromAgent) {
      this.onboarding = 2;
      this.say(
        'Nice, first job planned',
        'Want me to plan the rest? Tap Plan all or say "plan all". You can still move anything I place.',
        'Voice: "plan all", "suggest", "accept", "what’s urgent?"',
      );
    }
    this.checkDone();
  }

  private dropCard(i: number) {
    const view = this.cardViews.get(i);
    if (!view) return;
    const board = this.boardEntity.object3D!;
    // Project the eye→card line onto the board plane: what the user sees
    // lined up with a slot is where the card lands, at any holding depth.
    const eye = this.world.camera.getWorldPosition(this.v2);
    const card = view.entity.object3D!.getWorldPosition(this.v1);
    board.worldToLocal(eye);
    board.worldToLocal(card);
    const dz = card.z - eye.z;
    const local = this.v1;
    if (Math.abs(dz) > 1e-4) {
      const t = -eye.z / dz;
      if (t > 0) local.set(eye.x + (card.x - eye.x) * t, eye.y + (card.y - eye.y) * t, 0);
    }
    const inBoard =
      local.x > -BOARD.width / 2 + BOARD.labelW - 0.03 &&
      local.x < BOARD.width / 2 + 0.03 &&
      local.y > -BOARD.height / 2 &&
      local.y < BOARD.height / 2 - BOARD.headerH + 0.03;
    if (!inBoard) {
      // Back to the tray (unschedules if it was booked).
      this.assign(i, null);
      return;
    }
    let best: { tech: number; day: number } | null = null;
    let bestD = Infinity;
    for (let t = 0; t < TECHNICIANS.length; t++) {
      for (let d = 0; d < this.dayLabels.length; d++) {
        const [cx, cy] = cellCenter(t, d);
        const dd = Math.hypot(local.x - cx, local.y - cy);
        if (dd < bestD) {
          bestD = dd;
          best = { tech: t, day: d };
        }
      }
    }
    if (!best) return;
    const current = this.slots[i];
    const { load } = this.load();
    const sameCell = current && current.tech === best.tech && current.day === best.day;
    if (!sameCell && load[best.tech][best.day] >= CELL_CAPACITY) {
      this.say('That day is full', `${TECHNICIANS[best.tech].name} already has ${CELL_CAPACITY} jobs on ${this.dayLabels[best.day]}. Try another day.`, '');
      this.blip(220);
      this.layoutAll();
      return;
    }
    const f = this.findings[i];
    const tech = TECHNICIANS[best.tech];
    const wasOnboarding = this.onboarding < 2;
    this.assign(i, best);
    if (!wasOnboarding && this.onboarding < 3) {
      const notes: string[] = [];
      if (tech.discipline !== f.discipline) notes.push(`${tech.name} is ${tech.discipline}; this is a ${f.discipline} job.`);
      if (best.day > f.dueDay) notes.push(`It’s after the due date (${this.dayLabels[f.dueDay]}).`);
      this.say(
        `${f.id} → ${tech.name}, ${this.dayLabels[best.day]}`,
        notes.length ? `Booked. Note: ${notes.join(' ')}` : 'Booked. Good match for skills and due date.',
        '',
      );
    }
  }

  private checkDone() {
    const remaining = this.slots.filter((s) => s === null).length;
    if (remaining > 0) return;
    const today = isoDate(new Date());
    if (this.lastDone !== today) {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      this.streak = this.lastDone === isoDate(y) ? this.streak + 1 : 1;
      this.lastDone = today;
      this.persist();
    }
    const fs = this.findings.filter((f) => f.foodSafety);
    const firstDays = fs.map((f) => this.slots[this.findings.indexOf(f)]!.day);
    const latestFs = firstDays.length ? this.dayLabels[Math.max(...firstDays)] : '-';
    this.onboarding = 3;
    this.selected = -1;
    this.refreshAll();
    this.say(
      'Plan ready ✓',
      `All ${this.findings.length} findings are booked. ${fs.length} food-safety ${fs.length === 1 ? 'risk is' : 'risks are'} fixed by ${latestFs}. Planning streak: ${this.streak} day${this.streak === 1 ? '' : 's'}.`,
      'Come back tomorrow: new findings arrive after today’s inspection route.',
    );
    this.blip(990);
    setTimeout(() => this.blip(1320), 140);
  }

  // --------------------------------------------------------------- buttons

  private onButton(action: string) {
    this.blip(520);
    switch (action) {
      case 'suggest': {
        const i = this.selected >= 0 && this.slots[this.selected] === null ? this.selected : this.nextUnscheduled();
        if (i < 0) {
          this.say('Nothing left to plan', 'Every finding already has a slot.', '');
          return;
        }
        if (this.onboarding < 2) this.onboarding = 2;
        this.selectCard(i);
        break;
      }
      case 'accept': {
        if (!this.suggestion) {
          this.onButton('suggest');
          return;
        }
        const s = this.suggestion;
        this.assign(s.index, { tech: s.tech, day: s.day }, true);
        this.say(`Booked ${this.findings[s.index].id}`, `${TECHNICIANS[s.tech].name}, ${this.dayLabels[s.day]}.`, '');
        break;
      }
      case 'planall': {
        this.planQueue = [];
        this.planTimer = 0;
        this.onboarding = Math.max(this.onboarding, 2);
        // The queue is resolved one card at a time so each move is visible.
        this.planQueue.push(-1);
        this.say('Planning the rest…', 'Food-safety risks first, then by due date and age. Watch the board.', '');
        break;
      }
      case 'voice':
        this.toggleVoice();
        break;
      case 'recenter':
        this.snappedToDesk = false;
        this.placeWorkspace();
        break;
      case 'reset':
        this.slots = this.findings.map(() => null);
        this.selected = -1;
        this.suggestion = null;
        this.onboarding = 0;
        this.persist();
        this.layoutAll();
        this.refreshAll();
        this.welcome();
        break;
    }
  }

  // ------------------------------------------------------------------ voice

  private toggleVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      this.say('Voice not available here', 'This browser has no speech recognition. Every action also works with a pinch.', '');
      return;
    }
    if (this.listening) {
      this.recognition?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (ev: any) => this.onVoice(String(ev.results[0][0].transcript || '').toLowerCase());
    rec.onend = () => {
      this.listening = false;
      this.paintSimi();
    };
    rec.onerror = () => {
      this.listening = false;
      this.paintSimi();
    };
    this.recognition = rec;
    this.listening = true;
    this.paintSimi();
    try {
      rec.start();
    } catch {
      this.listening = false;
      this.paintSimi();
    }
  }

  private onVoice(text: string) {
    if (/plan (all|everything|the rest)|auto/.test(text)) return this.onButton('planall');
    if (/accept|yes|do it|book it|confirm/.test(text)) return this.onButton('accept');
    if (/suggest|next|what now|help/.test(text)) return this.onButton('suggest');
    if (/reset|start over/.test(text)) return this.onButton('reset');
    if (/recenter|center|move/.test(text)) return this.onButton('recenter');
    if (/urgent|food|risk|priority/.test(text)) {
      const open = this.findings.filter((f, i) => f.foodSafety && this.slots[i] === null);
      this.say(
        open.length ? `${open.length} food-safety risks open` : 'No open food-safety risks',
        open.length ? open.map((f) => `${f.id} ${f.title} (${f.area})`).join('. ') + '.' : 'Every food-safety finding has a slot.',
        '',
      );
      return;
    }
    this.say(`I heard: "${text}"`, 'Try "plan all", "suggest", "accept" or "what’s urgent?".', '');
  }

  // ---------------------------------------------------------------- render

  private say(title: string, body: string, footer: string) {
    this.simiText = { title, body, footer };
    this.paintSimi();
  }

  private welcome() {
    const n = this.findings.length;
    const fs = this.findings.filter((f) => f.foodSafety).length;
    this.say(
      'Good morning!',
      `Yesterday’s inspection route raised ${n} findings, ${fs} of them ${fs === 1 ? 'a food-safety risk' : 'food-safety risks'}. Let’s give each one a technician and a day. Pinch a card in front of you to pick it up.`,
      'Hands only. Everything works seated.',
    );
  }

  private paintSimi() {
    drawSimi(this.simi, this.simiText.title, this.simiText.body, this.simiText.footer, this.listening);
  }

  private paintCard(i: number) {
    const v = this.cardViews.get(i);
    if (!v) return;
    const s = this.slots[i];
    drawCard(v.plane, this.findings[i], {
      selected: this.selected === i,
      scheduledLabel: s ? `${this.dayLabels[s.day]} · ${TECHNICIANS[s.tech].name}` : undefined,
    });
  }

  private paintBoard() {
    const { load, hours } = this.load();
    const hi = this.suggestion ? ([this.suggestion.tech, this.suggestion.day] as [number, number]) : null;
    drawBoard(this.board, load, hours, hi, this.dayLabels);
  }

  private paintStats() {
    const backlog = this.slots.filter((s) => s === null).length;
    const foodSafetyLeft = this.findings.filter((f, i) => f.foodSafety && this.slots[i] === null).length;
    const overdueRisk = this.findings.filter((f, i) => {
      const s = this.slots[i];
      return s !== null && s.day > f.dueDay;
    }).length;
    drawStats(this.stats, {
      backlog,
      planned: this.findings.length - backlog,
      foodSafetyLeft,
      overdueRisk,
      streak: this.streak,
      done: backlog === 0,
    });
  }

  private paintButton(action: string, hovered: boolean) {
    const b = this.buttonViews.get(action);
    if (b) drawButton(b.plane, b.label, hovered, b.primary);
  }

  private refreshAll() {
    this.findings.forEach((_, i) => this.paintCard(i));
    this.paintBoard();
    this.paintStats();
  }

  private blip(freq: number) {
    try {
      this.audio ??= new AudioContext();
      const ctx = this.audio;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {
      /* audio is optional */
    }
  }

  // ---------------------------------------------------------- persistence

  private persist() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          date: isoDate(new Date()),
          ids: this.findings.map((f) => f.id),
          slots: this.slots,
          streak: this.streak,
          lastDone: this.lastDone,
        }),
      );
    } catch {
      /* storage is optional */
    }
  }

  private restore(today: Date) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      this.streak = Number(data.streak) || 0;
      this.lastDone = String(data.lastDone || '');
      if (data.date === isoDate(today) && Array.isArray(data.slots) && data.slots.length === this.slots.length) {
        this.slots = data.slots;
        this.onboarding = 3;
      }
    } catch {
      /* ignore corrupt state */
    }
  }

  // ---------------------------------------------------------------- update

  update(delta: number): void {
    // Placement counts frames: head pose is only trustworthy once XR frames flow.
    if (this.placeTimer > 0) {
      this.placeTimer -= 1;
      if (this.placeTimer <= 0) this.placeWorkspace();
    }
    // Safety net: if the workspace ends up far from the user (new session,
    // tracking reset), bring it back in front of them.
    if (++this.distanceCheck >= 45) {
      this.distanceCheck = 0;
      if (this.world.visibilityState.peek() === VisibilityState.Visible) {
        const head = this.world.camera.getWorldPosition(this.v1);
        const d = Math.hypot(head.x - this.root.position.x, head.z - this.root.position.z);
        if (d > 1.5) this.placeWorkspace();
      }
    }

    if (this.planQueue.length) {
      this.planTimer -= delta;
      if (this.planTimer <= 0) {
        this.planTimer = 0.45;
        const i = this.nextUnscheduled();
        if (i < 0) {
          this.planQueue = [];
        } else {
          const s = this.suggest(i);
          if (s) {
            this.selected = i;
            this.assign(i, { tech: s.tech, day: s.day }, true);
          } else {
            this.planQueue = [];
            this.say('Week is full', `${this.findings[i].discipline} has no free slots left for ${this.findings[i].id}.`, '');
          }
        }
      }
    }

    // Ease cards toward their targets unless a hand is holding them.
    const a = Math.min(1, delta * 12);
    for (const view of this.cardViews.values()) {
      if (view.entity.hasComponent(Grabbed)) continue;
      const o = view.entity.object3D!;
      o.position.lerp(view.targetPos, a);
      o.quaternion.slerp(view.targetQuat, a);
      const s = o.scale.x + (view.targetScale - o.scale.x) * a;
      o.scale.setScalar(s);
    }
  }
}
