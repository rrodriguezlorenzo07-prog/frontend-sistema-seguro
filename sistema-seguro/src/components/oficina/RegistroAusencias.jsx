// @ts-check
/**
 * Los días que alguien no vino, registrados uno a uno.
 *
 * POR QUÉ EXISTE. Hasta ahora las ausencias eran un número tecleado en la pantalla de
 * nóminas al cerrar el mes, y se perdían al cambiar de mes: lo único que quedaba era la
 * cifra congelada dentro del cierre. Nadie podía responder en octubre por qué a alguien
 * se le descontaron tres días en julio. Con la tarifa diaria cada ausencia vale una
 * jornada entera, así que pasa a ser un registro con autor, fecha y motivo.
 *
 * NO SE PUEDE REGISTRAR EN SÁBADO NI EN DOMINGO. Es lo que hace viable el modelo de días
 * naturales sin un calendario laboral: si el mes se paga como 30 días fijos, faltar un
 * sábado no descuenta nada. La comprobación vive en logica/ausencias.js y el formulario
 * la aplica antes de escribir; el input además no deja elegirlos.
 *
 * DETRÁS DE veNominas, como las categorías: quien no puede ver lo que se paga tampoco
 * decide quién falta.
 *
 * FASE 1: esto registra. El cálculo de la nómina todavía NO lo lee — ControlNominas
 * sigue con su contador tecleado a mano, sin tocar.
 */
import { useState, useMemo } from 'react';
import { CalendarOff, Plus, Trash2, User } from 'lucide-react';

import { color, texto, peso, interletra, espacio } from '../../estilos/tokens';
import Boton from '../../ui/Boton';
import Tarjeta from '../../ui/Tarjeta';
import Campo from '../../ui/Campo';
import Etiqueta from '../../ui/Etiqueta';
import Insignia from '../../ui/Insignia';
import {
    TIPOS, NOMBRES_TIPO, validarAusencia, esFinDeSemana, nombreDelDia, ausenciasDe
} from '../../logica/ausencias';

const TONO = { falta: 'aviso', vacaciones: 'info', baja: 'error', permiso: 'neutra', otro: 'neutra' };

const hoyISO = () => new Date().toISOString().slice(0, 10);

