import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useState } from 'react';
export function AppLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    return (_jsxs("div", { className: "flex h-screen overflow-hidden bg-background", children: [_jsx(Sidebar, { open: sidebarOpen, onClose: () => setSidebarOpen(false) }), _jsxs("div", { className: "flex flex-col flex-1 min-w-0", children: [_jsx(Header, { onMenuClick: () => setSidebarOpen(o => !o) }), _jsx("main", { className: "flex-1 overflow-auto p-4 md:p-6", children: _jsx(Outlet, {}) })] })] }));
}
