
import React, { useState, useRef, useCallback } from 'react';
import { RobotCommand, ServoCommand } from '../types';
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

    // Touch Identification
    const leftTouchId = useRef<number | null>(null);
    const rightTouchId = useRef<number | null>(null);

    // UI State for visual feedback (pixels)
    const [leftUI, setLeftUI] = useState(0); 
    const [leftActive, setLeftActive] = useState(false);
    const leftOrigin = useRef<number | null>(null);

    const [rightUI, setRightUI] = useState(0); 
    const [rightActive, setRightActive] = useState(false);
    const rightOrigin = useRef<number | null>(null);

    // Sends the combined state of both sticks
    const sendCombinedCommand = useCallback((force = false) => {
        if (disabled) return;
        
        const now = Date.now();
        const cmd: RobotCommand = {
            cmd: 'move',
            throttle: throttleRef.current,
            steer: steerRef.current
        };

        // Throttle network calls to ~16ms (60fps) unless forced (stop)
        if (force || now - lastCmdTime.current > 16 || (cmd.throttle === 0 && cmd.steer === 0)) {
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

        // Constraint 1: If top is closed, head cannot be opened
        if (target === 'head' && newState === true && !toggles.top) {
            return;
        }

        // Constraint 2: If head is open, top cannot be closed
        if (target === 'top' && newState === false && toggles.head) {
            return;
        }

        setToggles(prev => ({ ...prev, [target]: newState }));
        
        onCommand({
            cmd: 'servo',
            target: target,
            state: newState ? 'open' : 'close'
        });
    };

    // --- Left Stick (Throttle) Logic ---
    const handleLeftStart = (e: React.TouchEvent) => {
        if (disabled) return;
        
        // If we are already tracking a finger on this stick, ignore others
        if (leftTouchId.current !== null) return;

        const touch = e.changedTouches[0];
        if (!touch) return;

        leftTouchId.current = touch.identifier;
        leftOrigin.current = touch.clientY;
        setLeftActive(true);
    };

    const handleLeftMove = (e: React.TouchEvent) => {
        if (leftTouchId.current === null) return;

        // Find the specific touch we are tracking
        let touch: React.Touch | undefined;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === leftTouchId.current) {
                touch = e.changedTouches[i];
                break;
            }
        }
        if (!touch) return; // This movement event wasn't for our finger

        const currentY = touch.clientY;
        const delta = leftOrigin.current! - currentY; // Up is positive
        const maxDist = 120; // Pixel range
        
        // UI Value (-100 to 100)
        let uiVal = Math.max(-100, Math.min(100, (delta / maxDist) * 100));
        setLeftUI(uiVal);

        // Map to Protocol (-255 to 255)
        let throttleVal = Math.round((uiVal / 100) * 255);
        
        // Deadzone
        if (Math.abs(throttleVal) < 20) throttleVal = 0;

        throttleRef.current = throttleVal;
        sendCombinedCommand();
    };

    const handleLeftEnd = (e: React.TouchEvent) => {
        if (leftTouchId.current === null) return;

        // Check if the ending touch is ours
        let found = false;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === leftTouchId.current) {
                found = true;
                break;
            }
        }

        if (found) {
            setLeftActive(false);
            setLeftUI(0);
            leftOrigin.current = null;
            leftTouchId.current = null;
            throttleRef.current = 0;
            sendCombinedCommand(true); // Force send stop
        }
    };

    // --- Right Stick (Steering) Logic ---
    const handleRightStart = (e: React.TouchEvent) => {
        if (disabled) return;
        if (rightTouchId.current !== null) return;

        const touch = e.changedTouches[0];
        if (!touch) return;

        rightTouchId.current = touch.identifier;
        rightOrigin.current = touch.clientX;
        setRightActive(true);
    };

    const handleRightMove = (e: React.TouchEvent) => {
        if (rightTouchId.current === null) return;

        let touch: React.Touch | undefined;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === rightTouchId.current) {
                touch = e.changedTouches[i];
                break;
            }
        }
        if (!touch) return;

        const currentX = touch.clientX;
        const delta = currentX - rightOrigin.current!; // Right movement yields positive delta
        const maxDist = 100;

        // UI Value (-100 to 100)
        let uiVal = Math.max(-100, Math.min(100, (delta / maxDist) * 100));
        setRightUI(uiVal);

        // Map to Protocol (-255 to 255)
        let steerVal = Math.round((uiVal / 100) * 255);

        // Deadzone
        if (Math.abs(steerVal) < 20) steerVal = 0;

        steerRef.current = steerVal;
        sendCombinedCommand();
    };

    const handleRightEnd = (e: React.TouchEvent) => {
        if (rightTouchId.current === null) return;

        let found = false;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === rightTouchId.current) {
                found = true;
                break;
            }
        }

        if (found) {
            setRightActive(false);
            setRightUI(0);
            rightOrigin.current = null;
            rightTouchId.current = null;
            steerRef.current = 0;
            sendCombinedCommand(true); // Force send stop
        }
    };

    // Visual styles: touch-none added to strictly prevent browser scrolling/zooming
    const zoneBaseClass = "pointer-events-auto bg-gray-800/60 rounded-3xl border border-gray-600 relative flex items-center justify-center transition-all duration-200 select-none touch-none";
    const activeClass = "bg-gray-700/80 border-gray-400 shadow-lg";

    // Helper to determine if a toggle is effectively disabled based on constraints
    const isHeadDisabled = !toggles.top && !toggles.head; // Can't open if top closed
    const isTopDisabled = toggles.head && toggles.top;    // Can't close if head open

    return (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-end z-30">
            
            {/* Top Right Emote FAB - Moved down to top-11 */}
            <div className="absolute top-11 right-4 pointer-events-auto z-50">
                <div className={`flex flex-row-reverse items-center gap-2 transition-all duration-300 ${showEmotes ? 'bg-black/60 backdrop-blur-md rounded-full p-2 border border-white/10' : ''}`}>
                    
                    {/* Main Toggle Button */}
                    <button 
                        onClick={() => setShowEmotes(!showEmotes)}
                        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${showEmotes ? 'bg-gray-700 text-white' : 'bg-gray-800/80 text-yellow-400 border border-white/20'}`}
                    >
                        {showEmotes ? <X size={24} /> : <Smile size={32} />}
                    </button>

                    {/* Expanded Options - Reversing order so Button 1 is closest to thumb */}
                    {showEmotes && (
                        <div className="flex flex-row-reverse gap-3 mr-2 animate-in slide-in-from-right-4 fade-in duration-200">
                             <div className="w-[1px] h-8 bg-white/10 mx-1 self-center" />
                             <button onClick={() => sendEmote(1)} className="w-12 h-12 rounded-full bg-yellow-900/60 text-yellow-400 flex items-center justify-center border border-yellow-500/30 active:scale-95 transition"><Smile size={24}/></button>
                             <button onClick={() => sendEmote(2)} className="w-12 h-12 rounded-full bg-blue-900/60 text-blue-400 flex items-center justify-center border border-blue-500/30 active:scale-95 transition"><Frown size={24}/></button>
                             <button onClick={() => sendEmote(3)} className="w-12 h-12 rounded-full bg-orange-900/60 text-orange-400 flex items-center justify-center border border-orange-500/30 active:scale-95 transition"><Zap size={24}/></button>
                             <button onClick={() => sendEmote(4)} className="w-12 h-12 rounded-full bg-pink-900/60 text-pink-400 flex items-center justify-center border border-pink-500/30 active:scale-95 transition"><Heart size={24}/></button>
                             <button onClick={() => sendEmote(5)} className="w-12 h-12 rounded-full bg-red-900/60 text-red-400 flex items-center justify-center border border-red-500/30 active:scale-95 transition"><MessageCircle size={24}/></button>
                             <button onClick={() => sendEmote(6)} className="w-12 h-12 rounded-full bg-purple-900/60 text-purple-400 flex items-center justify-center border border-purple-500/30 active:scale-95 transition"><Moon size={24}/></button>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Controls Area - Padding increased to pb-4 */}
            <div className="flex justify-between px-6 pb-4 items-end w-full">
                {/* Left Thumb - Throttle */}
                <div 
                    className={`${zoneBaseClass} w-32 h-64 flex-col ${leftActive ? activeClass : ''}`}
                    onTouchStart={handleLeftStart}
                    onTouchMove={handleLeftMove}
                    onTouchEnd={handleLeftEnd}
                    onTouchCancel={handleLeftEnd}
                >
                    {/* Minimal Track Indicator */}
                    <div className="absolute h-40 w-[1px] bg-white/20 rounded-full" />
                    
                    {/* Thumb Puck */}
                    <div 
                        className={`absolute w-14 h-14 rounded-full border-2 border-cyan-400/50 flex items-center justify-center transition-transform duration-75 ${leftActive ? 'bg-cyan-500/20 scale-110' : 'opacity-30'}`}
                        style={{ transform: `translateY(${-leftUI}px)` }}
                    >
                        {leftUI > 10 && <ChevronUp className="text-cyan-200" size={20} />}
                        {leftUI < -10 && <ChevronDown className="text-cyan-200" size={20} />}
                    </div>
                    {!leftActive && <div className="absolute bottom-4 text-white/40 text-[10px] font-bold tracking-widest font-mono">THROTTLE</div>}
                </div>

                {/* Right Side Container: Toggles + Stick */}
                <div className="flex flex-col items-center gap-3">
                    
                    {/* Toggles Group */}
                    <div className="flex flex-col gap-1 pointer-events-auto w-full">
                         {/* Toggle: HEAD */}
                         <button 
                            onClick={() => handleToggle('head')}
                            className={`flex items-center justify-between px-3 py-1.5 rounded-lg border backdrop-blur-md transition-all ${toggles.head ? 'bg-cyan-900/60 border-cyan-500 text-cyan-200' : 'bg-gray-800/40 border-gray-700 text-gray-400'} ${isHeadDisabled && !toggles.head ? 'opacity-50' : ''}`}
                        >
                            <span className="text-[10px] font-bold tracking-wider mr-4">HEAD</span>
                            {toggles.head ? <Unlock size={14} /> : <Lock size={14} />}
                        </button>
                        
                        {/* Toggle: TOP */}
                        <button 
                            onClick={() => handleToggle('top')}
                            className={`flex items-center justify-between px-3 py-1.5 rounded-lg border backdrop-blur-md transition-all ${toggles.top ? 'bg-cyan-900/60 border-cyan-500 text-cyan-200' : 'bg-gray-800/40 border-gray-700 text-gray-400'} ${isTopDisabled && toggles.top ? 'opacity-50' : ''}`}
                        >
                            <span className="text-[10px] font-bold tracking-wider mr-4">TOP</span>
                            {toggles.top ? <Unlock size={14} /> : <Lock size={14} />}
                        </button>

                         {/* Toggle: SKIRT */}
                         <button 
                            onClick={() => handleToggle('skirt')}
                            className={`flex items-center justify-between px-3 py-1.5 rounded-lg border backdrop-blur-md transition-all ${toggles.skirt ? 'bg-cyan-900/60 border-cyan-500 text-cyan-200' : 'bg-gray-800/40 border-gray-700 text-gray-400'}`}
                        >
                            <span className="text-[10px] font-bold tracking-wider mr-4">SKIRT</span>
                            {toggles.skirt ? <Unlock size={14} /> : <Lock size={14} />}
                        </button>
                    </div>

                    {/* Right Thumb - Steering */}
                    <div 
                        className={`${zoneBaseClass} w-64 h-32 ${rightActive ? activeClass : ''}`}
                        onTouchStart={handleRightStart}
                        onTouchMove={handleRightMove}
                        onTouchEnd={handleRightEnd}
                        onTouchCancel={handleRightEnd}
                    >
                        <div className="absolute w-40 h-[1px] bg-white/20 rounded-full" />
                        
                        <div 
                            className={`absolute w-14 h-14 rounded-full border-2 border-purple-400/50 flex items-center justify-center transition-transform duration-75 ${rightActive ? 'bg-purple-500/20 scale-110' : 'opacity-30'}`}
                            style={{ transform: `translateX(${rightUI}px)` }}
                        >
                            {rightUI > 10 && <ChevronRight className="text-purple-200" size={20} />}
                            {rightUI < -10 && <ChevronLeft className="text-purple-200" size={20} />}
                        </div>
                        {!rightActive && <div className="absolute bottom-4 text-white/40 text-[10px] font-bold tracking-widest font-mono">STEER</div>}
                    </div>
                </div>
            </div>
        </div>
    );
};
