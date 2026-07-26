/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useEffect, useRef, useState } from 'react';
import { HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { COLORS } from '../types';
import { Camera, SwitchCamera, FlipHorizontal, Minimize2, Maximize2, Eye, EyeOff, ZoomIn } from 'lucide-react';

export type PreviewSize = 'normal' | 'small' | 'micro' | 'hidden';

interface WebcamPreviewProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    resultsRef: React.MutableRefObject<HandLandmarkerResult | null>;
    isCameraReady: boolean;
    facingMode?: 'user' | 'environment';
    onSwitchCamera?: () => void;
    isCameraMirrored?: boolean;
    onToggleMirror?: () => void;
    videoDevices?: MediaDeviceInfo[];
    selectedDeviceId?: string | null;
    onSelectDevice?: (deviceId: string) => void;
    onSelectUltraWide?: () => void;
}

const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
    [0, 5], [5, 6], [6, 7], [7, 8], // Index
    [0, 9], [9, 10], [10, 11], [11, 12], // Middle
    [0, 13], [13, 14], [14, 15], [15, 16], // Ring
    [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
    [5, 9], [9, 13], [13, 17], [0, 5], [0, 17] // Palm
];

const WebcamPreview: React.FC<WebcamPreviewProps> = ({
    videoRef,
    resultsRef,
    isCameraReady,
    facingMode = 'user',
    onSwitchCamera,
    isCameraMirrored = true,
    onToggleMirror,
    videoDevices = [],
    selectedDeviceId = null,
    onSelectDevice,
    onSelectUltraWide
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [previewSize, setPreviewSize] = useState<PreviewSize>('small');
    const [showDeviceMenu, setShowDeviceMenu] = useState(false);

    useEffect(() => {
        if (!isCameraReady || previewSize === 'hidden') return;
        let animationFrameId: number;

        const render = () => {
            const canvas = canvasRef.current;
            const video = videoRef.current;

            if (canvas && video && video.readyState >= 2) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
                    if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    // 1. Draw Video Feed (Conditional Horizontal Mirroring)
                    ctx.save();
                    if (isCameraMirrored) {
                        ctx.scale(-1, 1);
                        ctx.translate(-canvas.width, 0);
                    }
                    ctx.globalAlpha = 0.85;
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    ctx.restore();
                    ctx.globalAlpha = 1.0;

                    const getX = (nx: number) => (isCameraMirrored ? (1 - nx) : nx) * canvas.width;

                    // 2. Draw Hand Landmarks
                    if (resultsRef.current && resultsRef.current.landmarks) {
                        for (let i = 0; i < resultsRef.current.landmarks.length; i++) {
                            const landmarks = resultsRef.current.landmarks[i];
                            const handInfo = resultsRef.current.handedness[i];
                            if (!handInfo || !handInfo[0]) continue;

                            const handedness = handInfo[0];
                            const isRight = handedness.categoryName === 'Right';
                            const color = isRight ? COLORS.right : COLORS.left;

                            ctx.strokeStyle = color;
                            ctx.fillStyle = color;
                            ctx.lineWidth = 3;

                            // Draw connections
                            ctx.beginPath();
                            for (const [start, end] of HAND_CONNECTIONS) {
                                const p1 = landmarks[start];
                                const p2 = landmarks[end];
                                ctx.moveTo(getX(p1.x), p1.y * canvas.height);
                                ctx.lineTo(getX(p2.x), p2.y * canvas.height);
                            }
                            ctx.stroke();

                            // Draw joints
                            for (const lm of landmarks) {
                                ctx.beginPath();
                                ctx.arc(getX(lm.x), lm.y * canvas.height, 4, 0, 2 * Math.PI);
                                ctx.fill();
                            }

                            // Highlight index finger tip
                            const tip = landmarks[8];
                            ctx.beginPath();
                            ctx.fillStyle = '#ffffff';
                            ctx.arc(getX(tip.x), tip.y * canvas.height, 7, 0, 2 * Math.PI);
                            ctx.fill();
                        }
                    }
                }
            }
            animationFrameId = requestAnimationFrame(render);
        };
        render();

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [isCameraReady, videoRef, resultsRef, isCameraMirrored, previewSize]);

    if (!isCameraReady) return null;

    // Cycle through sizes
    const cycleSize = () => {
        if (previewSize === 'normal') setPreviewSize('small');
        else if (previewSize === 'small') setPreviewSize('micro');
        else if (previewSize === 'micro') setPreviewSize('hidden');
        else setPreviewSize('small');
    };

    // Determine container size classes
    let sizeClasses = 'w-60 h-44'; // normal
    if (previewSize === 'small') sizeClasses = 'w-40 h-28';
    if (previewSize === 'micro') sizeClasses = 'w-24 h-18';

    if (previewSize === 'hidden') {
        return (
            <div className="fixed bottom-3 right-3 z-50 pointer-events-auto">
                <button
                    onClick={() => setPreviewSize('small')}
                    className="bg-slate-950/90 hover:bg-slate-800 text-cyan-300 p-2 rounded-xl border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)] flex items-center gap-1.5 text-xs font-mono font-bold backdrop-blur-md active:scale-95 transition-all"
                    title="Mostrar Câmera"
                >
                    <Eye className="w-4 h-4 text-cyan-400" />
                    <span>Mostrar Câmera</span>
                </button>
            </div>
        );
    }

    const hasUltraWideCandidate = videoDevices.some(d => {
        const l = d.label.toLowerCase();
        return l.includes('wide') || l.includes('ampla') || l.includes('0.5') || l.includes('ultra');
    });

    return (
        <div className={`fixed bottom-3 right-3 ${sizeClasses} bg-black/80 border-2 border-cyan-500/40 rounded-xl overflow-hidden backdrop-blur-md z-50 shadow-[0_0_20px_rgba(0,0,0,0.6)] transition-all duration-300 flex flex-col`}>
            {/* Control Bar Header */}
            <div className="bg-slate-950/90 px-1.5 py-1 text-[9px] text-slate-200 font-mono flex items-center justify-between border-b border-cyan-500/30 z-10 gap-1 shrink-0">
                <div className="flex items-center gap-1 truncate">
                    <Camera className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span className="font-bold truncate text-[9px]">
                        {facingMode === 'user' ? 'Frontal' : 'Traseira'}
                    </span>
                </div>

                {/* Header buttons */}
                <div className="flex items-center gap-1 pointer-events-auto shrink-0">
                    {/* Mirror / Flip Hand Button */}
                    {onToggleMirror && (
                        <button
                            onClick={onToggleMirror}
                            className={`p-0.5 rounded text-[9px] border transition-all ${
                                isCameraMirrored
                                    ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50'
                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                            title="Inverter / Espelhar Mão Horizontalmente"
                        >
                            <FlipHorizontal className="w-3 h-3" />
                        </button>
                    )}

                    {/* Ultra wide button */}
                    {onSelectUltraWide && (
                        <button
                            onClick={onSelectUltraWide}
                            className="px-1 py-0.5 bg-purple-900/80 hover:bg-purple-800 text-purple-200 rounded text-[8px] font-bold border border-purple-500/40 flex items-center gap-0.5 active:scale-95 transition-all"
                            title="Ativar Câmera Ultra-Wide (Ampla 0.5x)"
                        >
                            <ZoomIn className="w-2.5 h-2.5 text-purple-300" />
                            <span>0.5x</span>
                        </button>
                    )}

                    {/* Switch Camera */}
                    {onSwitchCamera && (
                        <button
                            onClick={onSwitchCamera}
                            className="p-0.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded text-[9px] border border-cyan-500/30 active:scale-95"
                            title="Alternar Câmera"
                        >
                            <SwitchCamera className="w-3 h-3" />
                        </button>
                    )}

                    {/* Resize / Minimize */}
                    <button
                        onClick={cycleSize}
                        className="p-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9px] active:scale-95"
                        title="Tamanho da Câmera (Normal / Pequeno / Mínimo / Ocultar)"
                    >
                        {previewSize === 'normal' ? (
                            <Minimize2 className="w-3 h-3 text-amber-400" />
                        ) : previewSize === 'small' ? (
                            <Minimize2 className="w-2.5 h-2.5 text-slate-300" />
                        ) : (
                            <EyeOff className="w-2.5 h-2.5 text-red-400" />
                        )}
                    </button>
                </div>
            </div>

            {/* Video Canvas Container */}
            <div className="relative flex-1 w-full h-full overflow-hidden bg-black/90">
                <canvas ref={canvasRef} className="w-full h-full object-cover" />
            </div>
        </div>
    );
};

export default WebcamPreview;
