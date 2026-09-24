/**
 * Commandes acceptées par le moteur. L'union grandit lot par lot, ce qui
 * garde le reducer exhaustif à chaque étape.
 */
import type {
  BassKnobId,
  BassWaveform,
  DrumVoiceId,
  MixParams,
  Normalized,
  SidechainParams,
  Step,
  StepIndex,
  Velocity,
} from './model/types';

export type StepFlag = 'accent' | 'slide' | 'rest';

export type Command =
  | { readonly type: 'transport/play' }
  | { readonly type: 'transport/stop' }
  | { readonly type: 'transport/setBpm'; readonly bpm: number }
  | { readonly type: 'transport/setShuffle'; readonly value: Normalized }
  | { readonly type: 'transport/setSidechain'; readonly patch: Partial<SidechainParams> }
  | { readonly type: 'pattern/setStep'; readonly index: StepIndex; readonly patch: Partial<Step> }
  | { readonly type: 'pattern/toggleStepFlag'; readonly index: StepIndex; readonly flag: StepFlag }
  | {
      readonly type: 'pattern/setDrumVelocity';
      readonly voice: DrumVoiceId;
      readonly index: StepIndex;
      readonly velocity: Velocity;
    }
  | { readonly type: 'bass/setWaveform'; readonly waveform: BassWaveform }
  | { readonly type: 'bass/setKnob'; readonly knob: BassKnobId; readonly value: Normalized }
  | { readonly type: 'drums/setMuted'; readonly voice: DrumVoiceId; readonly muted: boolean }
  | { readonly type: 'drums/setLevel'; readonly voice: DrumVoiceId; readonly value: Normalized }
  | { readonly type: 'mix/set'; readonly patch: Partial<MixParams> };
