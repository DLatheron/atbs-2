// import { StrictMode } from 'react';
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { EditorApp } from "./editor/EditorApp.js";
import { RouterProvider, createBrowserRouter } from "react-router-dom";

const root = document.getElementById("root");

if (!root) {
    throw new Error("Root element not found");
}

const router = createBrowserRouter([
    {
        path: "/",
        element: <App />,
        children: []
    },
    {
        path: "/editor",
        element: <EditorApp />,
        children: []
    }
]);

createRoot(root).render(
    // <StrictMode>
    <RouterProvider router={router} />
    // </StrictMode>
);
