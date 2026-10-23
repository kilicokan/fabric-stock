# Cutting Workshop Refactoring Specification

Please refactor the monolithic React/Next.js page component into a structured, modular, clean architecture.

## Target Directory Structure

Generate/update the following files inside `src/` (or root):

1. `types/cutting.ts`
   - Define interfaces: `WorkOrder`, `DefectLog`, `StepType`, `AudioType`.

2. `utils/audio.ts`
   - Implement `playAudioFeedback(type: AudioType)` using Web Audio API (OscillatorNode & GainNode). Handles 'success', 'error', 'scale', 'click'.

3. `hooks/useGlobalBarcode.ts`
   - Implement a custom React hook that listens to global `keydown` events, buffers barcode character streams, and triggers a callback when `Enter` is pressed. Skip when focus is on INPUT/TEXTAREA.

4. `app/cutting/page.tsx`
   - Implement the primary UI component importing the types, audio utility, and custom barcode hook.
   - Include:
     - Header with Online/Offline indicator, Fullscreen toggle, Audio Mute toggle, Operator Lock toggle.
     - Step Navigation Bar (5 steps: Work Order, Spreading, Scale & Layer, Defect Log, Completion).
     - Work Order Selection with search & barcode dynamic insertion.
     - Live Scale Integration display (kg) with layer count auto-calculation formula:
       `Calculated Layers = Weight(g) / (Width(m) * Length(m) * Grammage(g/m²))`
     - Camera Capture for fabric defects with note-taking and defect log array.
     - ZPL Thermal Label Printer mockup function.

## Rules
- Use TypeScript with strict typing.
- Use Tailwind CSS for styling.
- Use `lucide-react` for icons.
- Ensure all interactive elements have touch-friendly sizing (min-height 48px/52px).