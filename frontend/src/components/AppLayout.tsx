import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";

const AppLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      {/* pt-16 on mobile offsets the fixed top bar; md:pt-0 removes it on desktop */}
      <main className="flex-1 overflow-auto pt-16 md:pt-0 p-4 sm:p-6 md:p-8">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
