import React, { useState } from 'react';
import { AppConfig, ConnectionState } from '../types';
import { Wifi, Save, Video, Cpu } from 'lucide-react';

interface Props {
    config: AppConfig;
    setConfig: (config: AppConfig) => void;
    connectionState: ConnectionState;
    onConnect: () => void;
    onDisconnect: () => void;
}

export const ConnectionPanel: React.FC<Props> = ({ config, setConfig, connectionState, onConnect, onDisconnect }) => {
    const [robotIp, setRobotIp] = useState(config.robotIp);
    const [cameraUrl, setCameraUrl] = useState(config.cameraUrl);

    const handleSave = () => {
        setConfig({
            ...config,
            robotIp: robotIp,
            cameraUrl: cameraUrl
        });
    };

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 shadow-lg">
            <h3 className="text-cyan-400 font-bold mb-3 flex items-center gap-2">
                <Wifi size={18} /> Mission Configuration
            </h3>
            
            <div className="space-y-4">
                {/* Robot Control Link */}
                <div>
                    <label className="text-xs text-gray-500 uppercase font-semibold flex items-center gap-1">
                        <Cpu size={12} /> ESP32 Control IP
                    </label>
                    <div className="flex gap-2 mt-1">
                        <input 
                            type="text" 
                            value={robotIp}
                            onChange={(e) => setRobotIp(e.target.value)}
                            placeholder="192.168.4.1"
                            className="bg-gray-800 text-white px-3 py-2 rounded text-sm flex-1 border border-gray-700 focus:border-cyan-500 focus:outline-none font-mono"
                        />
                    </div>
                </div>

                {/* Video Feed Link */}
                <div>
                    <label className="text-xs text-gray-500 uppercase font-semibold flex items-center gap-1">
                        <Video size={12} /> Camera Stream URL
                    </label>
                    <div className="flex gap-2 mt-1">
                        <input 
                            type="text" 
                            value={cameraUrl}
                            onChange={(e) => setCameraUrl(e.target.value)}
                            placeholder="http://192.168.1.50:8080/video"
                            className="bg-gray-800 text-white px-3 py-2 rounded text-sm flex-1 border border-gray-700 focus:border-cyan-500 focus:outline-none font-mono"
                        />
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1">
                        Tip: For IP Webcam apps, ensure you append <code>/video</code> to the URL.
                    </p>
                </div>

                <button 
                    onClick={handleSave}
                    className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 py-1 rounded border border-gray-700 text-xs mb-2"
                >
                    <Save size={14} className="inline mr-1" /> Save Settings
                </button>

                <div className="flex justify-between items-center bg-gray-950 p-2 rounded border border-gray-800">
                   <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                            connectionState === ConnectionState.CONNECTED ? 'bg-green-500 animate-pulse' : 
                            connectionState === ConnectionState.CONNECTING ? 'bg-yellow-500 animate-pulse' : 
                            'bg-red-500'
                        }`} />
                        <span className="text-xs font-mono text-gray-400">{connectionState}</span>
                   </div>
                   
                   {connectionState === ConnectionState.CONNECTED ? (
                       <button 
                         onClick={onDisconnect}
                         className="text-xs bg-red-900/30 text-red-400 px-3 py-1 rounded border border-red-900 hover:bg-red-900/50 transition"
                       >
                         DISCONNECT
                       </button>
                   ) : (
                       <button 
                         onClick={onConnect}
                         className="text-xs bg-cyan-900/30 text-cyan-400 px-3 py-1 rounded border border-cyan-900 hover:bg-cyan-900/50 transition flex items-center gap-1"
                       >
                         {connectionState === ConnectionState.CONNECTING ? 'CONNECTING...' : 'CONNECT ROBOT'}
                       </button>
                   )}
                </div>
            </div>
        </div>
    );
};