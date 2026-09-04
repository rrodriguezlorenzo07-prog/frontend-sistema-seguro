// @ts-check
/**
 * Catálogo de cuadrillas: grupos estables de operarios.
 *
 * OJO CON EL NOMBRE. Esto no es el array `cuadrilla` que la oficina arma al validar un
 * parte: aquel se compone DESPUÉS del trabajo y lleva horas extra por operario. Esto es
 * el grupo que se asigna ANTES, y no sabe nada de horas ni de nóminas.
 */
import { useState } from 'react';
import { Users, Trash2, Plus, X } from 'lucide-react';

import { color, texto, peso, interletra, espacio, radio } from '../../estilos/tokens';
import Boton from '../../ui/Boton';
import Tarjeta from '../../ui/Tarjeta';
import Campo from '../../ui/Campo';
import Etiqueta from '../../ui/Etiqueta';
import Insignia from '../../ui/Insignia';

export default function GestionCuadrillas({
    blockStyle,
    cuadrillasList,
    trabajadoresActivos,
    crearCuadrilla,
    actualizarOperariosCuadrilla,
    borrarCuadrilla
}) {
    const [nombreNueva, setNombreNueva] = useState('');
    const [anadiendoEn, setAnadiendoEn] = useState(null);
    const [operarioAAnadir, setOperarioAAnadir] = useState('');

    const anadirOperario = (cuadrilla) => {
        const ficha = trabajadoresActivos.find((t) => t.id === operarioAAnadir);
        if (!ficha) return;
        // Sin correo el operario nunca podrá ver su asignación: las reglas comparan
        // contra el token de sesión, que se identifica por correo.
        if (!ficha.email) return;
        if ((cuadrilla.operarios || []).some((o) => o.trabajadorId === ficha.id)) return;

        const operarios = [
            ...(cuadrilla.operarios || []),
            { trabajadorId: ficha.id, nombre: ficha.nombre, email: String(ficha.email).toLowerCase().trim() }
        ];
        actualizarOperariosCuadrilla(cuadrilla.id, operarios);
        setOperarioAAnadir('');
        setAnadiendoEn(null);
    };

    const quitarOperario = (cuadrilla, trabajadorId) => {
        actualizarOperariosCuadrilla(
            cuadrilla.id,
            (cuadrilla.operarios || []).filter((o) => o.trabajadorId !== trabajadorId)
        );
    };

    const sinCorreo = trabajadoresActivos.filter((t) => !t.email).length;

    return (
        <div style={blockStyle}>
            <h3 style={{
                margin: `0 0 ${espacio.xs}`, fontSize: texto.titulo, fontWeight: peso.normal,
                letterSpacing: interletra.titulo, textTransform: 'uppercase'
            }}>
                Cuadrillas
            </h3>
            <p style={{
                color: color.textoSuave, fontSize: texto.menor, letterSpacing: interletra.etiqueta,
                textTransform: 'uppercase', marginBottom: espacio.xl
            }}>
                Grupos que se asignan al cuadrante. No afectan a la nómina.
            </p>

            {/* ---------------------------------------------------------- alta */}
            <div style={{ display: 'flex', gap: espacio.sm, marginBottom: espacio.xl, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '220px' }}>
                    <Campo
                        etiqueta="Nombre de la cuadrilla"
                        value={nombreNueva}
                        onChange={(e) => setNombreNueva(e.target.value)}
                        placeholder="Cuadrilla A"
                        onKeyDown={(e) => { if (e.key === 'Enter' && nombreNueva.trim()) { crearCuadrilla(nombreNueva.trim()); setNombreNueva(''); } }}
                    />
                </div>
                <Boton
                    disabled={!nombreNueva.trim()}
                    onClick={() => { crearCuadrilla(nombreNueva.trim()); setNombreNueva(''); }}
                >
                    <Plus size={16} /> Crear
                </Boton>
            </div>

            {sinCorreo > 0 && (
                <Tarjeta tono="tenida" style={{ marginBottom: espacio.lg, borderLeft: `3px solid ${color.aviso}` }}>
                    <p style={{ margin: 0, fontSize: texto.menor, color: color.aviso }}>
                        Hay {sinCorreo} {sinCorreo === 1 ? 'trabajador' : 'trabajadores'} sin correo.
                        No se pueden añadir a una cuadrilla: sin correo no hay forma de que vean su
                        asignación en el móvil.
                    </p>
                </Tarjeta>
            )}

            {/* -------------------------------------------------------- listado */}
            {cuadrillasList.length === 0 ? (
                <Tarjeta tono="hundida">
                    <p style={{ margin: 0, fontSize: texto.base, color: color.textoSuave }}>
                        Todavía no hay cuadrillas. Crea la primera para poder planificar.
                    </p>
                </Tarjeta>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: espacio.md }}>
                    {cuadrillasList.map((cuadrilla) => {
                        const operarios = cuadrilla.operarios || [];
                        const disponibles = trabajadoresActivos.filter(
                            (t) => t.email && !operarios.some((o) => o.trabajadorId === t.id)
                        );

                        return (
                            <Tarjeta key={cuadrilla.id}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: espacio.sm, marginBottom: espacio.md }}>
                                    <Users size={18} style={{ color: color.vidrio, flexShrink: 0, marginTop: '2px' }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <h4 style={{
                                            margin: 0, fontSize: texto.medio, fontWeight: peso.fuerte,
                                            letterSpacing: interletra.titulo
                                        }}>
                                            {cuadrilla.nombre}
                                        </h4>
                                        <Insignia tono={operarios.length === 0 ? 'aviso' : 'neutra'} style={{ marginTop: espacio.xxs }}>
                                            {operarios.length === 0
                                                ? 'Sin operarios'
                                                : `${operarios.length} ${operarios.length === 1 ? 'operario' : 'operarios'}`}
                                        </Insignia>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => borrarCuadrilla(cuadrilla.id)}
                                        aria-label={`Eliminar ${cuadrilla.nombre}`}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: color.textoTenue, padding: espacio.xxs, lineHeight: 0 }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <Etiqueta>Operarios</Etiqueta>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: espacio.xs, margin: `${espacio.xs} 0 ${espacio.md}` }}>
                                    {operarios.length === 0 ? (
                                        <span style={{ fontSize: texto.menor, color: color.textoTenue }}>
                                            Añade operarios para poder asignarla.
                                        </span>
                                    ) : operarios.map((op) => (
                                        <span
                                            key={op.trabajadorId}
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: espacio.xxs,
                                                background: color.superficieTenida, border: `1px solid ${color.linea}`,
                                                borderRadius: radio.sutil, padding: `${espacio.xxs} ${espacio.xs}`,
                                                fontSize: texto.menor
                                            }}
                                        >
                                            {op.nombre}
                                            <button
                                                type="button"
                                                onClick={() => quitarOperario(cuadrilla, op.trabajadorId)}
                                                aria-label={`Quitar a ${op.nombre}`}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: color.textoTenue, padding: 0, lineHeight: 0 }}
                                            >
                                                <X size={13} />
                                            </button>
                                        </span>
                                    ))}
                                </div>

                                {anadiendoEn === cuadrilla.id ? (
                                    <div style={{ display: 'flex', gap: espacio.xs, alignItems: 'flex-end' }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <Campo
                                                como="select"
                                                value={operarioAAnadir}
                                                onChange={(e) => setOperarioAAnadir(e.target.value)}
                                            >
                                                <option value="">Elegir operario…</option>
                                                {disponibles.map((t) => (
                                                    <option key={t.id} value={t.id}>{t.nombre}</option>
                                                ))}
                                            </Campo>
                                        </div>
                                        <Boton tamano="pequeno" disabled={!operarioAAnadir} onClick={() => anadirOperario(cuadrilla)}>
                                            Añadir
                                        </Boton>
                                        <Boton tamano="pequeno" variante="fantasma" onClick={() => { setAnadiendoEn(null); setOperarioAAnadir(''); }}>
                                            Cancelar
                                        </Boton>
                                    </div>
                                ) : (
                                    <Boton
                                        tamano="pequeno"
                                        variante="secundario"
                                        disabled={disponibles.length === 0}
                                        onClick={() => { setAnadiendoEn(cuadrilla.id); setOperarioAAnadir(''); }}
                                    >
                                        <Plus size={14} /> {disponibles.length === 0 ? 'Nadie disponible' : 'Añadir operario'}
                                    </Boton>
                                )}
                            </Tarjeta>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
