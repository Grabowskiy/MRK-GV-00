import React, { useCallback, useEffect, useState, useRef } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, StopCircle, Smile, Frown, Zap, Heart, MessageCircle, Moon } from 'lucide-react';
import { RobotCommand } from '../types';

interface Props {
    onCommand: (cmd: RobotCommand) => void;
    disabled: boolean;
}

export const Controls: React.FC<Props> = ({ onCommand, disabled }) => {
    const [speed, setSpeed] = useState(200);
    const activeKeys = useRef<Set<string>>(new Set());

    // Compute and send command based on active inputs
    const processInput = useCallback(() => {
        if (disabled) return;

        let throttle = 0;
        let steer = 0;

        // Check keys
        const keys = activeKeys.current;
        if (keys.has('w') || keys.has('arrowup')) throttle += speed;
        if (keys.has('s') || keys.has('arrowdown')) throttle -= speed;
        if (keys.has('d') || keys.has('arrowright')) steer += speed;
        if (keys.has('a') || keys.has('arrowleft')) steer -= speed;

        // Clamp
        throttle = Math.max(-255, Math.min(255, throttle));
        steer = Math.max(-255, Math.min(255, steer));

        onCommand({
            cmd: 'move',
            throttle,
            steer
        });
    }, [disabled, onCommand, speed]);

    // Handle button clicks (simulating keys for consistency)
    const handleBtn = (key: string, pressed: boolean) => {
        if (pressed) activeKeys.current.add(key);
        else activeKeys.current.delete(key);
        processInput();
    };

    const stopAll = () => {
        activeKeys.current.clear();
        processInput();
    };

    const sendEmote = (id: number) => {
        if (disabled) return;
        onCommand({ cmd: 'emote', id });
    };

    // Keyboard support
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (disabled || e.repeat) return;
            const key = e.key.toLowerCase();
            if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
                if (key === ' ') {
                    stopAll();
                } else {
                    activeKeys.current.add(key);
                    processInput();
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (disabled) return;
            const key = e.key.toLowerCase();
            if (activeKeys.current.has(key)) {
                activeKeys.current.delete(key);
                processInput();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [disabled, processInput]);

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 shadow-lg flex flex-col items-center">
            <h3 className="text-gray-400 text-sm font-bold mb-4 uppercase tracking-wider">Manual Override</h3>
            
            {/* Movement Grid */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                <div />
                <button 
                    onMouseDown={() => handleBtn('w', true)}
                    onMouseUp={() => handleBtn('w', false)}
                    onMouseLeave={() => handleBtn('w', false)}
                    onTouchStart={() => handleBtn('w', true)}
                    onTouchEnd={() => handleBtn('w', false)}
                    className="p-4 bg-gray-800 hover:bg-cyan-600 active:bg-cyan-500 rounded-lg transition-colors border border-gray-700 hover:border-cyan-400 group"
                >
                    <ArrowUp className="text-gray-400 group-hover:text-white" size={32} />
                </button>
                <div />
                
                <button 
                    onMouseDown={() => handleBtn('a', true)}
                    onMouseUp={() => handleBtn('a', false)}
                    onMouseLeave={() => handleBtn('a', false)}
                    onTouchStart={() => handleBtn('a', true)}
                    onTouchEnd={() => handleBtn('a', false)}
                    className="p-4 bg-gray-800 hover:bg-cyan-600 active:bg-cyan-500 rounded-lg transition-colors border border-gray-700 hover:border-cyan-400 group"
                >
                    <ArrowLeft className="text-gray-400 group-hover:text-white" size={32} />
                </button>
                
                <button 
                    onClick={stopAll}
                    className="p-4 bg-red-900/50 hover:bg-red-600 active:bg-red-500 rounded-lg transition-colors border border-red-800 group"
                >
                    <StopCircle className="text-red-400 group-hover:text-white" size={32} />
                </button>

                <button 
                    onMouseDown={() => handleBtn('d', true)}
                    onMouseUp={() => handleBtn('d', false)}
                    onMouseLeave={() => handleBtn('d', false)}
                    onTouchStart={() => handleBtn('d', true)}
                    onTouchEnd={() => handleBtn('d', false)}
                    className="p-4 bg-gray-800 hover:bg-cyan-600 active:bg-cyan-500 rounded-lg transition-colors border border-gray-700 hover:border-cyan-400 group"
                >
                    <ArrowRight className="text-gray-400 group-hover:text-white" size={32} />
                </button>

                <div />
                <button 
                    onMouseDown={() => handleBtn('s', true)}
                    onMouseUp={() => handleBtn('s', false)}
                    onMouseLeave={() => handleBtn('s', false)}
                    onTouchStart={() => handleBtn('s', true)}
                    onTouchEnd={() => handleBtn('s', false)}
                    className="p-4 bg-gray-800 hover:bg-cyan-600 active:bg-cyan-500 rounded-lg transition-colors border border-gray-700 hover:border-cyan-400 group"
                >
                    <ArrowDown className="text-gray-400 group-hover:text-white" size={32} />
                </button>
                <div />
            </div>

            {/* Speed Control */}
            <div className="w-full px-4 mb-6">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>SPEED LIMIT</span>
                    <span>{Math.round((speed / 255) * 100)}%</span>
                </div>
                <input 
                    type="range" 
                    min="0" 
                    max="255" 
                    value={speed} 
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
            </div>

            {/* Emotes */}
            <div className="w-full border-t border-gray-800 pt-4">
                <span className="text-xs text-gray-500 font-bold mb-3 block text-center uppercase">Head Emotes</span>
                <div className="grid grid-cols-6 gap-2">
                    <button onClick={() => sendEmote(1)} className="aspect-square bg-gray-800 hover:bg-yellow-900/50 rounded flex items-center justify-center text-yellow-500 transition-colors" title="Happy"><Smile size={20}/></button>
                    <button onClick={() => sendEmote(2)} className="aspect-square bg-gray-800 hover:bg-blue-900/50 rounded flex items-center justify-center text-blue-500 transition-colors" title="Sad"><Frown size={20}/></button>
                    <button onClick={() => sendEmote(3)} className="aspect-square bg-gray-800 hover:bg-orange-900/50 rounded flex items-center justify-center text-orange-500 transition-colors" title="Action"><Zap size={20}/></button>
                    <button onClick={() => sendEmote(4)} className="aspect-square bg-gray-800 hover:bg-pink-900/50 rounded flex items-center justify-center text-pink-500 transition-colors" title="Love"><Heart size={20}/></button>
                    <button onClick={() => sendEmote(5)} className="aspect-square bg-gray-800 hover:bg-red-900/50 rounded flex items-center justify-center text-red-500 transition-colors" title="Alert"><MessageCircle size={20}/></button>
                    <button onClick={() => sendEmote(6)} className="aspect-square bg-gray-800 hover:bg-purple-900/50 rounded flex items-center justify-center text-purple-500 transition-colors" title="Sleep"><Moon size={20}/></button>
                </div>
            </div>
        </div>
    );
};