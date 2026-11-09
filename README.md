# comemos · nuestro hogar en una sola app

Una app para Adrián, Rali, Lenny 🐈 y quien venga a vivir al piso más adelante. Junta en un solo sitio lo que antes estaba repartido:

| Pantalla | Para qué sirve |
| --- | --- |
| **Hoy** | Lo importante de un vistazo: próximas comidas, tuppers, lo que caduca, revisiones de kits, tareas de trabajo y cuentas pendientes. |
| **Cocina** | Tuppers, recetas y plan. Cocinar descuenta del inventario; al repartir los platos se apunta lo que come cada persona y las sobras quedan como tupper. |
| **Inventario** | Lotes con cantidad, fecha y sección (rayón / familia / subfamilia). Cada artículo puede ser de la casa o de una persona (su balda). Comparador de formatos por kg/l/ud. |
| **Compra** | Lista compartida agrupada por sección, para recorrer la tienda en orden. |
| **Gastos** | Quién paga, entre quién se reparte, saldos y «para quedar en paz» con el mínimo de pagos. La cuenta común no genera deudas. |
| **Kits y revisiones** | Inventarios personales o de la casa: mochila de emergencia, botiquín, kit de la mascota... Caducidades, tareas periódicas (cambiar pilas cada 12 meses), revisión guiada y avisos en el calendario del móvil. |
| **Campañas** | El antiguo *Gestor de campañas de hipermercado*, ahora como espacio personal de trabajo. Las tareas tienen fecha (Steeple 2 días antes, Meta/X 1 día antes, Newsletter el lunes). |
| **Hogar** | Personas, mascotas, sincronización entre móviles, estructura de clasificación y copias de seguridad. |

Funciona en el móvil y en el ordenador, se puede instalar como app desde el navegador («Añadir a pantalla de inicio») y sigue funcionando sin conexión.

---

## 1. Probarla en tu ordenador

