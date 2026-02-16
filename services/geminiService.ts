import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from "@google/genai";
import { MotorCommand } from "../types";

// Define the tool that Gemini can use to control the robot
const moveRobotTool: FunctionDeclaration = {
  name: 'moveRobot',
  parameters: {
    type: Type.OBJECT,
    description: 'Control the movement of the robot. Use this when the user asks to move, drive, stop, or turn.',
    properties: {
      direction: {
        type: Type.STRING,
        description: 'Direction to move: forward, backward, left, right, stop',
        enum: ['forward', 'backward', 'left', 'right', 'stop']
      },
      speed: {
        type: Type.NUMBER,
        description: 'Speed of the motor from 0 to 255 (PWM value). Default to 200 if not specified. 0 is stop.',
      },
      duration: {
        type: Type.NUMBER,
        description: 'Duration in milliseconds to move. If 0 or unspecified, move continuously until stopped.',
      }
    },
    required: ['direction']
  }
};

interface LiveSessionConfig {
  apiKey: string;
  onAudioData: (base64: string) => void;
  onTranscript: (text: string, isUser: boolean) => void;
  onToolCall: (command: MotorCommand) => Promise<string>;
  onClose: () => void;
  onError: (error: any) => void;
}

export class GeminiLiveService {
  private sessionPromise: Promise<any> | null = null;
  private audioContext: AudioContext | null = null;
  private inputProcessor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private outputContext: AudioContext | null = null;
  private outputQueue: { buffer: AudioBuffer, time: number }[] = [];
  private nextStartTime = 0;

  constructor(private config: LiveSessionConfig) {
    this.outputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }

  async connect() {
    const ai = new GoogleGenAI({ apiKey: this.config.apiKey });
    
    // Initialize Audio Input
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    this.sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      config: {
        responseModalities: [Modality.AUDIO],
        tools: [{ functionDeclarations: [moveRobotTool] }],
        systemInstruction: `You are the AI interface for an ESP32-S3 Rover. 
        Your hardware includes a JGB37-555 DC motor and an OV2640 camera.
        You accept voice commands to control the rover.
        Keep responses brief, military-style, and cool. Examples: "Affirmative", "Engaging motors", "Scanning sector".
        If the user asks to move, use the moveRobot tool immediately.`,
      },
      callbacks: {
        onopen: () => {
            if (!this.audioContext) return;
            this.source = this.audioContext.createMediaStreamSource(stream);
            this.inputProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
            
            this.inputProcessor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = this.createPcmBlob(inputData);
                this.sessionPromise?.then(session => {
                    session.sendRealtimeInput({ media: pcmBlob });
                });
            };

            this.source.connect(this.inputProcessor);
            this.inputProcessor.connect(this.audioContext.destination);
        },
        onmessage: async (msg: LiveServerMessage) => {
            // Handle Tool Calls (Robot Commands)
            if (msg.toolCall) {
                for (const fc of msg.toolCall.functionCalls) {
                    if (fc.name === 'moveRobot') {
                        const dir = fc.args.direction as string;
                        const spd = (fc.args.speed as number) || 200;
                        
                        let throttle = 0;
                        let steer = 0;

                        switch(dir) {
                            case 'forward': throttle = spd; break;
                            case 'backward': throttle = -spd; break;
                            case 'left': steer = -spd; break; // Pivot left
                            case 'right': steer = spd; break; // Pivot right
                            case 'stop': throttle = 0; steer = 0; break;
                        }

                        const cmd: MotorCommand = {
                            cmd: 'move',
                            throttle,
                            steer
                        };
                        
                        // Execute on robot via callback
                        const result = await this.config.onToolCall(cmd);
                        
                        // Report back to Gemini
                        this.sessionPromise?.then(session => {
                            session.sendToolResponse({
                                functionResponses: {
                                    id: fc.id,
                                    name: fc.name,
                                    response: { result }
                                }
                            });
                        });
                    }
                }
            }

            // Handle Audio Output
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
                await this.playAudio(audioData);
            }

            // Handle Transcripts (Optional UI feedback)
            if (msg.serverContent?.modelTurn?.parts?.[0]?.text) {
                 this.config.onTranscript(msg.serverContent.modelTurn.parts[0].text, false);
            }
        },
        onclose: () => this.config.onClose(),
        onerror: (err) => this.config.onError(err)
      }
    });

    return this.sessionPromise;
  }

  async disconnect() {
    if (this.source) this.source.disconnect();
    if (this.inputProcessor) this.inputProcessor.disconnect();
    if (this.audioContext) await this.audioContext.close();
    // Cannot explicitly close session in current SDK, just cleaning up local resources
    this.config.onClose();
  }

  // Helper to convert float32 audio to PCM16 for Gemini
  private createPcmBlob(data: Float32Array) {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        // Clamp and convert
        const s = Math.max(-1, Math.min(1, data[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    const buffer = new Uint8Array(int16.buffer);
    let binary = '';
    const len = buffer.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(buffer[i]);
    }
    const base64 = btoa(binary);
    
    return {
        mimeType: 'audio/pcm;rate=16000',
        data: base64
    };
  }

  private async playAudio(base64: string) {
      if (!this.outputContext) return;
      
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const audioBuffer = await this.decodeAudioData(bytes, this.outputContext);
      
      const source = this.outputContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputContext.destination);
      
      const now = this.outputContext.currentTime;
      const startTime = Math.max(now, this.nextStartTime);
      
      source.start(startTime);
      this.nextStartTime = startTime + audioBuffer.duration;
  }

  private async decodeAudioData(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
      // Gemini sends 24kHz raw PCM 16-bit mono usually, but let's assume standard PCM handling
      // Note: The new Live API example uses manual float conversion.
      const dataInt16 = new Int16Array(data.buffer);
      const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) {
          channelData[i] = dataInt16[i] / 32768.0;
      }
      return buffer;
  }
}

// Scene Analysis Service using Flash-Image
export const analyzeScene = async (base64Image: string): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
        // Clean base64 header if present
        const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
                    { text: "Analyze this robot camera frame. Identify obstacles, terrain type, and any potential navigation hazards. Be concise." }
                ]
            }
        });
        return response.text || "No analysis available.";
    } catch (e) {
        console.error("Analysis failed", e);
        return "Analysis failed: " + (e as Error).message;
    }
};