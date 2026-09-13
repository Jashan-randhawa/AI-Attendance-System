import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import { useViewMode } from "@/context/ViewModeContext";

const AppLayout = ({ children }: { children: ReactNode }) => {
  const { isFitScreen } = useViewMode();

  return (
    <div className="h-screen max-h-screen flex flex-col md:flex-row overflow-hidden bg-background text-foreground transition-colors duration-200">
      <AppSidebar />
      {/* Scrollable main viewpane fitted to window height */}
      <main className="flex-1 min-w-0 h-full overflow-y-auto overflow-x-hidden pt-20 md:pt-8 pb-16 px-4 sm:px-6 md:px-8 lg:px-10">
        <div
          className={`w-full transition-all duration-300 ${
            isFitScreen ? "max-w-none" : "max-w-7xl mx-auto"
          }`}
        >
          {children}
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