Necesitas [Node.js](https://nodejs.org) 22 o posterior.

```bash
npm ci          # instala las dependencias (solo la primera vez)
npm run serve   # compila la app y arranca el servidor del hogar
```

Abre <http://localhost:8787>. La primera vez te pregunta cómo se llama el hogar y quién vive en él.

Para programar con recarga automática usa dos terminales: `npm start` (servidor) y `npm run dev` (app en <http://localhost:5173>).

## 2. Usarla entre varios móviles

Cada móvil guarda sus datos y funciona aunque no haya conexión. Para que **todos veáis lo mismo**, el hogar se conecta a un *servidor del hogar*: el programa de la carpeta `server/`, sin dependencias, que puede vivir en cualquier ordenador que esté encendido (el de casa, una Raspberry Pi, un servidor pequeño...).

### Opción recomendada: ordenador de casa + Tailscale (gratis)

[Tailscale](https://tailscale.com) crea una red privada entre vuestros dispositivos, con HTTPS, sin abrir puertos del router.

1. En el ordenador que hará de servidor: `npm ci` y después `npm run serve`.
2. Instala Tailscale en ese ordenador y en los móviles, con la misma cuenta (o invita a Rali a tu red).
3. En el ordenador, publica el puerto dentro de tu red privada: `tailscale serve --bg 8787`. Te dará una dirección del tipo `https://mi-ordenador.tu-red.ts.net`. Si tu versión de Tailscale usa otra sintaxis, `tailscale serve --help` te la enseña.
4. Abre esa dirección en tu móvil, crea el hogar y ve a **Hogar → Conectar a un servidor**. La dirección ya aparece rellenada.
5. Pulsa **Invitar**: sale un QR y un enlace. Rali lo escanea o abre el enlace, elige «Rali» y listo.

### Opción rápida: misma wifi

Con `npm run serve` en marcha, abre en el móvil `http://IP-DEL-ORDENADOR:8787` (la IP la ves en la configuración de red del ordenador). Funciona, pero solo en casa y sin modo sin conexión (los navegadores lo exigen con HTTPS).

### Copias de seguridad

- Los datos del servidor están en la carpeta `data/`. Cópiala de vez en cuando (es texto y ocupa muy poco).
- Desde la app: **Hogar → Descargar copia** guarda todo en un `.json`.

### Variables del servidor (opcionales)

| Variable | Para qué |
| --- | --- |
| `PORT=8787` | Puerto. |
| `DATA_DIR=./data` | Carpeta de datos. |
| `CREATE_TOKEN=algo-secreto` | Si el servidor es accesible desde internet, impide que desconocidos creen hogares en él. |

## 3. Kits: para no llevarte sorpresas

1. **Kits y revisiones → Nuevo kit → Mochila de emergencia.** La plantilla trae lo habitual para aguantar 72 horas (agua, latas, linterna, pilas, radio, powerbank, botiquín, documentos...). Son sugerencias: añade, quita y ajusta cantidades.
2. Apunta las **fechas de caducidad** del agua, las latas y las medicinas. La app te avisa de lo que falta.
3. Cada artículo puede tener una **tarea periódica**: «Cambiar pilas» cada 12 meses, «Recargar» el powerbank cada 3, «Comprobar que funciona» la linterna cada 3...
4. **Revisar ahora** te pasa por cada cosa: *Bien*, *Hecho/Repuesto* (con fecha nueva si caduca) o *Falta*. Lo que falta va directo a la lista de la compra.
5. **Exportar avisos al calendario** descarga un `.ics`. Ábrelo en el móvil o impórtalo en Google Calendar / Apple Calendario: el calendario te avisa una semana antes y el mismo día **aunque la app esté cerrada**. Vuelve a exportarlo después de cada revisión.

Los kits pueden ser de la casa (los ve todo el mundo) o de una persona (solo aparecen en su «Mi espacio»).

## 4. Estructura de clasificación (Ábaco)

En **Hogar → Importar estructura** puedes cargar el export SQL de TablePlus (`abaco_estructura`), un CSV o un JSON con las columnas `cod_departamento, desc_departamento, cod_rayon, desc_rayon, cod_familia, desc_familia, cod_subfamilia, desc_subfamilia`. Eliges qué departamentos usar (alimentación y frescos suelen bastar) y desde entonces, al añadir un artículo, puedes buscar «aceite», «tofu» o «pilas» y elegir la subfamilia.

- El rayón **13** son los congelados: al planificar una comida con congelados, la app recuerda sacarlos 12 horas antes.
- Los rayones **21** y **24** se llaman «Proteínas vegetales (seitán, tempeh, tofu)» y «Alternativas veganas y algas» en vuestro hogar.
- **La estructura no se sube al repositorio** (que es público): se procesa en tu dispositivo y se comparte solo a través de vuestro servidor. El `.gitignore` bloquea los `.sql`.

Sin importar nada, la app usa una lista básica de secciones.

## 5. Una mano con IA

La app no llama a ninguna IA por su cuenta. Pulsa **Una mano con IA → Copiar contexto**, pégalo en tu chat favorito y pide, por ejemplo, «una receta con lo que caduca esta semana», «apunta este ticket» o «completa la mochila de emergencia para dos personas y un gato». La IA responde un JSON; lo pegas, la app lo **valida**, te enseña cada cambio y solo lo aplica si le das a «Aplicar».

## 6. Venir de las versiones anteriores

- **comemos 0.1**: si abres esta versión en el mismo navegador y dirección, tus datos se convierten solos (Adrián y Rali pasan a ser miembros del hogar).
- **Gestor de campañas**: en la app antigua pulsa *Exportar* y en **Campañas → Importar JSON** carga el archivo. Si no tenían tareas, se crean las de la plantilla con sus fechas.

---

## Cómo está hecha (para aprender)

```
src/
  domain/        Reglas del hogar, sin pantallas (se pueden probar con Node)
    types.ts       Qué datos hay: miembros, lotes, recetas, kits, campañas...
    ops.ts         Cada cambio es una «operación» pequeña: cocinar, servir, añadir gasto...
    reducer.ts     Aplica una operación al estado. Es la ÚNICA forma de cambiar datos.
    kits.ts        Vencimientos, plantillas y calendario .ics
    money.ts       Saldos y pagos para quedar en paz
    abaco.ts       Lector de la estructura SQL/CSV/JSON y buscador
    campaigns.ts   Plantillas de tareas con fechas, duplicar, importar
    ai.ts          Contexto para la IA y validación de su respuesta
  app/
    store.ts       Guarda en el dispositivo y sincroniza con el servidor
    context.tsx    Acceso al hogar desde cualquier pantalla
  ui/            Pantallas (React)
    App.tsx        Navegación, menú, ventanas
    pages/         Una pantalla por archivo
  styles/        Estilos
server/index.mjs Servidor del hogar (Node, sin dependencias)
tests/           Pruebas: npm test
```

### ¿Cómo se sincronizan varios móviles?

Cada cambio se guarda como una **operación** (por ejemplo, «Rali sirvió 300 g de lentejas»). El móvil la aplica en el acto y la envía al servidor cuando hay conexión. El servidor solo hace una cosa: **ponerlas en orden** y repartirlas. Todos los móviles aplican las mismas operaciones en el mismo orden con el mismo `reducer`, así que llegan exactamente al mismo resultado.

¿Y si dos personas se comen el último tupper sin conexión a la vez? La segunda operación ya no cabe: se descarta igual en todos los móviles y a quien la hizo le aparece un aviso para que lo revise. Hay una prueba que lo comprueba (`tests/sync.test.ts`).

### Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | App en modo desarrollo con recarga automática. |
| `npm start` | Servidor del hogar (sirve también la app compilada). |
| `npm run serve` | Compila y arranca el servidor. |
| `npm test` | Pruebas del dominio y de la sincronización entre dos «móviles». |
| `npm run typecheck` | Revisa los tipos de TypeScript. |
| `npm run build` | Compila la app en `dist/`. |

## Límites (con honestidad)

- **No hay cuentas ni contraseñas por persona.** El enlace de invitación es la llave del hogar: quien lo tenga puede ver y cambiar todo. «Mi espacio» organiza por persona, pero no es privado frente a quien vive contigo.
- Los **avisos con la app cerrada** llegan a través del calendario del móvil (`.ics`), no con notificaciones propias.
- El seguimiento de **proteína** es orientativo: cuenta lo que se registra al servir. Cada persona puede fijar su objetivo en Hogar → Personas. No es una pauta nutricional.
- Las fechas de revisión de tuppers y los intervalos de los kits son recordatorios que eliges tú, no garantías sanitarias.
- Los precios del comparador de ejemplo son ficticios.
- El servidor guarda todas las operaciones desde el principio. Para un hogar es poquísimo; si algún día crece mucho, se puede añadir una «foto» periódica para unirse más rápido.
