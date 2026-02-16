
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
    // Refs hold the AUTHORITATIVE state for network transmission
    const throttleRef = useRef(0); // -255 to 255
    const steerRef = useRef(0);    // -255 to 255
    const lastCmdTime = useRef(0);

    // Emote State
    const [showEmotes, setShowEmotes] = useState(false);

    // Toggle State
    const [toggles, setToggles] = useState<ToggleState>({
        head: false,
        top: false,
        skirt: false
    });

    // Touch Tracking Refs
    const leftTouchId = useRef<number | null>(null);
    const rightTouchId = useRef<number | null>(null);
    const leftOrigin = useRef<number | null>(null);
    const rightOrigin = useRef<number | null>(null);

    // UI Visual State (pixels)
    const [leftUI, setLeftUI] = useState(0); 
    const [leftActive, setLeftActive] = useState(false);
    const [rightUI, setRightUI] = useState(0); 
    const [rightActive, setRightActive] = useState(false);

    // Sends the combined state of both sticks
    const sendCombinedCommand = useCallback((force = false) => {
        if (disabled) return;
        
        const now = Date.now();
        const cmd: RobotCommand = {
            cmd: 'move',
            throttle: throttleRef.current,
            steer: steerRef.current
        };

        // Rate limit outgoing WebSocket packets to prevent congestion
        if (force || now - lastCmdTime.current > 20 || (cmd.throttle === 0 && cmd.steer === 0)) {
            onCommand(cmd);
            lastCmdTime.current = now;
        }
    }, [disabled, onCommand]);

    const sendEmote = (id: number) => {
        if (disabled) return;
        onCommand({ cmd: 'emote', id });
    };

    const handleToggle = (target: keyof ToggleState) => {
        if (disabled) return;
        const newState = !toggles[target];

        // Hardware Constraints
        if (target === 'head' && newState === true && !toggles.top) return;
        if (target === 'top' && newState === false && toggles.head) return;

        setToggles(prev => ({ ...prev, [target]: newState }));
        onCommand({
            cmd: 'servo',
            target: target,
            state: newState ? 'open' : 'close'
        });
    };

    // --- LEFT STICK: THROTTLE (Vertical) ---
    const handleLeftStart = (e: React.TouchEvent) => {
        if (disabled || leftTouchId.current !== null) return;
        const touch = e.changedTouches[0];
        if (!touch) return;

        leftTouchId.current = touch.identifier;
        leftOrigin.current = touch.clientY;
        setLeftActive(true);
    };

    const handleLeftMove = (e: React.TouchEvent) => {
        if (leftTouchId.current === null) return;

        // Find our specific finger in the list of all active touches
        let touch: React.Touch | undefined;
        for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === leftTouchId.current) {
                touch = e.touches[i];
                break;
            }
        }
        if (!touch) return;

        const delta = leftOrigin.current! - touch.clientY; // Up is positive
        const maxRange = 100; // Pixels
        
        const uiVal = Math.max(-maxRange, Math.min(maxRange, delta));
        setLeftUI(uiVal);

        // Map to -255...255
        let val = Math.round((uiVal / maxRange) * 255);
        if (Math.abs(val) < 15) val = 0; // Deadzone

        throttleRef.current = val;
        sendCombinedCommand();
    };

    const handleLeftEnd = (e: React.TouchEvent) => {
        if (leftTouchId.current === null) return;
        
        // Check if the finger that lifted is the one we were tracking
        let isOurFinger = false;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === leftTouchId.current) {
                isOurFinger = true;
                break;
            }
        }

        if (isOurFinger) {
            leftTouchId.current = null;
            leftOrigin.current = null;
            setLeftActive(false);
            setLeftUI(0);
            throttleRef.current = 0;
            sendCombinedCommand(true);
        }
    };

    // --- RIGHT STICK: STEERING (Horizontal) ---
    const handleRightStart = (e: React.TouchEvent) => {
        if (disabled || rightTouchId.current !== null) return;
        const touch = e.changedTouches[0];
        if (!touch) return;

        rightTouchId.current = touch.identifier;
        rightOrigin.current = touch.clientX;
        setRightActive(true);
    };

    const handleRightMove = (e: React.TouchEvent) => {
        if (rightTouchId.current === null) return;

        let touch: React.Touch | undefined;
        for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === rightTouchId.current) {
                touch = e.touches[i];
                break;
            }
        }
        if (!touch) return;

        const delta = touch.clientX - rightOrigin.current!; // Right is positive
        const maxRange = 100; // Pixels
        
        const uiVal = Math.max(-maxRange, Math.min(maxRange, delta));
        setRightUI(uiVal);

        // Map to -255...255
        let val = Math.round((uiVal / maxRange) * 255);
        if (Math.abs(val) < 15) val = 0; // Deadzone

        steerRef.current = val;
        sendCombinedCommand();
    };

    const handleRightEnd = (e: React.TouchEvent) => {
        if (rightTouchId.current === null) return;

        let isOurFinger = false;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === rightTouchId.current) {
                isOurFinger = true;
                break;
            }
        }

        if (isOurFinger) {
            rightTouchId.current = null;
            rightOrigin.current = null;
            setRightActive(false);
            setRightUI(0);
            steerRef.current = 0;
            sendCombinedCommand(true);
        }
    };

    const zoneBase = "pointer-events-auto bg-gray-800/40 rounded-3xl border border-gray-700/50 relative flex items-center justify-center transition-colors duration-200 select-none touch-none overflow-hidden backdrop-blur-sm";
    const activeZone = "bg-gray-700/60 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.1)]";

    return (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-end z-30 overflow-hidden no-select">
            
            {/* Top Right Emote Menu */}
            <div className="absolute top-11 right-4 pointer-events-auto z-50">
                <div className={`flex flex-row-reverse items-center gap-2 transition-all duration-300 ${showEmotes ? 'bg-black/80 backdrop-blur-xl rounded-full p-2 border border-white/10 shadow-2xl' : ''}`}>
                    <button 
                        onClick={() => setShowEmotes(!showEmotes)}
                        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${showEmotes ? 'bg-gray-700 text-white' : 'bg-gray-800/90 text-yellow-400 border border-white/20'}`}
                    >
                        {showEmotes ? <X size={24} /> : <Smile size={32} />}
                    </button>

                    {showEmotes && (
                        <div className="flex flex-row-reverse gap-3 mr-2 animate-in slide-in-from-right-4 fade-in duration-200">
                             <div className="w-[1px] h-8 bg-white/10 mx-1 self-center" />
                             <button onClick={() => sendEmote(1)} className="w-12 h-12 rounded-full bg-yellow-900/40 text-yellow-400 flex items-center justify-center border border-yellow-500/30 active:scale-90 transition"><Smile size={24}/></button>
                             <button onClick={() => sendEmote(2)} className="w-12 h-12 rounded-full bg-blue-900/40 text-blue-400 flex items-center justify-center border border-blue-500/30 active:scale-90 transition"><Frown size={24}/></button>
                             <button onClick={() => sendEmote(3)} className="w-12 h-12 rounded-full bg-orange-900/40 text-orange-400 flex items-center justify-center border border-orange-500/30 active:scale-90 transition"><Zap size={24}/></button>
                             <button onClick={() => sendEmote(4)} className="w-12 h-12 rounded-full bg-pink-900/40 text-pink-400 flex items-center justify-center border border-pink-500/30 active:scale-90 transition"><Heart size={24}/></button>
                             <button onClick={() => sendEmote(5)} className="w-12 h-12 rounded-full bg-red-900/40 text-red-400 flex items-center justify-center border border-red-500/30 active:scale-90 transition"><MessageCircle size={24}/></button>
                             <button onClick={() => sendEmote(6)} className="w-12 h-12 rounded-full bg-purple-900/40 text-purple-400 flex items-center justify-center border border-purple-500/30 active:scale-90 transition"><Moon size={24}/></button>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Controls Overlay */}
            <div className="flex justify-between px-8 pb-8 items-end w-full max-w-screen-2xl mx-auto">
                
                {/* THROTTLE (Left) */}
                <div 
                    className={`${zoneBase} w-32 h-64 ${leftActive ? activeZone : ''}`}
                    onTouchStart={handleLeftStart}
                    onTouchMove={handleLeftMove}
                    onTouchEnd={handleLeftEnd}
                    onTouchCancel={handleLeftEnd}
                >
                    <div className="absolute h-40 w-1 bg-white/5 rounded-full" />
                    <div 
                        className={`absolute w-16 h-16 rounded-full border-2 flex items-center justify-center transition-transform duration-75 shadow-lg ${
                            leftActive ? 'bg-cyan-500/30 border-cyan-400 scale-110' : 'bg-gray-800/50 border-white/10 opacity-40'
                        }`}
                        style={{ transform: `translateY(${-leftUI}px)` }}
                    >
                        {leftUI > 15 && <ChevronUp className="text-cyan-200" size={24} />}
                        {leftUI < -15 && <ChevronDown className="text-cyan-200" size={24} />}
                    </div>
                    {!leftActive && <div className="absolute bottom-4 text-white/20 text-[9px] font-bold tracking-widest uppercase">Throttle</div>}
                </div>

                {/* STEERING & SERVO PANEL (Right) */}
                <div className="flex flex-col items-center gap-4">
                    
                    {/* Compact Servo Toggles */}
                    <div className="grid grid-cols-1 gap-1.5 pointer-events-auto w-32">
                         {['head', 'top', 'skirt'].map((t) => {
                             const target = t as keyof ToggleState;
                             const isActive = toggles[target];
                             const isLocked = (target === 'head' && !isActive && !toggles.top) || (target === 'top' && isActive && toggles.head);
                             
                             return (
                                <button 
                                    key={target}
                                    onClick={() => handleToggle(target)}
                                    className={`flex items-center justify-between px-3 py-2 rounded-xl border text-[10px] font-bold transition-all backdrop-blur-md ${
                                        isActive ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300' : 'bg-gray-800/60 border-gray-700 text-gray-500'
                                    } ${isLocked ? 'opacity-30' : 'active:scale-95'}`}
                                >
                                    <span className="tracking-tighter uppercase">{target}</span>
                                    {isActive ? <Unlock size={12} /> : <Lock size={12} />}
                                </button>
                             );
                         })}
                    </div>

                    {/* STEER (Right Stick) */}
                    <div 
                        className={`${zoneBase} w-64 h-32 ${rightActive ? activeZone : ''}`}
                        onTouchStart={handleRightStart}
                        onTouchMove={handleRightMove}
                        onTouchEnd={handleRightEnd}
                        onTouchCancel={handleRightEnd}
                    >
                        <div className="absolute w-40 h-1 bg-white/5 rounded-full" />
                        <div 
                            className={`absolute w-16 h-16 rounded-full border-2 flex items-center justify-center transition-transform duration-75 shadow-lg ${
                                rightActive ? 'bg-purple-500/30 border-purple-400 scale-110' : 'bg-gray-800/50 border-white/10 opacity-40'
                            }`}
                            style={{ transform: `translateX(${rightUI}px)` }}
                        >
                            {rightUI > 15 && <ChevronRight className="text-purple-200" size={24} />}
                            {rightUI < -15 && <ChevronLeft className="text-purple-200" size={24} />}
                        </div>
                        {!rightActive && <div className="absolute bottom-4 text-white/20 text-[9px] font-bold tracking-widest uppercase">Steer</div>}
                    </div>
                </div>
            </div>
        </div>
    );
};
