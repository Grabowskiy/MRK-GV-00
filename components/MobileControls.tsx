
import React, { useState, useRef, useCallback } from 'react';
import { RobotCommand } from '../types';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Smile, Frown, Zap, Heart, MessageCircle, Moon, X, Lock, Unlock } from 'lucide-react';

interface Props {
    onCommand: (cmd: RobotCommand) => void;
    disabled: boolean;
}

interface ToggleState {
    head: boolean;
    top: boolean;
    skirt: boolean;
}

export const MobileControls: React.FC<Props> = ({ onCommand, disabled }) => {
    // Refs for network state (prevents unnecessary re-renders)
    const throttleRef = useRef(0);
    const steerRef = useRef(0);
    const lastCmdTime = useRef(0);

    // Emote/Toggle State
    const [showEmotes, setShowEmotes] = useState(false);
    const [toggles, setToggles] = useState<ToggleState>({
        head: false,
        top: false,
        skirt: false
    });

    // Interaction Tracking
    const leftId = useRef<number | null>(null);
    const rightId = useRef<number | null>(null);
    const leftStart = useRef<{ x: number, y: number } | null>(null);
    const rightStart = useRef<{ x: number, y: number } | null>(null);

    // Visual Puck Positions (State for UI rendering)
    const [leftUI, setLeftUI] = useState(0); 
    const [leftActive, setLeftActive] = useState(false);
    const [rightUI, setRightUI] = useState(0); 
    const [rightActive, setRightActive] = useState(false);

    // Unified Command Dispatch
    const dispatch = useCallback((force = false) => {
        if (disabled) return;
        
        const now = Date.now();
        const cmd: RobotCommand = {
            cmd: 'move',
            throttle: throttleRef.current,
            steer: steerRef.current
        };

        // Send if forced (stops) or at ~50Hz (20ms)
        if (force || (now - lastCmdTime.current > 20) || (cmd.throttle === 0 && cmd.steer === 0)) {
            onCommand(cmd);
            lastCmdTime.current = now;
        }
    }, [disabled, onCommand]);

    // --- LEFT STICK: THROTTLE (Vertical) ---
    const onLeftStart = (e: React.TouchEvent) => {
        if (disabled || leftId.current !== null) return;
        e.preventDefault(); // Stop browser scrolling
        
        const touch = e.changedTouches[0];
        leftId.current = touch.identifier;
        leftStart.current = { x: touch.clientX, y: touch.clientY };
        setLeftActive(true);
    };

    const onLeftMove = (e: React.TouchEvent) => {
        if (leftId.current === null || !leftStart.current) return;
        e.preventDefault();

        // Find our specific finger
        let touch: React.Touch | undefined;
        for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === leftId.current) {
                touch = e.touches[i];
                break;
            }
        }
        if (!touch) return;

        const deltaY = leftStart.current.y - touch.clientY; // Up is positive
        const maxPixels = 100;
        
        // Clamp UI Position
        const clamped = Math.max(-maxPixels, Math.min(maxPixels, deltaY));
        setLeftUI(clamped);

        // Map to -255...255
        let val = Math.round((clamped / maxPixels) * 255);
        if (Math.abs(val) < 20) val = 0; // Deadzone

        throttleRef.current = val;
        dispatch();
    };

    const onLeftEnd = (e: React.TouchEvent) => {
        if (leftId.current === null) return;
        
        let found = false;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === leftId.current) {
                found = true;
                break;
            }
        }

        if (found) {
            leftId.current = null;
            leftStart.current = null;
            setLeftActive(false);
            setLeftUI(0);
            throttleRef.current = 0;
            dispatch(true); // Force stop command
        }
    };

    // --- RIGHT STICK: STEERING (Horizontal) ---
    const onRightStart = (e: React.TouchEvent) => {
        if (disabled || rightId.current !== null) return;
        e.preventDefault();
        
        const touch = e.changedTouches[0];
        rightId.current = touch.identifier;
        rightStart.current = { x: touch.clientX, y: touch.clientY };
        setRightActive(true);
    };

    const onRightMove = (e: React.TouchEvent) => {
        if (rightId.current === null || !rightStart.current) return;
        e.preventDefault();

        let touch: React.Touch | undefined;
        for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === rightId.current) {
                touch = e.touches[i];
                break;
            }
        }
        if (!touch) return;

        const deltaX = touch.clientX - rightStart.current.x; // Right is positive
        const maxPixels = 100;

        // Clamp UI Position
        const clamped = Math.max(-maxPixels, Math.min(maxPixels, deltaX));
        setRightUI(clamped);

        // Map to -255...255
        let val = Math.round((clamped / maxPixels) * 255);
        if (Math.abs(val) < 20) val = 0; // Deadzone

        steerRef.current = val;
        dispatch();
    };

    const onRightEnd = (e: React.TouchEvent) => {
        if (rightId.current === null) return;

        let found = false;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === rightId.current) {
                found = true;
                break;
            }
        }

        if (found) {
            rightId.current = null;
            rightStart.current = null;
            setRightActive(false);
            setRightUI(0);
            steerRef.current = 0;
            dispatch(true);
        }
    };

    const handleToggle = (target: keyof ToggleState) => {
        if (disabled) return;
        const newState = !toggles[target];
        if (target === 'head' && newState === true && !toggles.top) return;
        if (target === 'top' && newState === false && toggles.head) return;

        setToggles(prev => ({ ...prev, [target]: newState }));
        onCommand({ cmd: 'servo', target, state: newState ? 'open' : 'close' });
    };

    const zoneStyle = "pointer-events-auto bg-gray-900/40 rounded-[2rem] border-2 border-white/5 relative flex items-center justify-center select-none touch-none backdrop-blur-md shadow-2xl transition-colors duration-300";
    const activeZone = "border-cyan-500/30 bg-gray-800/60 shadow-cyan-500/10";

    return (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-end z-30 overflow-hidden no-select pb-8 px-8">
            
            {/* Emote Panel (Top Right) */}
            <div className="absolute top-11 right-6 pointer-events-auto">
                <div className={`flex flex-row-reverse items-center gap-3 p-2 transition-all rounded-full ${showEmotes ? 'bg-black/80 border border-white/10 shadow-2xl' : ''}`}>
                    <button 
                        onClick={() => setShowEmotes(!showEmotes)}
                        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${showEmotes ? 'bg-gray-700 text-white' : 'bg-gray-800/90 text-yellow-400 border border-white/20 shadow-lg'}`}
                    >
                        {showEmotes ? <X size={24} /> : <Smile size={32} />}
                    </button>
                    {showEmotes && (
                        <div className="flex flex-row-reverse gap-3 pr-2">
                             {[1,2,3,4,5,6].map(id => (
                                <button key={id} onClick={() => onCommand({cmd:'emote', id})} className="w-11 h-11 rounded-full bg-gray-800 border border-white/10 flex items-center justify-center hover:bg-gray-700 active:scale-90 transition shadow-md">
                                    {id === 1 && <Smile size={20} className="text-yellow-400" />}
                                    {id === 2 && <Frown size={20} className="text-blue-400" />}
                                    {id === 3 && <Zap size={20} className="text-orange-400" />}
                                    {id === 4 && <Heart size={20} className="text-pink-400" />}
                                    {id === 5 && <MessageCircle size={20} className="text-red-400" />}
                                    {id === 6 && <Moon size={20} className="text-purple-400" />}
                                </button>
                             ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Interface Overlay */}
            <div className="flex justify-between items-end w-full max-w-screen-2xl mx-auto">
                
                {/* THROTTLE: LEFT STICK */}
                <div 
                    className={`${zoneStyle} w-36 h-72 ${leftActive ? activeZone : ''}`}
                    onTouchStart={onLeftStart}
                    onTouchMove={onLeftMove}
                    onTouchEnd={onLeftEnd}
                    onTouchCancel={onLeftEnd}
                >
                    {/* Track Indicator */}
                    <div className="absolute h-[160px] w-1.5 bg-white/5 rounded-full" />
                    
                    {/* Visual Puck */}
                    <div 
                        className={`absolute w-20 h-20 rounded-full border-4 flex items-center justify-center shadow-2xl transition-transform duration-75 ${
                            leftActive ? 'bg-cyan-500/40 border-cyan-400 scale-110' : 'bg-gray-800 border-white/10 opacity-60'
                        }`}
                        style={{ transform: `translate3d(0, ${-leftUI}px, 0)` }}
                    >
                        {leftActive && (
                            <div className="flex flex-col items-center">
                                {leftUI > 20 && <ChevronUp className="text-white animate-bounce" size={20} />}
                                {leftUI < -20 && <ChevronDown className="text-white animate-bounce" size={20} />}
                            </div>
                        )}
                    </div>
                    {!leftActive && <span className="absolute bottom-6 text-white/20 text-[10px] font-black tracking-widest uppercase font-mono">POWER</span>}
                </div>

                {/* STEERING & TOGGLES: RIGHT SIDE */}
                <div className="flex flex-col items-center gap-6">
                    
                    {/* Servo Controls Group */}
                    <div className="grid grid-cols-1 gap-2 w-36 pointer-events-auto">
                         {['head', 'top', 'skirt'].map((t) => {
                             const target = t as keyof ToggleState;
                             const active = toggles[target];
                             const locked = (target === 'head' && !active && !toggles.top) || (target === 'top' && active && toggles.head);
                             
                             return (
                                <button 
                                    key={target}
                                    onClick={() => handleToggle(target)}
                                    className={`flex items-center justify-between px-4 py-2.5 rounded-2xl border-2 text-[10px] font-black transition-all ${
                                        active ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-400' : 'bg-gray-900/60 border-white/5 text-gray-500'
                                    } ${locked ? 'opacity-20 cursor-not-allowed' : 'active:scale-95 shadow-xl'}`}
                                >
                                    <span className="tracking-widest uppercase font-mono">{target}</span>
                                    {active ? <Unlock size={14} /> : <Lock size={14} />}
                                </button>
                             );
                         })}
                    </div>

                    {/* STEER: RIGHT STICK */}
                    <div 
                        className={`${zoneStyle} w-72 h-36 ${rightActive ? activeZone : ''}`}
                        onTouchStart={onRightStart}
                        onTouchMove={onRightMove}
                        onTouchEnd={onRightEnd}
                        onTouchCancel={onRightEnd}
                    >
                        <div className="absolute w-[160px] h-1.5 bg-white/5 rounded-full" />
                        
                        <div 
                            className={`absolute w-20 h-20 rounded-full border-4 flex items-center justify-center shadow-2xl transition-transform duration-75 ${
                                rightActive ? 'bg-purple-500/40 border-purple-400 scale-110' : 'bg-gray-800 border-white/10 opacity-60'
                            }`}
                            style={{ transform: `translate3d(${rightUI}px, 0, 0)` }}
                        >
                            {rightActive && (
                                <div className="flex items-center">
                                    {rightUI < -20 && <ChevronLeft className="text-white animate-pulse" size={20} />}
                                    {rightUI > 20 && <ChevronRight className="text-white animate-pulse" size={20} />}
                                </div>
                            )}
                        </div>
                        {!rightActive && <span className="absolute bottom-4 text-white/20 text-[10px] font-black tracking-widest uppercase font-mono">STEER</span>}
                    </div>
                </div>
            </div>
        </div>
    );
};
