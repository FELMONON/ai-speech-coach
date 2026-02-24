export interface AudioChunkPayload {
  chunkBase64: string;
  sampleRate: number;
  channels: number;
  rms: number;
}

type ChunkHandler = (payload: AudioChunkPayload) => void;
type VoiceActivityHandler = (rms: number) => void;

function encodeBase64(buffer: ArrayBufferLike): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

function resampleTo16k(input: Float32Array, inputSampleRate: number): Int16Array {
  if (inputSampleRate === 16000) {
    const direct = new Int16Array(input.length);
    for (let i = 0; i < input.length; i += 1) {
      const value = Math.max(-1, Math.min(1, input[i]));
      direct[i] = value < 0 ? value * 0x8000 : value * 0x7fff;
    }
    return direct;
  }

  const ratio = inputSampleRate / 16000;
  const newLength = Math.max(1, Math.round(input.length / ratio));
  const result = new Int16Array(newLength);

  for (let i = 0; i < newLength; i += 1) {
    const index = Math.min(input.length - 1, Math.round(i * ratio));
    const value = Math.max(-1, Math.min(1, input[index]));
    result[i] = value < 0 ? value * 0x8000 : value * 0x7fff;
  }

  return result;
}

function computeRms(samples: Float32Array): number {
  if (samples.length === 0) {
    return 0;
  }

  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    sum += samples[i] * samples[i];
  }

  return Math.sqrt(sum / samples.length);
}

export class AudioCapture {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private stream: MediaStream | null = null;

  async start(stream: MediaStream, onChunk: ChunkHandler, onVoiceActivity?: VoiceActivityHandler) {
    this.stream = stream;
    this.audioContext = new AudioContext();
    this.sourceNode = this.audioContext.createMediaStreamSource(stream);
    this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processorNode.onaudioprocess = (event: AudioProcessingEvent) => {
      const data = event.inputBuffer.getChannelData(0);
      const rms = computeRms(data);
      onVoiceActivity?.(rms);

      const pcm16 = resampleTo16k(data, this.audioContext?.sampleRate ?? 48000);
      const base64 = encodeBase64(pcm16.buffer);

      onChunk({
        chunkBase64: base64,
        sampleRate: 16000,
        channels: 1,
        rms
      });
    };

    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.audioContext.destination);
  }

  async stop() {
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.stream = null;
  }
}
