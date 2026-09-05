// @ts-check
/**
 * El catálogo de categorías del convenio: cuánto vale un día y cuánto una hora extra.
 *
 * DETRÁS DE veNominas. Son las tarifas de la empresa, no un catálogo operativo como las
 * cuadrillas o las furgonetas: quien no puede ver lo que se paga tampoco ve la tabla que
 * dice cuánto se paga. PanelOficina ni siquiera monta esta pantalla sin ese permiso.
 *
 * SIN NINGUNA CIFRA EN EL CÓDIGO. Las tablas del convenio se revisan cada año por la
 * cláusula del IPC: aquí se teclean, y actualizar una subida es cambiar dos números en
 * esta pantalla.
 *
 * FASE 1: esto mantiene el catálogo. Todavía no lo usa ningún cálculo — la nómina sigue
 * saliendo del modelo de horas, sin tocar.
 */
import { useState } from 'react';
import { Plus, Trash2, Pencil, Euro, AlertTriangle } from 'lucide-react';

import { color, texto, peso, interletra, espacio } from '../../estilos/tokens';
import Boton from '../../ui/Boton';
import Tarjeta from '../../ui/Tarjeta';
import Campo from '../../ui/Campo';
import Etiqueta from '../../ui/Etiqueta';
import Insignia from '../../ui/Insignia';
import { validarCategoria, categoriasActivas, usoDeCategoria } from '../../logica/categorias';

const VACIO = { nombre: '', tarifaDiaria: '', tarifaHoraExtra: '' };

/** Importe con dos decimales y coma, como se escribe en España. */
const euros = (n) => `${(Number(n) || 0).toFixed(2).replace('.', ',')} €`;

