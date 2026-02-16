import React from 'react';
import { RobotStatus } from '../types';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { Battery, Signal } from 'lucide-react';

interface Props {
    history: { time: string, battery: number, rssi: number }[];
    current: RobotStatus;
}

export const Telemetry: React.FC<Props> = ({ history, current }) => {
    return (
        <div className="grid grid-cols-2 gap-4">
            {/* Battery Module */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-xs font-bold uppercase flex items-center gap-2">
                        <Battery size={14} className={current.battery < 20 ? "text-red-500" : "text-green-500"} />
                        Battery
                    </span>
                    <span className="text-xl font-mono">{current.battery}%</span>
                </div>
                {/* min-w-0 is crucial for Recharts inside Flex/Grid to calculate width correctly */}
                <div className="h-24 w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={history}>
                            <defs>
                                <linearGradient id="colorBatt" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <Area 
                                type="monotone" 
                                dataKey="battery" 
                                stroke="#10b981" 
                                fillOpacity={1} 
                                fill="url(#colorBatt)" 
                                strokeWidth={2} 
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Signal Module */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-xs font-bold uppercase flex items-center gap-2">
                        <Signal size={14} className="text-cyan-500" />
                        RSSI
                    </span>
                    <span className="text-xl font-mono">{current.rssi} dBm</span>
                </div>
                <div className="h-24 w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={history}>
                            <defs>
                                <linearGradient id="colorRssi" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <Area 
                                type="monotone" 
                                dataKey="rssi" 
                                stroke="#06b6d4" 
                                fillOpacity={1} 
                                fill="url(#colorRssi)" 
                                strokeWidth={2} 
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};