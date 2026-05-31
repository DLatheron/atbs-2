// import { StrictMode } from 'react';
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { Container } from "@mui/material";

const root = document.getElementById("root");

if (!root) {
    throw new Error("Root element not found");
}

const router = createBrowserRouter([
    {
        path: "/",
        element: <App />,
        children: []
    }
]);

createRoot(root).render(
    // <StrictMode>
    <Container
        data-testid="root"
        maxWidth={false}
        sx={{ m: 0, p: 0, width: "100vw", height: "100vh" }}
    >
        <RouterProvider router={router} />
    </Container>
    // </StrictMode>
);
