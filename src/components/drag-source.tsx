import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

export function DragSource({
  enabled,
  onStart,
  onMove,
  onEnd,
  onCancel,
  children,
}: {
  enabled: boolean;
  onStart: (x: number, y: number) => void;
  onMove: (x: number, y: number) => void;
  onEnd: (x: number, y: number) => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  const handlers = useRef({ onStart, onMove, onEnd, onCancel });
  handlers.current = { onStart, onMove, onEnd, onCancel };

  const emitStart = useCallback((x: number, y: number) => handlers.current.onStart(x, y), []);
  const emitMove = useCallback((x: number, y: number) => handlers.current.onMove(x, y), []);
  const emitEnd = useCallback((x: number, y: number) => handlers.current.onEnd(x, y), []);
  const emitCancel = useCallback(() => handlers.current.onCancel(), []);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .activateAfterLongPress(280)
        .onStart((event) => {
          runOnJS(emitStart)(event.absoluteX, event.absoluteY);
        })
        .onUpdate((event) => {
          runOnJS(emitMove)(event.absoluteX, event.absoluteY);
        })
        .onEnd((event) => {
          runOnJS(emitEnd)(event.absoluteX, event.absoluteY);
        })
        .onFinalize((_event, success) => {
          if (!success) runOnJS(emitCancel)();
        }),
    [enabled, emitStart, emitMove, emitEnd, emitCancel],
  );

  return <GestureDetector gesture={gesture}>{children}</GestureDetector>;
}
