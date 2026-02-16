import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Wifi, Cpu, AlertTriangle, ExternalLink, ShieldAlert, Network, Zap, Video, Settings, CloudLightning } from 'lucide-react';
import { VideoFeed } from './components/VideoFeed';
import { Controls } from './components/Controls';
import { MobileControls } from './components/MobileControls';
import { Terminal } from './components/Terminal';
import { AppConfig, ConnectionState, RobotCommand, LogEntry } from './types';

const DEFAULT_CONFIG: AppConfig = {
    robotIp: '192.168.4.1',
    robotPort: 8081,
    cameraUrl: 'http://10.219.22.3:8081/video', 
    cameraUser: '', 
    cameraPwd: ''
};

const STORAGE_KEY = 'rover_cmd_config_v2';
const IFRAME_MODE_KEY = 'rover_cmd_iframe_mode';

export default function App() {
    // Initialize config from LocalStorage
    const [config, setConfig] = useState<AppConfig>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
        } catch (e) {
            return DEFAULT_CONFIG;
        }
    });

    const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [showConfig, setShowConfig] = useState(true); 
    const wsRef = useRef<WebSocket | null>(null);
    const lastCmdRef = useRef<string>('');
    const [isLandscape, setIsLandscape] = useState(false);
    const [isHttps, setIsHttps] = useState(false);
    
    // Initialize iframe mode preference from LocalStorage
    const [useIframe, setUseIframe] = useState(() => {
        return localStorage.getItem(IFRAME_MODE_KEY) === 'true';
    });

    // Save Config on Change
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }, [config]);

    // Save Iframe Mode on Change
    useEffect(() => {
        localStorage.setItem(IFRAME_MODE_KEY, String(useIframe));
    }, [useIframe]);

    // Helper to add logs
    const addLog = useCallback((source: 'SYSTEM' | 'ROBOT' | 'AI' | 'USER', message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info') => {
        setLogs(prev => {
            const newEntry: LogEntry = {
                id: Math.random().toString(36).substr(2, 9),
                timestamp: new Date(),
                source,
                message,
                type
            };
            return [...prev.slice(-49), newEntry]; // Keep last 50
        });
    }, []);

    // Robust Orientation and Protocol Check
    useEffect(() => {
        // Use matchMedia for reliable orientation detection
        const mql = window.matchMedia("(orientation: landscape)");
        
        const handleOrientationChange = (e: MediaQueryListEvent | MediaQueryList) => {
            setIsLandscape(e.matches);
        };

        // Initial check
        handleOrientationChange(mql);

        // Listen for changes
        mql.addEventListener('change', handleOrientationChange);
        
        // Check if running on HTTPS
        if (window.location.protocol === 'https:') {
            setIsHttps(true);
            addLog('SYSTEM', 'WARNING: HTTPS Detected. Tunnels required for local devices.', 'warning');
        }

        return () => mql.removeEventListener('change', handleOrientationChange);
    }, [addLog]);

    // WebSocket Connection Logic
    const connectRobot = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;
        
        let input = config.robotIp.trim();
        let wsUrl = '';

        // --- SMART ROBOT URL PARSING ---
        if ((input.includes('ngrok') || input.includes('cloudflare')) && (input.startsWith('https://') || input.startsWith('http://'))) {
             addLog('SYSTEM', 'Auto-correcting Tunnel URL to WSS...', 'info');
             input = input.replace(/^https?:\/\//, 'wss://');
        }

        if (input.startsWith('wss://') || input.startsWith('ws://')) {
            wsUrl = input;
            if (!wsUrl.endsWith('/ws') && !wsUrl.endsWith('/')) {
                wsUrl = `${wsUrl}/ws`;
            }
        } else {
            wsUrl = `ws://${input}:${config.robotPort}/ws`;
        }

        addLog('SYSTEM', `Connecting to ${wsUrl}...`, 'info');
        setConnectionState(ConnectionState.CONNECTING);
        
        try {
            const ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
                addLog('SYSTEM', 'WebSocket Connected', 'success');
                setConnectionState(ConnectionState.CONNECTED);
                setShowConfig(false); 
            };
            
            ws.onerror = () => {
                if (window.location.protocol === 'https:' && !wsUrl.startsWith('wss://')) {
                     addLog('SYSTEM', 'BLOCKED: HTTPS app cannot connect to insecure WS. Use a Tunnel.', 'error');
                } else {
                     addLog('SYSTEM', 'Connection Error', 'error');
                }
                setConnectionState(ConnectionState.ERROR);
            };
            
            ws.onclose = (e) => {
                addLog('SYSTEM', `Closed (Code: ${e.code})`, 'warning');
                setConnectionState(ConnectionState.DISCONNECTED);
            };

            ws.onmessage = (e) => {
                addLog('ROBOT', `RX: ${e.data}`, 'info');
            };
            
            wsRef.current = ws;
        } catch (e: any) {
            let msg = `Failed: ${e.message || e}`;
            if (e.name === 'SecurityError') msg = "SECURITY ERROR: Mixed Content Blocked.";
            addLog('SYSTEM', msg, 'error');
            setConnectionState(ConnectionState.ERROR);
        }
    }, [config, addLog]);

    const disconnectRobot = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
            addLog('SYSTEM', 'Disconnected by user', 'info');
        }
        setConnectionState(ConnectionState.DISCONNECTED);
    }, [addLog]);

    // Command Logic
    const sendCommand = useCallback((cmd: RobotCommand) => {
        const cmdStr = JSON.stringify(cmd);
        
        // Don't deduplicate Emote commands, always send them
        if (cmd.cmd !== 'emote') {
             if (cmdStr === lastCmdRef.current) return;
             lastCmdRef.current = cmdStr;
        }

        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(cmdStr);
            addLog('USER', `TX: ${cmdStr}`, 'success');
        } else {
            addLog('USER', `TX (Offline): ${cmdStr}`, 'warning');
        }
    }, [addLog]);

    // Handle Camera URL Smart input
    const handleCameraUrlChange = (val: string) => {
        let newUrl = val;
        // If user is on HTTPS and pastes an HTTP tunnel link, auto-upgrade it
        if (isHttps && (val.includes('ngrok') || val.includes('trycloudflare')) && val.startsWith('http://')) {
            newUrl = val.replace('http://', 'https://');
        }
        setConfig(prev => ({ ...prev, cameraUrl: newUrl }));
    };

    // --- IMMERSIVE MOBILE LANDSCAPE MODE ---
    if (isLandscape && window.innerWidth < 1024) {
        return (
            <div className="fixed inset-0 bg-black overflow-hidden select-none touch-none">
                <VideoFeed 
                    config={config} 
                    fullscreen={true} 
                    useIframe={useIframe}
                    setUseIframe={setUseIframe}
                />
                <MobileControls onCommand={sendCommand} disabled={false} />
                <div className={`absolute top-4 right-4 w-3 h-3 rounded-full z-50 ${
                    connectionState === ConnectionState.CONNECTED ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 
                    'bg-red-500 shadow-[0_0_10px_#ef4444]'
                }`} />
            </div>
        );
    }

    // --- DESKTOP / PORTRAIT MODE ---
    return (
        <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center p-4 gap-6">
            
            {/* HTTPS Cloud Run Warning */}
            {isHttps && (
                <div className="w-full max-w-[640px] bg-cyan-900/10 border border-cyan-500/20 rounded-lg p-3 flex flex-col gap-2 text-cyan-100 text-xs font-mono mb-[-1rem] z-20 shadow-2xl backdrop-blur-md">
                    <div className="flex items-start gap-3">
                        <CloudLightning size={18} className="text-cyan-400 shrink-0 mt-0.5" />
                        <div className="flex flex-col">
                            <strong className="text-cyan-100 mb-1">Secure Cloud Environment Detected</strong>
                            <p className="opacity-70 leading-relaxed">
                                Browsers block insecure local connections (Mixed Content).<br/>
                                <span className="text-white font-bold">Recommended:</span> Use Cloudflare Tunnel for unlimited bandwidth.<br/>
                                <code className="bg-black/30 px-1 py-0.5 rounded text-cyan-300 mt-1 inline-block select-all">
                                    cloudflared tunnel --url http://10.219.22.3:8081
                                </code>
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Config Panel */}
            <div className="w-full max-w-[640px] bg-gray-900 rounded-xl border border-gray-800 shadow-lg flex flex-col z-10 overflow-hidden transition-all">
                {/* Header Bar */}
                <div className="p-4 flex items-center justify-between bg-gray-900/50">
                    <div className="flex items-center gap-3">
                        <div className="bg-cyan-900/30 p-2 rounded-lg">
                            <Cpu className="text-cyan-400" size={20} />
                        </div>
                        <div>
                            <h1 className="font-bold text-lg leading-none tracking-wider">ROVER<span className="text-cyan-500">CMD</span></h1>
                            <span className="text-[10px] text-gray-500 font-mono">MANUAL OVERRIDE</span>
                        </div>
                    </div>
                    <button 
                        onClick={() => setShowConfig(!showConfig)}
                        className={`p-2 rounded hover:bg-gray-800 transition ${showConfig ? 'text-cyan-400' : 'text-gray-500'}`}
                    >
                        <Settings size={20} />
                    </button>
                </div>

                {/* Expanded Config Inputs */}
                {showConfig && (
                    <div className="px-4 pb-4 flex flex-col gap-3 animate-in slide-in-from-top-2 duration-200">
                        {/* Robot Input */}
                        <div className="flex gap-2 items-center">
                            <div className="bg-gray-800 p-2 rounded text-gray-400">
                                <Network size={16} />
                            </div>
                            <input 
                                value={config.robotIp}
                                onChange={e => setConfig({...config, robotIp: e.target.value})}
                                className={`flex-1 bg-black border rounded px-3 py-2 text-sm font-mono outline-none transition-colors ${
                                    isHttps && !config.robotIp.includes('trycloudflare') && !config.robotIp.includes('ngrok') && !config.robotIp.includes('wss://') 
                                    ? 'border-cyan-800 text-cyan-200 placeholder-cyan-800' 
                                    : 'border-gray-700 focus:border-cyan-500'
                                }`}
                                placeholder={isHttps ? "Paste Tunnel URL (Robot)..." : "Robot IP (192.168.4.1)"}
                            />
                            <button 
                                onClick={connectionState === ConnectionState.CONNECTED ? disconnectRobot : connectRobot}
                                className={`px-4 py-2 rounded font-bold text-xs flex items-center gap-2 transition-all min-w-[100px] justify-center ${
                                    connectionState === ConnectionState.CONNECTED 
                                    ? 'bg-green-900/20 text-green-500 border border-green-900' 
                                    : connectionState === ConnectionState.CONNECTING 
                                        ? 'bg-yellow-900/20 text-yellow-500 border border-yellow-900 animate-pulse'
                                        : 'bg-cyan-900/20 text-cyan-500 border border-cyan-900 hover:bg-cyan-900/40'
                                }`}
                            >
                                <Wifi size={14} />
                                {connectionState === ConnectionState.CONNECTED ? 'LINKED' : 'LINK'}
                            </button>
                        </div>

                        {/* Camera Input */}
                        <div className="flex gap-2 items-center">
                            <div className="bg-gray-800 p-2 rounded text-gray-400">
                                <Video size={16} />
                            </div>
                            <input 
                                value={config.cameraUrl}
                                onChange={e => handleCameraUrlChange(e.target.value)}
                                className={`flex-1 bg-black border rounded px-3 py-2 text-sm font-mono outline-none transition-colors ${
                                    isHttps && config.cameraUrl.startsWith('http:') 
                                    ? 'border-red-900 text-red-200' 
                                    : 'border-gray-700 focus:border-cyan-500'
                                }`}
                                placeholder={isHttps ? "Paste Tunnel URL (Camera)..." : "Camera URL (http://...)"}
                            />
                             <div className="min-w-[100px] flex justify-center">
                                <span className="text-[10px] text-gray-600 font-mono">AUTO-UPDATE</span>
                             </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Main Interface */}
            <div className="w-full flex flex-col items-center gap-6 relative">
                
                <VideoFeed 
                    config={config} 
                    useIframe={useIframe}
                    setUseIframe={setUseIframe}
                />

                {/* Controls & Terminal */}
                <div className="w-full max-w-md flex flex-col gap-4">
                    <Controls onCommand={sendCommand} disabled={false} />
                    <Terminal logs={logs} />
                </div>
            </div>
        </div>
    );
}