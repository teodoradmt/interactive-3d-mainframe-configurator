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
- Ollama - local AI runtime used by the backend through `http://127.0.0.1:11434`.
- Mistral - local language model used for AI configuration analysis.
- IBM Z reference data - module labels are modeled around IBM z15, z16, z17, Telum, Telum II, RAIM, FICON, OSA-Express, Crypto Express, and quantum-safe security concepts.

## Current behavior

- The configuration starts empty, so the mainframe door is open.
- Each module has three visible choices instead of a dropdown.
- The first configuration dimension compares IBM z15, IBM z16, and IBM z17 style generations; prices remain project demo values.
- When one option is selected for every module, the frontend asks the backend for the estimate.
- The mainframe door then closes automatically to visualize a completed configuration.
- When a configuration is complete, the user can request a local Mistral analysis through `/api/ai-recommendation`.
- The `Mainframe4o` chatbot can answer free-form business, budget, and workload questions through `/api/mainframe4o-chat`.
