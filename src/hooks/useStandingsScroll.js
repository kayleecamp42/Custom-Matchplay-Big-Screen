import { useEffect, useRef } from "react";

export function useStandingsScroll(containerRef, innerRef, contentKey, config = {}) {
  const {
    topPauseMs = 10000,
    scrollMs = 16000,
    bottomPauseMs = 5000,
    extraPx = 60,
    pixelsPerSecond = null,
  } = config;

  const timerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;

    function clear() {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    clear();

    inner.style.transition = "none";
    inner.style.transform = "translateY(0px)";

    function runCycle() {
      const maxScroll = Math.max(0, inner.scrollHeight - container.clientHeight + extraPx);
      if (maxScroll <= 0) return;

      const duration = pixelsPerSecond
        ? Math.max(scrollMs, Math.round((maxScroll / pixelsPerSecond) * 1000))
        : scrollMs;

      timerRef.current = setTimeout(() => {
        inner.style.transition = `transform ${duration}ms linear`;
        inner.style.transform = `translateY(-${maxScroll}px)`;

        timerRef.current = setTimeout(() => {
          inner.style.transition = `transform ${duration}ms linear`;
          inner.style.transform = "translateY(0px)";

          timerRef.current = setTimeout(runCycle, duration + topPauseMs);
        }, duration + bottomPauseMs);
      }, topPauseMs);
    }

    const rafId = requestAnimationFrame(runCycle);

    return () => {
      cancelAnimationFrame(rafId);
      clear();
    };
  }, [contentKey, containerRef, innerRef, topPauseMs, scrollMs, bottomPauseMs, extraPx, pixelsPerSecond]);
}