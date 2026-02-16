import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface Props {
    logs: LogEntry[];
}

export const Terminal: React.FC<Props> = ({ logs }) => {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    return (
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-2 font-mono text-xs h-48 overflow-y-auto scrollbar-hide flex flex-col">
            {logs.map((log) => (
                <div key={log.id} className="mb-1 break-words">
                    <span className="text-gray-600 mr-2">[{log.timestamp.toLocaleTimeString()}]</span>
                    <span className={`font-bold mr-2 ${
                        log.source === 'ROBOT' ? 'text-yellow-500' :
                        log.source === 'AI' ? 'text-purple-500' :
                        log.source === 'SYSTEM' ? 'text-blue-500' : 'text-green-500'
                    }`}>{log.source}:</span>
                    <span className={
                        log.type === 'error' ? 'text-red-400' :
                        log.type === 'success' ? 'text-green-400' : 'text-gray-300'
                    }>{log.message}</span>
                </div>
            ))}
            <div ref={bottomRef} />
        </div>
    );
};