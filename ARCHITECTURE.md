# Mainframe 3D Configurator Architecture

## Architectural style

The project now follows a small feature/layered frontend architecture:

- `frontend/src/app` - application state and page composition.
- `frontend/src/components` - reusable UI and 3D presentation components.
- `frontend/src/config` - presentation metadata and Blender/GLB asset registration.
- `frontend/src/services` - API calls to the backend.
- `frontend/src/utils` - formatting helpers.
- `backend` - Node.js HTTP API and mainframe pricing/domain data.

This keeps business data, API communication, React state, UI controls, and Three.js rendering in separate layers.

## Technologies

- React 19 - component-based frontend.
- Vite 7 - local dev server and production build.
- Three.js - 3D rendering engine.
- @react-three/fiber - React renderer for Three.js.
- @react-three/drei - helpers for controls, environment lighting, HTML labels, shadows, and GLB loading.
- Lucide React - UI icons.
- Node.js HTTP module - lightweight backend API.
- JavaScript ES modules - frontend and backend module system.
- CSS3 - responsive layout, component styling, transitions, and interaction states.
- Blender/glTF workflow - exported `.glb` files can be registered in `frontend/src/config/blenderAssets.js`.

## Current behavior

- The configuration starts empty, so the mainframe door is open.
- Each module has three visible choices instead of a dropdown.
- When one option is selected for every module, the frontend asks the backend for the estimate.
- The mainframe door then closes automatically to visualize a completed configuration.
