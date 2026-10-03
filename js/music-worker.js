// Renders the music loop off the main thread, so generating a new track never stutters the game.
import { renderMusic } from './synth.js';

self.onmessage = (e) => {
  const { seed } = e.data;
  const { samples, bpm } = renderMusic(seed);
  self.postMessage({ seed, samples, bpm }, [samples.buffer]);
};
