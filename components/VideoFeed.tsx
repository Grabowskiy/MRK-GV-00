import React, { useMemo, useState, useEffect, useRef } from 'react';
import { AppConfig } from '../types';
import { RefreshCw, ExternalLink, AlertCircle, MonitorPlay, ZoomIn, ZoomOut } from 'lucide-react';

interface Props {
    config: AppConfig;
    fullscreen?: boolean;
    useIframe: boolean;
    setUseIframe: (val: boolean) => void;
}

export const VideoFeed: React.FC<Props> = ({ config, fullscreen = false, useIframe, setUseIframe }) => {
    const [hasError, setHasError] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [iframeScale, setIframeScale] = useState(0.5); // Default 0.5 to fit typical streams
    const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Reset state when config changes
    useEffect(() => {
        setHasError(false);
        setRetryCount(0);
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    }, [config.cameraUrl, config.cameraUser, config.cameraPwd]);

    // Construct URL
    const streamUrl = useMemo(() => {
        if (!config.cameraUrl) return '';
        
        let finalUrl = config.cameraUrl;

        // Inject Auth if needed
        if (config.cameraUser && config.cameraPwd) {
            try {
                const urlObj = new URL(config.cameraUrl);
                urlObj.username = config.cameraUser;
                urlObj.password = config.cameraPwd;
                finalUrl = urlObj.toString();
            } catch (e) {
                // Keep original if parsing fails
            }
        }

        // Only append timestamp for IMG mode (retryCount > 0). 
        // For IFRAME, we typically don't want query params as they might break some stream servers.
        if (!useIframe && retryCount > 0) {
            const separator = finalUrl.includes('?') ? '&' : '?';
            finalUrl = `${finalUrl}${separator}_t=${Date.now()}`;
        }
        
        return finalUrl;
    }, [config.cameraUrl, config.cameraUser, config.cameraPwd, retryCount, useIframe]);

    const handleError = () => {
        setHasError(true);
        if (!retryTimeoutRef.current) {
            retryTimeoutRef.current = setTimeout(() => {
                setRetryCount(c => c + 1);
                setHasError(false);
                retryTimeoutRef.current = null;
            }, 3000);
        }
    };

    const handleManualRetry = () => {
        if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
            retryTimeoutRef.current = null;
        }
        setRetryCount(c => c + 1);
        setHasError(false);
    };

    const toggleScale = () => {
        setIframeScale(prev => prev === 1 ? 0.5 : 1);
    };

    const renderContent = () => {
        if (!streamUrl) {
             return (
                <div className="absolute inset-0 flex items-center justify-center text-gray-700 font-mono text-xs uppercase tracking-widest bg-black">
                    NO SIGNAL
                </div>
            );
        }

        // --- IFRAME MODE (Mobile Fallback) ---
        if (useIframe) {
            // CSS Transform scaling
            // To fit a larger stream into the view:
            // 1. Make the iframe larger (e.g. 200% width/height)
            // 2. Scale it down (e.g. 0.5)
            const widthPct = (1 / iframeScale) * 100; 
            
            return (
                <div className="w-full h-full relative bg-black overflow-hidden">
                     <iframe 
                        src={streamUrl} 
                        className="border-0 pointer-events-auto origin-top-left absolute top-0 left-0 bg-black"
                        scrolling="no"
                        title="Camera Feed"
                        allow="autoplay; fullscreen; picture-in-picture"
                        style={{
                            width: `${widthPct}%`,
                            height: `${widthPct}%`,
                            transform: `scale(${iframeScale})`,
                            backgroundColor: '#000000',
                            colorScheme: 'dark'
                        }}
                    />
                    
                    <div className="absolute top-2 right-2 flex gap-2 z-20">
                        <button 
                            onClick={toggleScale}
                            className="bg-black/50 text-white p-1 rounded hover:bg-black/70 border border-white/10"
                            title={iframeScale === 1 ? "Zoom Out / Fit" : "Zoom In / 1:1"}
                        >
                            {iframeScale === 1 ? <ZoomOut size={14} /> : <ZoomIn size={14} />}
                        </button>
                        <button 
                            onClick={() => setUseIframe(false)}
                            className="bg-black/50 text-white p-1 rounded hover:bg-black/70 border border-white/10"
                            title="Switch back to IMG mode"
                        >
                            <MonitorPlay size={14} />
                        </button>
                    </div>
                </div>
            );
        }

        // --- IMAGE MODE (Default) ---
        if (hasError) {
             return (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 font-mono text-xs gap-3 p-6 text-center bg-gray-900/90 z-10 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-2 animate-pulse">
                        <AlertCircle className="text-red-500" size={24} />
                        <span className="text-red-400 font-bold tracking-widest">SIGNAL LOST</span>
                    </div>
                    
                    <p className="text-[10px] text-gray-500 max-w-[200px]">
                        Retrying connection...
                    </p>

                    <div className="flex flex-wrap justify-center gap-2 mt-2 w-full max-w-xs">
                        <button 
                            onClick={handleManualRetry}
                            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded text-[10px] border border-gray-700 transition-colors"
                        >
                            <RefreshCw size={12} /> RETRY
                        </button>

                        <button 
                            onClick={() => setUseIframe(true)}
                            className="flex items-center gap-2 bg-cyan-900/30 hover:bg-cyan-900/50 text-cyan-400 px-3 py-2 rounded text-[10px] border border-cyan-800 transition-colors"
                        >
                            <MonitorPlay size={12} /> COMPAT MODE
                        </button>
                        
                        <a 
                            href={config.cameraUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded text-[10px] border border-gray-700 transition-colors"
                        >
                            <ExternalLink size={12} /> OPEN IN TAB
                        </a>
                    </div>
                    <span className="text-[9px] text-gray-600 mt-2">
                        Try "Compat Mode" if using Mobile/Safari.
                    </span>
                </div>
            );
        }

        return (
            <img 
                key={retryCount} 
                src={streamUrl} 
                alt="Live Stream" 
                className="w-full h-full object-contain block bg-black"
                onError={handleError}
                onLoad={() => setHasError(false)}
                referrerPolicy="no-referrer"
                crossOrigin="anonymous" 
            />
        );
    };

    if (fullscreen) {
        return (
            <div className="absolute inset-0 bg-black flex items-center justify-center overflow-hidden z-0">
                {renderContent()}
                <div className="absolute top-4 left-4 text-xs font-mono text-cyan-500/50 pointer-events-none z-20">
                    LIVE FEED :: {useIframe ? `IFRAME_MODE [${iframeScale}x]` : (config.cameraUser ? 'AUTH_SECURE' : 'OPEN')}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center w-full">
            <h2 className="text-cyan-400 font-mono mb-2 text-sm tracking-widest uppercase opacity-70">Live Visual Feed</h2>
            <div className="w-full max-w-[640px] aspect-[4/3] bg-black rounded-lg border-2 border-gray-800 shadow-2xl overflow-hidden relative group">
                {renderContent()}
                
                {/* Status Indicator overlay - Only show if working */}
                {!hasError && streamUrl && (
                    <div className="absolute top-2 right-2 flex gap-1 pointer-events-none z-10">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_red]" />
                    </div>
                )}
            </div>
            <p className="text-[10px] text-gray-600 font-mono mt-2 truncate max-w-md">
                SRC: {streamUrl || 'DISCONNECTED'}
            </p>
        </div>
    );
};