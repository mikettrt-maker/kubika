import { useEffect } from 'react';

function Sec({ icon, title, children }) {
  return (
    <section className="mb-5">
      <h3 className="text-base font-black text-purple-800 mb-1.5 flex items-center gap-2">
        <span aria-hidden="true">{icon}</span>
        {title}
      </h3>
      <div className="text-sm leading-relaxed text-slate-700 space-y-1.5">
        {children}
      </div>
    </section>
  );
}

function Ej({ children }) {
  return (
    <p className="mt-1.5 px-3 py-2 rounded-xl bg-purple-50 border border-purple-100 font-bold text-slate-800 leading-relaxed">
      {children}
    </p>
  );
}

/**
 * Guía amigable de escritura de números (v3.16.0).
 * Kubi explica las reglas sin tecnicismos, con ejemplos.
 * Se abre desde el panel del Gimnasio (modo escritura).
 */
export default function GuiaEscritura({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10003] flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
      data-guia-open
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado con Kubi */}
        <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 shrink-0">
          <img
            src="mascota.png"
            alt="Kubi"
            className="w-12 h-12 object-contain"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <div className="flex-1">
            <h2 className="text-lg font-black text-purple-800 leading-tight">✨ ¿Sabías, amigo, que…?</h2>
            <p className="text-xs font-bold text-purple-500">Kubi te cuenta los secretos de los números</p>
          </div>
          <button
            onClick={onClose}
            title="Cerrar la guía"
            className="w-9 h-9 rounded-full bg-white border border-purple-200 text-slate-500 hover:text-slate-800 hover:bg-purple-50 flex items-center justify-center text-base font-black transition-colors shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Contenido */}
        <div className="px-5 py-4 overflow-y-auto select-text">
          <Sec icon="🔢" title="Del 0 al 29: van pegaditos, en una sola palabra">
            <p>Son amigos y se escriben juntitos:</p>
            <Ej>cero · siete · catorce · quince · veinte · veinticinco · veintinueve</Ej>
            <p>
              <strong>Cuatro llevan tilde</strong> (esa rayita de arriba):{' '}
              <strong>dieciséis, veintidós, veintitrés, veintiséis</strong>.
            </p>
            <p>Y cuando van antes de una palabra, se unen:</p>
            <Ej>veintiún amigos · veintiuna mesa · veintidós pesos</Ej>
          </Sec>

          <Sec icon="🤝" title="Del 31 al 99: van separados y unidos con «y»">
            <p>A partir del 31, la decena y la unidad se escriben solitas, unidas con la palabrita «y»:</p>
            <Ej>treinta y uno · cuarenta y cinco · cincuenta y ocho · noventa y nueve</Ej>
            <p>
              Los «redondos» sí van solitos y pegaditos:{' '}
              <strong>treinta, cuarenta, cincuenta, sesenta, setenta, ochenta, noventa</strong>.
            </p>
          </Sec>

          <Sec icon="💯" title="Los cientos (100 al 900)">
            <p>Van en una sola palabra. Y ojo con estos secretitos:</p>
            <p>
              <strong>cien</strong> solito o antes de «mil», «millones» o una cosa:{' '}
              cien pesos · cien mil · cien millones.
            </p>
            <p>
              <strong>ciento</strong> cuando le sigue un número:{' '}
              ciento uno · ciento veinte · ciento veinticinco.
            </p>
            <p><strong>Tres cambiaron de traje</strong> (no los escribas como suenan):</p>
            <Ej>
              500 = <strong>quinientos</strong> (no «cincocientos») ·<br />
              700 = <strong>setecientos</strong> (no «sietecientos») ·<br />
              900 = <strong>novecientos</strong> (no «nuevecientos»)
            </Ej>
          </Sec>

          <Sec icon="🚀" title="Mil: nunca dice «uno»">
            <p>«Mil» va solito, sin «uno» adelante:</p>
            <Ej>
              1,000 = mil · 2,000 = dos mil ·<br />
              15,400 = quince mil cuatrocientos · 500,000 = quinientos mil
            </Ej>
          </Sec>

          <Sec icon="🌎" title="Millones y mil millones">
            <p>
              Cuando cuentas <strong>cosas</strong>, va «de»:{' '}
              un millón <strong>de</strong> pesos · tres millones <strong>de</strong> canicas.
            </p>
            <p>
              Pero si le sigue <strong>otro número</strong>, ya no va «de»:{' '}
              un millón doscientos mil pesos · tres millones ochocientos alumnos.
            </p>
            <p>
              Y para mil millones (el número más largo de Kubika, 12 cifras):{' '}
              1,000,000,000 = mil millones · 5,000,000,000 = cinco mil millones.
            </p>
            <Ej>
              999,999,999,999 = novecientos noventa y nueve mil millones novecientos noventa y nueve mil novecientos noventa y nueve
            </Ej>
          </Sec>

          <Sec icon="🔟" title="Los decimales también cuentan su historia">
            <p>
              Después del punto, el número se lee normal y al final se agrega{' '}
              <strong>de qué tan pequeños son</strong>:
            </p>
            <Ej>
              1 cifra → <strong>décimas</strong>: 3.7 = tres con siete décimas<br />
              2 cifras → <strong>centésimas</strong>: 12.08 = doce con ocho centésimas<br />
              3 cifras → <strong>milésimas</strong>: 45.045 = cuarenta y cinco con cuarenta y cinco milésimas
            </Ej>
            <p>
              Los ceros al principio <strong>no se leen, pero sí cuentan</strong>:{' '}
              .075 se lee «setenta y cinco milésimas» (¡son 3 cifras decimales!).
            </p>
          </Sec>

          <Sec icon="✍️" title="Cuando escribo con cifras: grupos de 3">
            <p>
              Agrupa de 3 en 3 desde la derecha. En Kubika los separamos con coma{' '}
              (también se vale un espacito):
            </p>
            <Ej>
              45,730,008 → 45 | 730 | 008<br />
              = cuarenta y cinco millones setecientos treinta mil ocho
            </Ej>
            <p>
              Los ceros de un grupo <strong>no se leen</strong>: 008 = ocho.
            </p>
          </Sec>

          {/* Cierre amistoso */}
          <div className="mt-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-purple-100 to-pink-100 border border-purple-200 text-sm font-bold text-purple-900 leading-relaxed">
            🐾 Y recuerda, amigo: si un ejercicio te sale ✗, no te aflijas. Respira, busca cuál salió mal, revisa ese
            grupo con calma y vuelve a intentarlo. ¡Kubi cree en ti, tú puedes!
          </div>
        </div>

        {/* Pie */}
        <div className="px-5 py-3 border-t border-slate-100 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="h-10 px-5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-black transition-all shadow-md"
          >
            ¡Ya lo sé! Volver al reto
          </button>
        </div>
      </div>
    </div>
  );
}
