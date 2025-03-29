import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  Plane,
  Map,
  Navigation,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";
import { Button } from "./button";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const navItems = [
    {
      name: "Dashboard",
      href: "/",
      icon: <LayoutDashboard className="h-5 w-5 mr-3" />,
    },
    {
      name: "Drones",
      href: "/drones",
      icon: <Plane className="h-5 w-5 mr-3" />,
    },
    {
      name: "Missions",
      href: "/missions",
      icon: <Map className="h-5 w-5 mr-3" />,
    },
    {
      name: "Mission Planner",
      href: "/mission-planner",
      icon: <Navigation className="h-5 w-5 mr-3" />,
    },
    {
      name: "Analytics",
      href: "/analytics",
      icon: <BarChart3 className="h-5 w-5 mr-3" />,
    },
  ];

  return (
    <aside className={cn("bg-[#1F2937] text-white w-64 flex-shrink-0 hidden md:flex md:flex-col", className)}>
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold">Drone Mission</h1>
        <p className="text-sm text-gray-400">Management System</p>
      </div>
      
      <div className="p-4">
        <div className="mb-4">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Organization</p>
          <p className="font-medium">{user?.name || "Loading..."}</p>
        </div>
        
        <nav>
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Main Menu</p>
          <ul>
            {navItems.map((item) => (
              <li key={item.href} className="mb-1">
                <Link href={item.href}>
                  <div className={cn(
                    "flex items-center p-2 rounded-md cursor-pointer",
                    location === item.href 
                      ? "bg-blue-700 text-white" 
                      : "hover:bg-gray-800 text-gray-300"
                  )}>
                    {item.icon}
                    {item.name}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      
      <div className="mt-auto p-4 border-t border-gray-700">
        <Link href="/settings">
          <div className="flex items-center p-2 rounded-md hover:bg-gray-800 text-gray-300 cursor-pointer">
            <Settings className="h-5 w-5 mr-3" />
            Settings
          </div>
        </Link>
        <Button 
          variant="ghost" 
          className="flex items-center p-2 rounded-md hover:bg-gray-800 text-gray-300 mt-2 w-full justify-start"
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
        >
          <LogOut className="h-5 w-5 mr-3" />
          Logout
        </Button>
      </div>
    </aside>
  );
}
