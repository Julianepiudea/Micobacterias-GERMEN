/* lector.worker.js — Lee los libros fuera del hilo de la interfaz. Los datos identificadores
   (nombres, documento) se descartan aquí y nunca llegan a la página. */
importScripts('../vendor/xlsx.full.min.js', 'lector.js');
self.onmessage = async e => {
  const { id, buffer, nombre, sal } = e.data;
  try {
    const res = await Lector.leer(buffer, nombre, sal, txt => self.postMessage({ id, tipo: 'progreso', txt }));
    self.postMessage({ id, tipo: 'ok', res });
  } catch (err) {
    self.postMessage({ id, tipo: 'error', msg: String(err && err.message || err) });
  }
};
