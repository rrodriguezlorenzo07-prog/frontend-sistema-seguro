// @ts-check
/**
 * Guía de estilo viva. Se sirve en /galeria.html y no forma parte de la aplicación:
 * ningún archivo de src/components la importa.
 *
 * Sirve para dos cosas: ver las primitivas juntas antes de aplicarlas a las pantallas
 * reales, y tener después un sitio donde comprobar que un cambio en los tokens no
 * rompe nada sin tener que recorrer las diez pestañas.
 */
import { useState } from 'react';
import { Lock, FileSpreadsheet, Trash2, PencilLine, Plus } from 'lucide-react';
import { color, texto, peso, interletra, espacio, fuente } from '../estilos/tokens';
import Boton from './Boton';
import Tarjeta from './Tarjeta';
import Campo from './Campo';
import Etiqueta from './Etiqueta';
import Insignia from './Insignia';
import Modal from './Modal';

const Seccion = ({ titulo, nota, children }) => (
    <section style={{ marginTop: espacio.xxl }}>
        <h2 style={{
            margin: 0, fontSize: texto.mayor, fontWeight: peso.fuerte,
            letterSpacing: interletra.titulo, color: color.texto,
            paddingBottom: espacio.xs, borderBottom: `1px solid ${color.linea}`
        }}>{titulo}</h2>
        {nota && <p style={{ margin: `${espacio.sm} 0 0`, fontSize: texto.base, color: color.textoSuave, maxWidth: '62ch', lineHeight: 1.55 }}>{nota}</p>}
        <div style={{ marginTop: espacio.lg }}>{children}</div>
    </section>
);

const Fila = ({ children }) => (
    <div style={{ display: 'flex', gap: espacio.sm, flexWrap: 'wrap', alignItems: 'center' }}>{children}</div>
);

