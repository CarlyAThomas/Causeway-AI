'use client';

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { translateCoordinates } from "@/lib/utils/coordinate-utils";

interface SpatialHighlight {
    x: number; // Normalized 0-1000 from hook
    y: number; // Normalized 0-1000 from hook
    label: string;
}

interface SpatialHighlightOverlayProps {
    highlight: SpatialHighlight | null;
    isMirrored?: boolean;
    videoWidth: number;
    videoHeight: number;
}

export default function SpatialHighlightOverlay({ 
    highlight, 
    isMirrored = false, 
    videoWidth, 
    videoHeight 
}: SpatialHighlightOverlayProps) {
    const containerRef = useRef<SVGSVGElement>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [coords, setCoords] = useState<{ x: number, y: number } | null>(null);

    // Track container size for responsive mapping
    useEffect(() => {
        if (!containerRef.current) return;
        
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerSize({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height
                });
            }
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (highlight && containerSize.width > 0) {
            const { x, y } = translateCoordinates(
                highlight.x / 1000, 
                highlight.y / 1000, 
                videoWidth, 
                videoHeight, 
                containerSize.width, 
                containerSize.height, 
                isMirrored
            );
            setCoords({ x, y });
        } else {
            setCoords(null);
        }
    }, [highlight, videoWidth, videoHeight, isMirrored, containerSize]);

    return (
        <svg 
            ref={containerRef}
            className="absolute inset-0 w-full h-full pointer-events-none z-30"
            preserveAspectRatio="xMidYMid slice"
        >
            <defs>
                <filter id="highlight-glow">
                    <feGaussianBlur stdDeviation="10" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>

            <AnimatePresence>
                {highlight && coords && (
                    <g>
                        {/* 1. LAYER: THE SONAR PULSE (Outer Ring) */}
                        <motion.circle
                            initial={{ r: 20, opacity: 0.8, strokeWidth: 10 }}
                            animate={{ 
                                r: [20, 100], 
                                opacity: [0.8, 0],
                                strokeWidth: [10, 2]
                            }}
                            transition={{ 
                                duration: 2, 
                                repeat: Infinity, 
                                ease: "easeOut" 
                            }}
                            cx={coords.x}
                            cy={coords.y}
                            fill="none"
                            stroke="rgba(244, 63, 94, 0.6)" // Rose-500
                        />

                        {/* 2. LAYER: THE STEADY TARGET (Middle Ring) */}
                        <motion.circle
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            cx={coords.x}
                            cy={coords.y}
                            r="30"
                            fill="none"
                            stroke="rgba(255, 255, 255, 0.8)"
                            strokeWidth="4"
                            filter="url(#highlight-glow)"
                        />

                        {/* 3. LAYER: THE CENTER POINT (Core) */}
                        <motion.circle
                            initial={{ scale: 0 }}
                            animate={{ scale: [1, 1.5, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                            cx={coords.x}
                            cy={coords.y}
                            r="8"
                            fill="white"
                            className="shadow-xl"
                        />

                        {/* 4. LAYER: THE HUD LABEL */}
                        <motion.g
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{ x: coords.x, y: coords.y + 60 }}
                        >
                            <rect 
                                x="-120"
                                y="0"
                                width="240"
                                height="40"
                                rx="20"
                                fill="rgba(0, 0, 0, 0.6)"
                                className="backdrop-blur-md border border-white/10"
                            />
                            <text
                                textAnchor="middle"
                                dy="26"
                                className="fill-rose-400 text-[18px] font-black uppercase tracking-[0.3em]"
                            >
                                {highlight.label}
                            </text>
                            
                            {/* Connector Line */}
                            <line 
                                x1="0" y1="-20" x2="0" y2="0"
                                stroke="white" strokeWidth="2" strokeDasharray="4 4"
                                className="opacity-40"
                            />
                        </motion.g>
                    </g>
                )}
            </AnimatePresence>
        </svg>
    );
}
