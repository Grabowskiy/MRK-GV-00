export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export interface RobotStatus {
  battery: number;
  rssi: number;
  temperature: number;
  uptime: number;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  source: 'SYSTEM' | 'ROBOT' | 'AI' | 'USER';
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
}

export interface MotorCommand {
  cmd: 'move';
  throttle: number; // -255 to 255 (Negative = Backward, Positive = Forward)
  steer: number;    // -255 to 255 (Negative = Left, Positive = Right)
}

export interface EmoteCommand {
  cmd: 'emote';
  id: number;
}

export interface ServoCommand {
  cmd: 'servo';
  target: 'skirt' | 'top' | 'head';
  state: 'open' | 'close';
}

export type RobotCommand = MotorCommand | EmoteCommand | ServoCommand;

export interface AppConfig {
  robotIp: string;       // IP of the ESP32 for WebSocket control
  robotPort: number;     // Port for WebSocket (default 81)
  cameraUrl: string;     // Full URL for the video stream
  cameraUser?: string;   // Basic Auth Username
  cameraPwd?: string;    // Basic Auth Password
}