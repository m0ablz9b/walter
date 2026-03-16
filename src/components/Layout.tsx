import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/", label: "Transactions" },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/tax", label: "Tax Report" },
  { to: "/settings", label: "Settings" },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-indigo-600">Walter</span>
              <span className="text-sm text-gray-400">Your discreet crypto assistant, guaranteed leak-free.</span>
            </div>
            <div className="flex gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-indigo-100 text-indigo-700"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      </nav>
      <main className="px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-gray-200 py-4 text-center text-xs text-gray-400">
        Walter is free software released under the{" "}
        <a
          href="https://www.gnu.org/licenses/gpl-3.0.html"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-600"
        >
          GNU GPL v3
        </a>
        .
      </footer>
    </div>
  );
}