export default function CategoriasProfesionales({
    blockStyle,
    categoriasList,
    trabajadoresList,
    crearCategoria,
    editarCategoria,
    borrarCategoria,
    guardandoCategoria
}) {
    const [form, setForm] = useState(VACIO);
    const [editandoId, setEditandoId] = useState(null);
    const [error, setError] = useState('');

    const activas = categoriasActivas(categoriasList);

    const cancelar = () => { setForm(VACIO); setEditandoId(null); setError(''); };

    const guardar = () => {
        const { valida, motivo } = validarCategoria(form, categoriasList, editandoId);
        if (!valida) { setError(motivo); return; }
        if (editandoId) editarCategoria(editandoId, form);
        else crearCategoria(form);
        cancelar();
    };

    const empezarEdicion = (categoria) => {
        setEditandoId(categoria.id);
        setError('');
        setForm({
            nombre: categoria.nombre ?? '',
            // Se pasan a texto con coma: es lo que la persona escribió y lo que espera ver.
            tarifaDiaria: String(categoria.tarifaDiaria ?? '').replace('.', ','),
            tarifaHoraExtra: String(categoria.tarifaHoraExtra ?? '').replace('.', ',')
        });
    };

    return (
        <div style={blockStyle}>
            <h3 style={{
                margin: `0 0 ${espacio.xs}`, fontSize: texto.titulo, fontWeight: peso.normal,
                letterSpacing: interletra.titulo, textTransform: 'uppercase'
            }}>
                Categorías profesionales
            </h3>
            <p style={{
                color: color.textoSuave, fontSize: texto.menor, letterSpacing: interletra.etiqueta,
                textTransform: 'uppercase', marginBottom: espacio.xl
            }}>
                Las tarifas del convenio. Se revisan cada año.
            </p>

            {/* ------------------------------------------------ alta y edición */}
            <Tarjeta style={{ marginBottom: espacio.lg }}>
                <Etiqueta>{editandoId ? 'Editar categoría' : 'Nueva categoría'}</Etiqueta>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: espacio.sm, marginTop: espacio.sm }}>
                    <Campo
                        etiqueta="Nombre"
                        value={form.nombre}
                        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                        placeholder="Oficial 1ª"
                    />
                    <Campo
                        etiqueta="Tarifa diaria (€)"
                        ayuda="Lo que se paga por día trabajado."
                        inputMode="decimal"
                        value={form.tarifaDiaria}
                        onChange={(e) => setForm({ ...form, tarifaDiaria: e.target.value })}
                        placeholder="95,40"
                    />
                    <Campo
                        etiqueta="Tarifa hora extra (€)"
                        ayuda="También depende de la categoría."
                        inputMode="decimal"
                        value={form.tarifaHoraExtra}
                        onChange={(e) => setForm({ ...form, tarifaHoraExtra: e.target.value })}
                        placeholder="14,20"
                    />
                </div>

                {error && (
                    <p style={{ margin: `${espacio.sm} 0 0`, fontSize: texto.menor, color: color.error, fontWeight: peso.medio }}>
                        {error}
                    </p>
                )}

                <div style={{ marginTop: espacio.md, display: 'flex', gap: espacio.xs, flexWrap: 'wrap' }}>
                    <Boton onClick={guardar} disabled={guardandoCategoria}>
                        <Plus size={16} /> {guardandoCategoria ? 'Guardando…' : (editandoId ? 'Guardar cambios' : 'Añadir categoría')}
                    </Boton>
                    {editandoId && (
                        <Boton variante="secundario" onClick={cancelar}>Cancelar</Boton>
                    )}
                </div>
            </Tarjeta>

            {/* ------------------------------------------------------ listado */}
            {activas.length === 0 ? (
                <Tarjeta tono="hundida">
                    <p style={{ margin: 0, fontSize: texto.base, color: color.textoSuave }}>
                        Todavía no hay ninguna categoría. Añade las del convenio para poder
                        asignárselas a la plantilla.
                    </p>
                </Tarjeta>
            ) : (
                <Tarjeta relleno="ninguno">
                    {activas.map((c, i) => {
                        const enUso = usoDeCategoria(c.id, trabajadoresList);
                        return (
                            <div
                                key={c.id}
                                style={{
                                    display: 'flex', alignItems: 'flex-start', gap: espacio.sm,
                                    padding: `${espacio.sm} ${espacio.md}`,
                                    borderTop: i === 0 ? 'none' : `1px solid ${color.lineaSuave}`,
                                    flexWrap: 'wrap'
                                }}
                            >
                                <Euro size={17} style={{ color: color.vidrio, flexShrink: 0, marginTop: '3px' }} />

                                <div style={{ flex: 1, minWidth: '180px' }}>
                                    <div style={{ fontSize: texto.base, fontWeight: peso.medio }}>{c.nombre}</div>
                                    <div style={{ fontSize: texto.menor, color: color.textoSuave, marginTop: '2px' }}>
                                        {euros(c.tarifaDiaria)} por día · {euros(c.tarifaHoraExtra)} por hora extra
                                    </div>
                                    <div style={{ display: 'flex', gap: espacio.xs, alignItems: 'center', marginTop: espacio.xxs, flexWrap: 'wrap' }}>
                                        <Insignia tono={enUso > 0 ? 'info' : 'neutra'}>
                                            {enUso === 0 ? 'Sin asignar' : `${enUso} ${enUso === 1 ? 'trabajador' : 'trabajadores'}`}
                                        </Insignia>
                                        {c.actualizadoPor ? (
                                            <span style={{ fontSize: texto.micro, color: color.textoTenue }}>
                                                último cambio: {c.actualizadoPor}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: espacio.xs, alignItems: 'center' }}>
                                    <Boton tamano="pequeno" variante="secundario" onClick={() => empezarEdicion(c)}>
                                        <Pencil size={13} /> Editar
                                    </Boton>
                                    <button
                                        type="button"
                                        onClick={() => borrarCategoria(c.id, c.nombre, enUso)}
                                        aria-label={`Quitar ${c.nombre}`}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: color.textoTenue, padding: espacio.xxs, lineHeight: 0 }}
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </Tarjeta>
            )}

            <div style={{ marginTop: espacio.md, display: 'flex', gap: espacio.xs, alignItems: 'flex-start' }}>
                <AlertTriangle size={14} color={color.textoTenue} style={{ flexShrink: 0, marginTop: '2px' }} />
                <p style={{ margin: 0, fontSize: texto.menor, color: color.textoTenue, lineHeight: 1.5 }}>
                    Cambiar una tarifa afecta a lo que se calcule <strong>de aquí en adelante</strong>.
                    Las liquidaciones ya cerradas guardan dentro la tarifa que se les aplicó
                    y no se recalculan nunca.
                </p>
            </div>
        </div>
    );
}
