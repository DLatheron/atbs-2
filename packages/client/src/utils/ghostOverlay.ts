export const DEFAULT_GHOST_FADE_MS = 1000;

export interface SpawnFadingGhostOptions {
    source: HTMLElement;
    container: HTMLElement;
    durationMs?: number;
    onMount?: (ghost: HTMLElement) => void;
    onUnmount?: (ghost: HTMLElement) => void;
}

export interface SpawnFadingGhostResult {
    ghost: HTMLElement;
    dispose: () => void;
}

function stripIds(root: HTMLElement): void {
    root.removeAttribute("id");
    root.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
}

/**
 * Disable and block interaction on a cloned overlay.
 * Inline pointer-events:none overrides child CSS like MUI's pointerEvents: "auto".
 */
function makeNonInteractive(root: HTMLElement): void {
    root.setAttribute("inert", "");
    root.setAttribute("aria-hidden", "true");
    root.style.pointerEvents = "none";

    root.querySelectorAll<HTMLElement>("*").forEach((element) => {
        element.style.pointerEvents = "none";
    });

    root.querySelectorAll("button, input, select, textarea, a[href]").forEach((element) => {
        if (
            element instanceof HTMLButtonElement ||
            element instanceof HTMLInputElement ||
            element instanceof HTMLSelectElement ||
            element instanceof HTMLTextAreaElement
        ) {
            element.disabled = true;
        }
        element.setAttribute("tabindex", "-1");
        element.setAttribute("aria-disabled", "true");
    });
}

/**
 * Snapshot a rendered element into a non-interactive copy that fades out, then removes itself.
 */
export function spawnFadingGhost({
    source,
    container,
    durationMs = DEFAULT_GHOST_FADE_MS,
    onMount,
    onUnmount
}: SpawnFadingGhostOptions): SpawnFadingGhostResult {
    const ghost = source.cloneNode(true) as HTMLElement;
    stripIds(ghost);
    ghost.removeAttribute("data-testid");
    makeNonInteractive(ghost);
    ghost.style.opacity = source.style.opacity || "1";
    ghost.style.left = source.style.left;
    ghost.style.top = source.style.top;
    ghost.style.transition = `opacity ${durationMs}ms ease-in-out`;

    container.appendChild(ghost);
    onMount?.(ghost);

    let disposed = false;
    // eslint-disable-next-line prefer-const -- Needs to be assigned after other assignments.
    let timeoutId: number | undefined;
    let rafId: number | undefined;

    const dispose = () => {
        if (disposed) {
            return;
        }
        disposed = true;

        if (rafId !== undefined) {
            cancelAnimationFrame(rafId);
        }
        if (timeoutId !== undefined) {
            window.clearTimeout(timeoutId);
        }

        ghost.removeEventListener("transitionend", onTransitionEnd);
        onUnmount?.(ghost);
        ghost.remove();
    };

    const onTransitionEnd = (event: TransitionEvent) => {
        if (event.target === ghost && event.propertyName === "opacity") {
            dispose();
        }
    };

    ghost.addEventListener("transitionend", onTransitionEnd);

    // Double rAF so the browser paints opacity 1 before transitioning to 0.
    rafId = requestAnimationFrame(() => {
        rafId = requestAnimationFrame(() => {
            rafId = undefined;
            ghost.style.opacity = "0";
        });
    });

    timeoutId = window.setTimeout(dispose, durationMs + 100);

    return { ghost, dispose };
}

/**
 * Fade an element's opacity from 0 to 1.
 */
export function fadeInElement(
    element: HTMLElement,
    durationMs: number = DEFAULT_GHOST_FADE_MS
): void {
    element.style.transition = `opacity ${durationMs}ms ease-in-out`;
    element.style.opacity = "0";
    // Force reflow so the browser registers the starting opacity before transitioning.
    void element.offsetHeight;
    element.style.opacity = "1";
}
