// aplica el tema guardado antes del primer pintado sin scripts inline (csp estricto)
(function () {
  try {
    var tema_guardado = localStorage.getItem('itp_tema_preferido');
    if (tema_guardado === 'oscuro') {
      document.documentElement.setAttribute('data-tema', 'oscuro');
    }
  } catch (e) {}
})();
