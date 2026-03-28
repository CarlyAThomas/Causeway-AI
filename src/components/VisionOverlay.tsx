'use client';

import { motion } from "framer-motion";
import { RequiredTool } from "@/types/workflow";

interface VisionOverlayProps {
  tools: RequiredTool[];
}

export default function VisionOverlay({ tools }: VisionOverlayProps) {
  // Filter for tools that have a bounding box
  const detectedTools = tools.filter(t => t.detected && t.boundingBox);

  return (
    <svg 
      className="absolute inset-0 w-full h-full pointer-events-none z-20"
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="15" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {detectedTools.map((tool, index) => {
        const [ymin, xmin, ymax, xmax] = tool.boundingBox!;
        const width = xmax - xmin;
        const height = ymax - ymin;

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
