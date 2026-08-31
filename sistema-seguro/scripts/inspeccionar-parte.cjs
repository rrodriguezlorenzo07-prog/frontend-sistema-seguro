/**
 * Diagnóstico SOLO LECTURA de un parte concreto y su validación.
 *   node scripts/inspeccionar-parte.cjs <parteId>
 * No escribe, no borra, no modifica nada.
 */
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const db = getFirestore(initializeApp({ credential: applicationDefault(), projectId: 'sistema-seguro-dcecb' }));

const ID = process.argv[2];
if (!ID) { console.error('Falta el id del parte.'); process.exit(1); }

const enmascarar = (valor) => (typeof valor === 'string' && valor.includes('token='))
    ? valor.replace(/token=[^&]+/, 'token=<OCULTO>')
    : valor;

const volcar = (obj) => JSON.stringify(obj, null, 2).split('\n').map((l) => '   ' + l).join('\n');

(async () => {
    const parte = await db.doc('partes_de_trabajo/' + ID).get();

    console.log('== 1. partes_de_trabajo/' + ID + ' ==');
    console.log('   existe:', parte.exists);
    if (parte.exists) {
        const datos = parte.data();
        const copia = {};
        Object.keys(datos).sort().forEach((k) => { copia[k] = k === 'firma' ? enmascarar(datos[k]) : datos[k]; });
        console.log(volcar(copia));
    }

    const val = await db.doc('validaciones/' + ID).get();
    console.log('');
    console.log('== 2. validaciones/' + ID + ' ==');
    console.log('   existe:', val.exists);
    if (val.exists) console.log(volcar(val.data()));

    if (parte.exists) {
        const d = parte.data();
        console.log('');
        console.log('== 3. MARCAS DE TIEMPO ==');
        console.log('   estado              :', d.estado);
        console.log('   fecha (del parte)   :', d.fecha, '| hora:', d.hora);
        console.log('   timestamp (creacion):', d.timestamp, d.timestamp ? '-> ' + new Date(d.timestamp).toISOString() : '');
        console.log('   fechaValidacion     :', d.fechaValidacion !== undefined ? d.fechaValidacion : '(no tiene)');
        console.log('   NOTA: fechaValidacion se guarda como toLocaleDateString(), solo día,');
        console.log('         sin hora. No existe ninguna marca horaria de la aprobación.');
        console.log('');
        console.log('   Campos relevantes para situarlo respecto a D.2:');
        console.log('     cuadrilla en el parte      :', d.cuadrilla !== undefined ? JSON.stringify(d.cuadrilla) : '(no tiene)');
        console.log('     horasExtraAsignadas        :', d.horasExtraAsignadas !== undefined ? d.horasExtraAsignadas : '(no tiene)');
        console.log('     horasTotales (pre Fase A)  :', d.horasTotales !== undefined ? d.horasTotales : '(no tiene)');
    }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
