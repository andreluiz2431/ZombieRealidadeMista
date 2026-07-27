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
    isCameraPreviewVisible?: boolean;
    onToggleCameraPreviewVisible?: (visible: boolean) => void;
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
    onSelectUltraWide,
    isCameraPreviewVisible = true,
    onToggleCameraPreviewVisible
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [previewSize, setPreviewSize] = useState<PreviewSize>('small');

    // Sync preview size with parent visibility preference
    useEffect(() => {
        if (!isCameraPreviewVisible) {
            setPreviewSize('hidden');
        } else if (previewSize === 'hidden') {
            setPreviewSize('small');
        }
    }, [isCameraPreviewVisible]);

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

    // Handle preview size changes
    const changePreviewSize = (newSize: PreviewSize) => {
        setPreviewSize(newSize);
        if (onToggleCameraPreviewVisible) {
            onToggleCameraPreviewVisible(newSize !== 'hidden');
        }
    };

    // Cycle through sizes
    const cycleSize = () => {
        if (previewSize === 'normal') changePreviewSize('small');
        else if (previewSize === 'small') changePreviewSize('micro');
        else changePreviewSize('normal');
    };

    // Determine container size classes for video box
    let sizeClasses = 'w-64 h-48'; // normal
    if (previewSize === 'small') sizeClasses = 'w-44 h-32';
    if (previewSize === 'micro') sizeClasses = 'w-28 h-20';

    return (
        <div className="fixed bottom-3 right-3 z-50 pointer-events-auto flex flex-col items-end gap-1.5 max-w-[320px]">
            {/* 1. Camera Video Feed Pop-Up (Separated / Uncoupled) */}
            {previewSize !== 'hidden' && (
                <div className={`relative ${sizeClasses} bg-black/90 border-2 border-cyan-500/50 rounded-xl overflow-hidden backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.8)] transition-all duration-300 flex flex-col shrink-0`}>
                    {/* Badge Overlay on top corner of video */}
                    <div className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-slate-950/80 rounded-md text-[9px] font-mono text-cyan-300 border border-cyan-500/40 backdrop-blur-sm pointer-events-none flex items-center gap-1.5 z-10">
                        <Camera className="w-3 h-3 text-cyan-400" />
                        <span className="font-bold">{facingMode === 'user' ? 'Frontal' : 'Traseira'}</span>
                    </div>

                    {/* Canvas Feed */}
                    <div className="relative flex-1 w-full h-full overflow-hidden">
                        <canvas ref={canvasRef} className="w-full h-full object-cover" />
                    </div>
                </div>
            )}

            {/* 2. Uncoupled External Control Bar (Always accessible below camera or floating) */}
            <div className="bg-slate-950/95 border border-cyan-500/40 backdrop-blur-xl rounded-xl p-1.5 flex items-center gap-1.5 shadow-2xl text-xs font-mono text-white transition-all">
                {/* Show / Hide Toggle Button */}
                <button
                    onClick={() => changePreviewSize(previewSize === 'hidden' ? 'small' : 'hidden')}
                    className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-cyan-300 rounded-lg border border-cyan-500/40 active:scale-95 transition-all flex items-center gap-1.5 text-[11px] font-bold"
                    title={previewSize === 'hidden' ? 'Exibir Pop-up da Câmera' : 'Ocultar Pop-up da Câmera'}
                >
                    {previewSize === 'hidden' ? (
                        <>
                            <Eye className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Exibir Câmera</span>
                        </>
                    ) : (
                        <>
                            <EyeOff className="w-3.5 h-3.5 text-red-400" />
                            <span>Ocultar</span>
                        </>
                    )}
                </button>

                {/* Size Selector Button (Only when visible) */}
                {previewSize !== 'hidden' && (
                    <button
                        onClick={cycleSize}
                        className="px-2 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-lg border border-slate-700 active:scale-95 transition-all flex items-center gap-1 text-[11px] font-bold"
                        title="Mudar tamanho do pop-up da câmera"
                    >
                        <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>
                            {previewSize === 'normal' ? 'Grande' : previewSize === 'small' ? 'Médio' : 'Micro'}
                        </span>
                    </button>
                )}

                {/* Switch Camera */}
                {onSwitchCamera && (
                    <button
                        onClick={onSwitchCamera}
                        className="p-1.5 bg-slate-900 hover:bg-slate-800 text-cyan-300 rounded-lg border border-cyan-500/30 active:scale-95 transition-all flex items-center justify-center"
                        title="Alternar Câmera (Frontal / Traseira)"
                    >
                        <SwitchCamera className="w-3.5 h-3.5" />
                    </button>
                )}

                {/* Ultra wide button */}
                {onSelectUltraWide && (
                    <button
                        onClick={onSelectUltraWide}
                        className="px-2 py-1.5 bg-purple-950 hover:bg-purple-900 text-purple-200 rounded-lg border border-purple-500/50 active:scale-95 transition-all flex items-center gap-1 text-[11px] font-bold"
                        title="Ativar Câmera Ultra-Wide (Ampla 0.5x)"
                    >
                        <ZoomIn className="w-3.5 h-3.5 text-purple-300" />
                        <span>0.5x</span>
                    </button>
                )}

                {/* Mirror / Flip Hand Button */}
                {onToggleMirror && (
                    <button
                        onClick={onToggleMirror}
                        className={`p-1.5 rounded-lg border text-[11px] font-bold active:scale-95 transition-all flex items-center justify-center ${
                            isCameraMirrored
                                ? 'bg-cyan-950 text-cyan-300 border-cyan-500/60'
                                : 'bg-slate-900 text-slate-400 border-slate-700'
                        }`}
                        title="Inverter / Espelhar Mão Horizontalmente"
                    >
                        <FlipHorizontal className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
};

export default WebcamPreview;