export default function Galeria() {
    const [modalAbierto, setModalAbierto] = useState(false);

    return (
        <div style={{
            fontFamily: fuente.familia,
            backgroundColor: color.fondo,
            color: color.texto,
            minHeight: '100vh',
            padding: `${espacio.xxl} ${espacio.lg} ${espacio.xxxl}`
        }}>
            <div style={{ maxWidth: '1040px', margin: '0 auto' }}>

                <header style={{ paddingBottom: espacio.lg, borderBottom: `2px solid ${color.petroleo}` }}>
                    <Etiqueta tenue>Dirección Vidrio · Fase 2</Etiqueta>
                    <h1 style={{
                        margin: `${espacio.xs} 0 0`, fontSize: '42px', fontWeight: peso.maximo,
                        letterSpacing: interletra.titulo, lineHeight: 1.05, color: color.petroleo
                    }}>Primitivas</h1>
                    <p style={{ margin: `${espacio.sm} 0 0`, fontSize: texto.medio, color: color.textoSuave, maxWidth: '58ch', lineHeight: 1.55 }}>
                        Seis piezas construidas sobre los tokens. Todavía no se ha tocado ninguna pantalla
                        de la aplicación: esto es solo para ver cómo queda.
                    </p>
                </header>

                <Seccion titulo="Botón" nota="Cuatro variantes y tres tamaños. El amplio es el de campo: pensado para pulsarlo de pie y con guantes.">
                    <Fila>
                        <Boton>Cerrar nómina</Boton>
                        <Boton variante="secundario">Exportar</Boton>
                        <Boton variante="fantasma">Cancelar</Boton>
                        <Boton variante="peligro">Rechazar parte</Boton>
                    </Fila>
                    <div style={{ marginTop: espacio.md }}>
                        <Fila>
                            <Boton tamano="pequeno" variante="secundario"><Plus size={12} /> Añadir</Boton>
                            <Boton tamano="normal"><Lock size={14} /> Normal</Boton>
                            <Boton tamano="amplio">Enviar parte</Boton>
                            <Boton disabled>Deshabilitado</Boton>
                        </Fila>
                    </div>
                </Seccion>

                <Seccion titulo="Tarjeta" nota="Cinco tonos con un papel definido cada uno. Antes había seis bordes distintos y ninguna nota sobre qué significaba cada uno.">
                    <div style={{ display: 'grid', gap: espacio.md, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                        <Tarjeta><Etiqueta>Blanca</Etiqueta><span style={{ fontSize: texto.base, color: color.textoSuave }}>El contenedor por defecto</span></Tarjeta>
                        <Tarjeta tono="tenida"><Etiqueta>Teñida</Etiqueta><span style={{ fontSize: texto.base, color: color.textoSuave }}>Agrupa sin separar del fondo</span></Tarjeta>
                        <Tarjeta tono="hundida"><Etiqueta>Hundida</Etiqueta><span style={{ fontSize: texto.base, color: color.textoSuave }}>Zonas que reciben contenido</span></Tarjeta>
                        <Tarjeta tono="fuerte"><Etiqueta>Fuerte</Etiqueta><span style={{ fontSize: texto.base, color: color.textoSuave }}>Énfasis; se usa poco</span></Tarjeta>
                        <Tarjeta tono="oscura"><Etiqueta style={{ color: color.canto }}>Oscura</Etiqueta><span style={{ fontSize: texto.base, color: color.textoSobreOscuro }}>Totales y cabeceras</span></Tarjeta>
                    </div>
                </Seccion>

                <Seccion titulo="Campo" nota="Etiqueta, control, ayuda y error en una sola pieza. El foco pasa a ser el verde de vidrio, no el azul genérico de antes.">
                    <div style={{ display: 'grid', gap: espacio.md, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                        <Campo etiqueta="Obra" defaultValue="Hotel Meliá" ayuda="Selecciona del catálogo o escribe a mano" />
                        <Campo etiqueta="Días de ausencia" type="number" defaultValue={2} ayuda="Resta 8 h por día" />
                        <Campo etiqueta="Correo del trabajador" defaultValue="sin-arroba" error="No parece una dirección de correo válida" />
                        <Campo etiqueta="Tarifa extra (€/h)" tamano="amplio" defaultValue="15" ayuda="Tamaño amplio, para móvil" />
                    </div>
                    <div style={{ marginTop: espacio.md }}>
                        <Campo etiqueta="Notas de ejecución" como="textarea" defaultValue="Sustitución de tres hojas en la fachada norte. Falta el remate de silicona." />
                    </div>
                </Seccion>

                <Seccion titulo="Insignia" nota="El color aquí es estado, no decoración. Sustituye a las cinco que estaban escritas a mano por separado.">
                    <Fila>
                        <Insignia>Por defecto</Insignia>
                        <Insignia tono="info">Pendiente</Insignia>
                        <Insignia tono="exito">Aprobado</Insignia>
                        <Insignia tono="error">Rechazado</Insignia>
                        <Insignia tono="aviso"><PencilLine size={9} /> Manual</Insignia>
                        <Insignia tono="fuerte">2 versiones</Insignia>
                    </Fila>
                </Seccion>

                <Seccion titulo="Modal" nota="Una sola implementación. Cierra con Escape, bloquea el scroll del fondo y la capa cierra al pulsarla; ninguna de las seis anteriores hacía nada de eso.">
                    <Boton variante="secundario" onClick={() => setModalAbierto(true)}>Abrir modal</Boton>
                    <Modal
                        abierto={modalAbierto}
                        titulo="Cerrar agosto de 2026"
                        descripcion="Un cierre no se puede modificar ni borrar. Para corregirlo se emite una versión nueva."
                        onCerrar={() => setModalAbierto(false)}
                        acciones={<>
                            <Boton variante="fantasma" onClick={() => setModalAbierto(false)}>Cancelar</Boton>
                            <Boton onClick={() => setModalAbierto(false)}><Lock size={14} /> Cerrar nómina</Boton>
                        </>}
                    >
                        <div style={{ display: 'grid', gap: espacio.sm }}>
                            <Tarjeta tono="tenida" relleno="ajustado">
                                <Etiqueta>Resumen</Etiqueta>
                                <div style={{ fontSize: texto.base, color: color.textoSuave, lineHeight: 1.6 }}>
                                    4 trabajadores · 3.262,50 € · 2 ajustes manuales<br />
                                    Calculado sobre 38 albaranes aprobados del mes completo.
                                </div>
                            </Tarjeta>
                            <div style={{ fontSize: texto.base, color: color.aviso, lineHeight: 1.55 }}>
                                Es un mes ya pasado: se usan las fichas y tarifas de hoy, no las de entonces.
                            </div>
                        </div>
                    </Modal>
                </Seccion>

                <Seccion titulo="Juntas" nota="Una tarjeta de nómina reconstruida con las primitivas, para ver el conjunto en su sitio y no pieza a pieza.">
                    <div style={{ display: 'grid', gap: espacio.md, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
                        <Tarjeta>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: espacio.xs, paddingBottom: espacio.sm, borderBottom: `1px solid ${color.lineaSuave}` }}>
                                <span style={{ fontSize: texto.medio, fontWeight: peso.fuerte, letterSpacing: interletra.titulo }}>Julián Rodríguez</span>
                                <Insignia tono="aviso"><PencilLine size={9} /> Manual</Insignia>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: espacio.md }}>
                                <Etiqueta style={{ margin: 0 }}>Base mensual</Etiqueta>
                                <span style={{ fontSize: texto.base, fontWeight: peso.fuerte }}>160 h</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: espacio.sm, marginTop: espacio.md }}>
                                <Campo etiqueta="H. normales" defaultValue="152" />
                                <Campo etiqueta="H. extras" defaultValue="5,5" />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: espacio.lg, paddingTop: espacio.sm, borderTop: `1px solid ${color.lineaSuave}` }}>
                                <Etiqueta style={{ margin: 0 }}>Total a pagar</Etiqueta>
                                <span style={{ fontSize: texto.cifra, fontWeight: peso.maximo, letterSpacing: interletra.titulo, fontVariantNumeric: fuente.cifras, color: color.petroleo }}>1.602,50 €</span>
                            </div>
                        </Tarjeta>

                        <Tarjeta tono="oscura" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                                <Etiqueta style={{ color: color.canto }}>Total a liquidar en plantilla</Etiqueta>
                                <div style={{ fontSize: '38px', fontWeight: peso.maximo, letterSpacing: interletra.titulo, fontVariantNumeric: fuente.cifras, lineHeight: 1.1 }}>3.262,50 €</div>
                                <div style={{ fontSize: texto.base, color: color.canto, marginTop: espacio.xxs }}>4 empleados · agosto de 2026</div>
                            </div>
                            <div style={{ display: 'flex', gap: espacio.xs, marginTop: espacio.lg, flexWrap: 'wrap' }}>
                                <Boton variante="secundario" style={{ borderColor: color.canto, color: color.textoSobreOscuro }}><FileSpreadsheet size={14} /> Excel</Boton>
                                <Boton variante="secundario" style={{ borderColor: color.canto, color: color.textoSobreOscuro }}><Lock size={14} /> Cerrar</Boton>
                            </div>
                        </Tarjeta>

                        <Tarjeta tono="hundida">
                            <Etiqueta>Parte pendiente</Etiqueta>
                            <div style={{ fontSize: texto.base, color: color.textoSuave, lineHeight: 1.6 }}>
                                Hotel Meliá · Hab 101–105<br />Enviado hoy a las 08:45
                            </div>
                            <div style={{ display: 'flex', gap: espacio.xs, marginTop: espacio.md, flexWrap: 'wrap' }}>
                                <Insignia tono="info">Pendiente</Insignia>
                                <Insignia>3 materiales</Insignia>
                            </div>
                            <div style={{ display: 'flex', gap: espacio.xs, marginTop: espacio.md }}>
                                <Boton tamano="pequeno">Validar</Boton>
                                <Boton tamano="pequeno" variante="peligro"><Trash2 size={12} /> Rechazar</Boton>
                            </div>
                        </Tarjeta>
                    </div>
                </Seccion>

                <div style={{ marginTop: espacio.xxxl, paddingTop: espacio.lg, borderTop: `1px solid ${color.linea}`, fontSize: texto.menor, color: color.textoTenue, letterSpacing: interletra.etiqueta, textTransform: 'uppercase', fontWeight: peso.fuerte }}>
                    Guía de estilo · no forma parte de la aplicación
                </div>
            </div>
        </div>
    );
}
