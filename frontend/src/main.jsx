import React from 'react';
import { createRoot } from 'react-dom/client';
import { Configurator } from './app/Configurator.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<Configurator />);