export default function RegistroAusencias({
    blockStyle,
    trabajadoresList,
    ausenciasList,
    trabajadorAusencias,
    setTrabajadorAusencias,
    crearAusencia,
    borrarAusencia,
    guardandoAusencia
}) {
    const [form, setForm] = useState({ fecha: hoyISO(), tipo: 'falta', motivo: '' });
    const [error, setError] = useState('');

    const trabajador = trabajadoresList.find((t) => t.id === trabajadorAusencias);
    const suyas = useMemo(
        () => ausenciasDe(ausenciasList, trabajadorAusencias),
        [ausenciasList, trabajadorAusencias]
    );

    // Se avisa MIENTRAS se teclea, no solo al enviar: enterarse de que el día no vale
    // después de rellenar el motivo es enterarse tarde.
    const avisoFinDeSemana = form.fecha && esFinDeSemana(form.fecha)
        ? `El ${form.fecha} es ${nombreDelDia(form.fecha)}: los fines de semana no se trabajan y no hay nada que descontar.`
        : '';

    const registrar = () => {
        const datos = { trabajadorId: trabajadorAusencias, fecha: form.fecha, tipo: form.tipo };
        const { valida, motivo } = validarAusencia(datos, ausenciasList);
        if (!valida) { setError(motivo); return; }

        crearAusencia({
            ...datos,
            trabajadorNombre: trabajador?.nombre ?? '',
            motivo: form.motivo
        });
        setForm({ fecha: hoyISO(), tipo: 'falta', motivo: '' });
        setError('');
    };

    return (
        <div style={blockStyle}>
            <h3 style={{
                margin: `0 0 ${espacio.xs}`, fontSize: texto.titulo, fontWeight: peso.normal,
                letterSpacing: interletra.titulo, textTransform: 'uppercase'
            }}>
                Ausencias
            </h3>
            <p style={{
                color: color.textoSuave, fontSize: texto.menor, letterSpacing: interletra.etiqueta,
                textTransform: 'uppercase', marginBottom: espacio.xl
            }}>
                Los días que cada trabajador no vino, con su motivo.
            </p>

            {/* ------------------------------------------------- el trabajador */}
            <div style={{ marginBottom: espacio.xl, maxWidth: '420px' }}>
                <Campo
                    etiqueta="Trabajador"
                    como="select"
                    value={trabajadorAusencias ?? ''}
                    onChange={(e) => { setTrabajadorAusencias(e.target.value || null); setError(''); }}
                >
                    <option value="">Elegir trabajador…</option>
                    {trabajadoresList.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </Campo>
            </div>

            {!trabajadorAusencias ? (
                <Tarjeta tono="hundida">
                    <p style={{ margin: 0, fontSize: texto.base, color: color.textoSuave }}>
                        Elige un trabajador para ver y registrar sus ausencias.
                    </p>
                </Tarjeta>
            ) : (
                <>
                    {/* --------------------------------------------- registrar */}
                    <Tarjeta style={{ marginBottom: espacio.lg }}>
                        <Etiqueta>Registrar una ausencia</Etiqueta>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: espacio.sm, marginTop: espacio.sm }}>
                            <Campo
                                etiqueta="Día"
                                type="date"
                                value={form.fecha}
                                error={avisoFinDeSemana || undefined}
                                onChange={(e) => { setForm({ ...form, fecha: e.target.value }); setError(''); }}
                            />
                            <Campo
                                etiqueta="Tipo"
                                como="select"
                                value={form.tipo}
                                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                            >
                                {TIPOS.map((t) => <option key={t} value={t}>{NOMBRES_TIPO[t]}</option>)}
                            </Campo>
                        </div>

                        <div style={{ marginTop: espacio.sm }}>
                            <Campo
                                etiqueta="Motivo"
                                ayuda="Opcional, pero es lo que responde la pregunta dentro de seis meses."
                                value={form.motivo}
                                onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                                placeholder="Cita médica"
                            />
                        </div>

                        {(error || avisoFinDeSemana) && (
                            <p style={{ margin: `${espacio.sm} 0 0`, fontSize: texto.menor, color: color.error, fontWeight: peso.medio }}>
                                {error || avisoFinDeSemana}
                            </p>
                        )}

                        <div style={{ marginTop: espacio.md }}>
                            <Boton onClick={registrar} disabled={guardandoAusencia || !!avisoFinDeSemana}>
                                <Plus size={16} /> {guardandoAusencia ? 'Guardando…' : 'Registrar ausencia'}
                            </Boton>
                        </div>
                    </Tarjeta>

                    {/* ----------------------------------------------- listado */}
                    <div style={{ marginBottom: espacio.sm, display: 'flex', alignItems: 'center', gap: espacio.xs }}>
                        <User size={15} style={{ color: color.vidrio }} />
                        <span style={{ fontSize: texto.base, fontWeight: peso.medio }}>
                            {trabajador?.nombre}
                        </span>
                        <Insignia tono={suyas.length === 0 ? 'exito' : 'neutra'}>
                            {suyas.length === 0 ? 'Sin ausencias' : `${suyas.length} ${suyas.length === 1 ? 'día' : 'días'}`}
                        </Insignia>
                    </div>

                    {suyas.length === 0 ? (
                        <Tarjeta tono="hundida">
                            <p style={{ margin: 0, fontSize: texto.base, color: color.textoSuave }}>
                                No tiene ninguna ausencia registrada.
                            </p>
                        </Tarjeta>
                    ) : (
                        <Tarjeta relleno="ninguno">
                            {suyas.map((a, i) => (
                                <div
                                    key={a.id}
                                    style={{
                                        display: 'flex', alignItems: 'flex-start', gap: espacio.sm,
                                        padding: `${espacio.sm} ${espacio.md}`,
                                        borderTop: i === 0 ? 'none' : `1px solid ${color.lineaSuave}`,
                                        flexWrap: 'wrap'
                                    }}
                                >
                                    <CalendarOff size={16} style={{ color: color.vidrio, flexShrink: 0, marginTop: '3px' }} />
                                    <div style={{ flex: 1, minWidth: '180px' }}>
                                        <div style={{ fontSize: texto.base, fontWeight: peso.medio }}>
                                            {a.fecha}
                                            <span style={{ color: color.textoTenue, fontWeight: peso.normal }}>
                                                {' · '}{nombreDelDia(a.fecha)}
                                            </span>
                                        </div>
                                        {a.motivo ? (
                                            <div style={{ fontSize: texto.menor, color: color.textoSuave, marginTop: '2px' }}>
                                                {a.motivo}
                                            </div>
                                        ) : null}
                                        <div style={{ display: 'flex', gap: espacio.xs, alignItems: 'center', marginTop: espacio.xxs, flexWrap: 'wrap' }}>
                                            <Insignia tono={TONO[a.tipo] ?? 'neutra'}>{NOMBRES_TIPO[a.tipo] ?? a.tipo}</Insignia>
                                            {a.creadoPor ? (
                                                <span style={{ fontSize: texto.micro, color: color.textoTenue }}>
                                                    registrada por {a.creadoPor}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => borrarAusencia(a.id, a.fecha, trabajador?.nombre)}
                                        aria-label={`Quitar la ausencia del ${a.fecha}`}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: color.textoTenue, padding: espacio.xxs, lineHeight: 0 }}
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            ))}
                        </Tarjeta>
                    )}

                    <p style={{ marginTop: espacio.md, fontSize: texto.menor, color: color.textoTenue, lineHeight: 1.5 }}>
                        Los fines de semana no se pueden registrar: el mes se paga como días
                        naturales, así que faltar un sábado no descuenta nada. Los festivos entre
                        semana sí cuentan como día laborable mientras no haya calendario laboral.
                    </p>
                </>
            )}
        </div>
    );
}
