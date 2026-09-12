import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";

const AppLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-200">
      <AppSidebar />
      {/* pt-20 on mobile offsets the fixed bar; pt-8 md:pt-10 pb-20 provides generous margins above and below */}
      <main className="flex-1 overflow-y-auto min-h-screen pt-20 md:pt-10 pb-20 px-4 sm:px-8 md:px-10 lg:px-12">
        <div className="max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
