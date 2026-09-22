<script lang="ts">
  import { knobDrag } from '../gestures/knob-drag';
  import { knobAngle, knobArcPath, KNOB_CENTER, KNOB_RADIUS } from './knob-arc';

  interface Props {
    value: number;
    label: string;
    defaultValue?: number;
    /** Texte affiché sous le knob et lu par les lecteurs d'écran. */
    format?: (value: number) => string;
    /** Trace l'arc depuis le centre plutôt que depuis le minimum. */
    bipolar?: boolean;
    onchange: (value: number) => void;
  }

  const {
    value,
    label,
    defaultValue = 0,
    format = (v) => `${Math.round(v * 100)} %`,
    bipolar = false,
    onchange,
  }: Props = $props();

  const track = knobArcPath(0, 1);
  const arc = $derived(knobArcPath(bipolar ? 0.5 : 0, value));
  const angle = $derived(knobAngle(value));
  const text = $derived(format(value));
</script>

<div class="knob">
  <div
    class="dial"
    role="slider"
    tabindex="0"
    aria-label={label}
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={Math.round(value * 100)}
    aria-valuetext={text}
    use:knobDrag={{ getValue: () => value, onchange, ondefault: () => onchange(defaultValue) }}
  >
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <path class="track" d={track} />
      {#if arc}
        <path class="arc" d={arc} />
      {/if}
      <g transform="rotate({angle} {KNOB_CENTER} {KNOB_CENTER})">
        <line
          class="indicator"
          x1={KNOB_CENTER}
          y1={KNOB_CENTER - KNOB_RADIUS + 12}
          x2={KNOB_CENTER}
          y2={KNOB_CENTER - KNOB_RADIUS + 26}
        />
      </g>
    </svg>
  </div>
  <span class="label">{label}</span>
  <output class="value">{text}</output>
</div>

<style>
  .knob {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    width: var(--knob-size);
    user-select: none;
  }

  .dial {
    width: var(--knob-size);
    height: var(--knob-size);
    border-radius: var(--radius-round);
    cursor: ns-resize;
    outline: none;
  }

  .dial:focus-visible {
    box-shadow: var(--focus-ring);
  }

  svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  .track,
  .arc,
  .indicator {
    fill: none;
    stroke-linecap: round;
  }

  .track {
    stroke: var(--knob-track);
    stroke-width: var(--knob-stroke);
  }

  .arc {
    stroke: var(--knob-arc);
    stroke-width: var(--knob-stroke);
  }

  .indicator {
    stroke: var(--knob-indicator);
    stroke-width: var(--knob-indicator-stroke);
  }

  .label {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .value {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    font-variant-numeric: tabular-nums;
  }
</style>
