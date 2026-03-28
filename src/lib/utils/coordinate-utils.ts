/**
 * translateCoordinates
 * 
 * Maps normalized Gemini coordinates (0.0 to 1.0) to actual container pixels,
 * accounting for horizontal mirroring and CSS 'object-fit: cover' cropping.
 * 
 * @param geminiX - Normalized X from Gemini (0.0 - 1.0)
 * @param geminiY - Normalized Y from Gemini (0.0 - 1.0)
 * @param videoWidth - Intrinsic width of the video stream
 * @param videoHeight - Intrinsic height of the video stream
 * @param containerWidth - Rendered width of the UI container
 * @param containerHeight - Rendered height of the UI container
 * @param isMirrored - Whether the video is horizontally flipped (Mirror View)
 */
/**
 * translateCoordinates
 * Maps normalized Gemini coordinates (0.0 to 1.0) to actual container pixels,
 * accurately accounting for CSS 'object-fit: cover' cropping and mirroring.
 */
export function translateCoordinates(
    geminiX: number,
    geminiY: number,
    videoWidth: number,
    videoHeight: number,
    containerWidth: number,
    containerHeight: number,
    isMirrored: boolean = false
): { x: number; y: number } {
    
    // 1. Sanitize Inputs
    const safeX = Math.max(0, Math.min(1, geminiX));
    const safeY = Math.max(0, Math.min(1, geminiY));

    // 2. Handle Mirroring (Selfie View)
    const x = isMirrored ? (1.0 - safeX) : safeX;
    const y = safeY;

    // 3. The "Object-Fit: Cover" Math
    const videoRatio = videoWidth / videoHeight;
    const containerRatio = containerWidth / containerHeight;

    let renderWidth, renderHeight, offsetX = 0, offsetY = 0;

    if (containerRatio > videoRatio) {
        // [CASE]: UI is wider than video (Crop Top/Bottom)
        renderWidth = containerWidth;
        renderHeight = containerWidth / videoRatio;
        offsetY = (renderHeight - containerHeight) / 2;
    } else {
        // [CASE]: UI is taller than video (Crop Left/Right)
        renderHeight = containerHeight;
        renderWidth = containerHeight * videoRatio;
        offsetX = (renderWidth - containerWidth) / 2;
    }

    // 4. Map the coordinates to the scaled video, then subtract the invisible cropped edge
    return {
        x: (x * renderWidth) - offsetX,
        y: (y * renderHeight) - offsetY
    };
}
