'use client';

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { RequiredTool } from "@/types/workflow";
import { translateCoordinates } from "@/lib/utils/coordinate-utils";

interface VisionOverlayProps {
  tools: RequiredTool[];
  isMirrored?: boolean;
  videoWidth: number;
  videoHeight: number;
}

export default function VisionOverlay({ 
    tools, 
    isMirrored = false, 
    videoWidth, 
    videoHeight 
}: VisionOverlayProps) {
  const containerRef = useRef<SVGSVGElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [mappedTools, setMappedTools] = useState<any[]>([]);

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
    if (containerSize.width > 0) {
        const newMappedTools = tools
            .filter(t => t.detected && t.boundingBox)
            .map(t => {
                const [ymin, xmin, ymax, xmax] = t.boundingBox!;
                
                // Translate Top-Left
                const start = translateCoordinates(
                    xmin / 1000, ymin / 1000, 
                    videoWidth, videoHeight, 
                    containerSize.width, containerSize.height, 
                    isMirrored
                );
                
                // Translate Bottom-Right
                const end = translateCoordinates(
                    xmax / 1000, ymax / 1000, 
                    videoWidth, videoHeight, 
                    containerSize.width, containerSize.height, 
                    isMirrored
                );

                return {
                    ...t,
                    mappedX: Math.min(start.x, end.x),
                    mappedY: Math.min(start.y, end.y),
                    mappedWidth: Math.abs(end.x - start.x),
                    mappedHeight: Math.abs(end.y - start.y)
                };
            });
        setMappedTools(newMappedTools);
    }
  }, [tools, videoWidth, videoHeight, isMirrored, containerSize]);

  return (
    <svg 
      ref={containerRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-20"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="15" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {mappedTools.map((tool, index) => {
        const xmin = tool.mappedX;
        const ymin = tool.mappedY;
        const width = tool.mappedWidth;
        const height = tool.mappedHeight;

        return (
          <g key={`${tool.name}-${index}`}>
            {/* The Outer Hue (Glow) */}
            <motion.rect
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              x={xmin}
              y={ymin}
              width={width}
              height={height}
              fill="none"
              stroke="rgba(59, 130, 246, 0.7)"
              strokeWidth="40"
              filter="url(#glow)"
              rx="20"
              vectorEffect="non-scaling-stroke"
            />
            
            {/* The Inner Box */}
            <motion.rect
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5 }}
              x={xmin}
              y={ymin}
              width={width}
              height={height}
              fill="none"
              stroke="rgba(147, 197, 253, 1)"
              strokeWidth="8"
              rx="20"
              vectorEffect="non-scaling-stroke"
            />

            {/* Label */}
            <motion.text
              initial={{ opacity: 0, y: ymin - 10 }}
              animate={{ opacity: 1, y: ymin - 20 }}
              x={xmin}
              y={ymin}
              className="fill-blue-200 text-[24px] font-bold uppercase tracking-widest leading-none drop-shadow-md"
            >
              {tool.name}
            </motion.text>
          </g>
        );
      })}
    </svg>
  );
}
