export function visibleViewportRect(visualViewport, windowObject = window) {
  return {
    left: Number.isFinite(visualViewport?.offsetLeft) ? visualViewport.offsetLeft : 0,
    top: Number.isFinite(visualViewport?.offsetTop) ? visualViewport.offsetTop : 0,
    width: Math.max(1, Number(visualViewport?.width) || windowObject.innerWidth || 1),
    height: Math.max(1, Number(visualViewport?.height) || windowObject.innerHeight || 1)
  };
}

export function bindVisibleViewport(element, windowObject = window) {
  const viewport = windowObject.visualViewport;
  let frame = 0;
  let previous = "";
  const update = () => {
    frame = 0;
    const rect = visibleViewportRect(viewport, windowObject);
    const signature = `${rect.left}|${rect.top}|${rect.width}|${rect.height}`;
    if (signature === previous) return;
    previous = signature;
    element.style.setProperty("--pwa-viewport-left", `${rect.left}px`);
    element.style.setProperty("--pwa-viewport-top", `${rect.top}px`);
    element.style.setProperty("--pwa-viewport-width", `${rect.width}px`);
    element.style.setProperty("--pwa-viewport-height", `${rect.height}px`);
  };
  const schedule = () => {
    if (!frame) frame = windowObject.requestAnimationFrame(update);
  };
  windowObject.addEventListener("resize", schedule);
  viewport?.addEventListener("resize", schedule);
  viewport?.addEventListener("scroll", schedule);
  update();
  return () => {
    if (frame) windowObject.cancelAnimationFrame(frame);
    windowObject.removeEventListener("resize", schedule);
    viewport?.removeEventListener("resize", schedule);
    viewport?.removeEventListener("scroll", schedule);
  };
}
