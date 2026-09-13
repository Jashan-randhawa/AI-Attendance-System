import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface ViewModeContextType {
  isFitScreen: boolean;
  isFullscreen: boolean;
  toggleFitScreen: () => void;
  setFitScreen: (fit: boolean) => void;
  toggleFullscreen: () => void;
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

const STORAGE_KEY = "smart-attend-fit-view";

export const ViewModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isFitScreen, setIsFitScreenState] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    // Default to true (fit screen) for modern full-viewport dashboard experience
    return saved !== null ? saved === "true" : true;
  });

  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    return !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );
  });

  const setFitScreen = useCallback((fit: boolean) => {
    setIsFitScreenState(fit);
    localStorage.setItem(STORAGE_KEY, String(fit));
  }, []);

  const toggleFitScreen = useCallback(() => {
    setIsFitScreenState((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (
        !document.fullscreenElement &&
        !(document as any).webkitFullscreenElement &&
        !(document as any).mozFullScreenElement &&
        !(document as any).msFullscreenElement
      ) {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if ((docEl as any).webkitRequestFullscreen) {
          await (docEl as any).webkitRequestFullscreen();
        } else if ((docEl as any).mozRequestFullScreen) {
          await (docEl as any).mozRequestFullScreen();
        } else if ((docEl as any).msRequestFullscreen) {
          await (docEl as any).msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn("Fullscreen toggle error or permission denied:", err);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(active);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === "INPUT" ||
        activeEl?.tagName === "TEXTAREA" ||
        (activeEl as HTMLElement)?.isContentEditable;

      if (!isInput && (e.key === "f" || e.key === "F") && (e.shiftKey || e.altKey)) {
        e.preventDefault();
        toggleFitScreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [toggleFitScreen]);

  return (
    <ViewModeContext.Provider
      value={{
        isFitScreen,
        isFullscreen,
        toggleFitScreen,
        setFitScreen,
        toggleFullscreen,
      }}
    >
      {children}
    </ViewModeContext.Provider>
  );
};

export const useViewMode = (): ViewModeContextType => {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error("useViewMode must be used within a ViewModeProvider");
  }
  return context;
};
