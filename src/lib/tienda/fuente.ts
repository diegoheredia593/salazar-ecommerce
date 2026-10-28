// La Tienda (productos, stock, precios, carrito) con los mismos dos modos que el contenido. Nada de esto entra en la
// caché por versión: la API de la Tienda responde no-store y el stock cambia solo.
import type { Cliente } from '@plataforma/sdk';
import { clientePlataforma, modo } from '../plataforma/cliente';

export type FuenteTienda = Pick<
  Cliente,
  | 'categorias' | 'productos' | 'producto'
  | 'crearCarrito' | 'verCarrito' | 'agregarAlCarrito' | 'cambiarCantidad' | 'quitarDelCarrito' | 'aplicarCodigo' | 'quitarCodigo'
>;

export async function tienda(): Promise<FuenteTienda> {
  if (import.meta.env.DEV && modo() === 'semilla') return (await import('./semilla')).tiendaSemilla;
  modo();
  return clientePlataforma();
}
