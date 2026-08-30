// Punto de entrada de la guía de estilo. Aparte del de la aplicación a propósito:
// /galeria.html no arrastra Firebase ni el enrutado, y así se puede abrir sin sesión.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Galeria from './ui/Galeria';

createRoot(document.getElementById('galeria')).render(
  <StrictMode>
    <Galeria />
  </StrictMode>
);
