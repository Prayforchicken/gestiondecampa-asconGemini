# comemos · nuestro hogar en una sola app

> **¿Solo quieres instalarla y usarla?** Lee la [guía de uso](public/guia/index.html), que también está dentro de la app (Hogar → Guía de uso) y en `http://IP-del-ordenador:8787/guia/`.

Una app para Adrián, Rali, Lenny 🐈 y quien venga a vivir al piso más adelante. Junta en un solo sitio lo que antes estaba repartido:

| Pantalla | Para qué sirve |
| --- | --- |
| **Hoy** | Lo importante de un vistazo: próximas comidas, tuppers, lo que caduca, revisiones de kits, tareas de trabajo y cuentas pendientes. |
| **Cocina** | Tuppers, recetas y plan. Cocinar descuenta del inventario; al repartir los platos se apunta lo que come cada persona y las sobras quedan como tupper. |
| **Inventario** | Lotes con cantidad, fecha, EAN y código interno (sección · familia · tipo · artículo). Vista «por tipo», búsqueda por código o EAN y comparador de formatos por kg/l/ud. Cada artículo puede ser de la casa o de una persona (su balda). |
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

## 4. Estructura de artículos y códigos internos

La app tiene **su propia estructura** en [`src/data/estructura.ts`](src/data/estructura.ts). Está inspirada en Ábaco, pero pensada para una casa: sin departamentos de tienda, con proteínas vegetales, mascotas, botiquín y emergencias, sinónimos para el buscador y proteína estimada por tipo.

```
1 Despensa                      ← departamento (1 dígito)
  11 Alimentación seca @Despensa  ← sección (2 dígitos; el primero es su departamento)
    02 Arroces                    ← familia (2 dígitos)
      02 Arroz integral · prot 7.5 seco   ← tipo (2 dígitos) · sinónimos · proteína
```

**Código interno = sección · familia · tipo · artículo** (9 dígitos). El número de artículo lo pone la app al guardar:

| Artículo | EAN (fabricante) | Código interno |
| --- | --- | --- |
| Arroz integral, paquete 1 kg | 2000000000022 | **11.02.02**.001 |
| Arroz integral, saco 5 kg | 2009876543213 | **11.02.02**.002 |
| Arroz integral de otra marca, 1 kg | 2005550001239 | **11.02.02**.003 |

Los EAN no tienen nada en común; los códigos internos solo cambian en el final. Para qué sirve:

- **Inventario → Por tipo** junta todos los arroces integrales y suma lo que hay.
- Se puede **buscar** por nombre, por código (`11.02`, `110202`) o por EAN.
- Una **receta** puede pedir «cualquier arroz integral» (`tipo:110202`) y gastará primero el que caduque antes, sea de la marca que sea.
- El **comparador** enseña todos los formatos del mismo tipo por precio por kilo.
- Si escribes un EAN que ya existe, la app lo detecta y te propone añadirlo como lote de ese artículo.

Los números los asigna la app (no el móvil), así dos personas sin conexión nunca dan el mismo número a artículos distintos. Los números ya existentes no deben cambiarse; para añadir tipos o familias, usa números libres. `npm test` comprueba que la estructura esté bien formada. El rayón **13** siguen siendo los congelados, el **21** las proteínas vegetales y el **24** las alternativas del mar y las algas.

## 5. Versión móvil mínima (prueba)

`movil.html` es una app aparte, muy ligera, que solo **pide y manda datos al ordenador de casa**: estado de la conexión, «Pedir datos», «Probar» (mide lo que tarda en responder), añadir a la compra, marcar comprados, apuntar un gasto y un resumen de lo que dice casa. No crea hogares: se une con el enlace de invitación. Guarda sus datos aparte, así no se mezcla con la app completa en el mismo móvil.

1. En la app completa: **Hogar → Invitar → copiar su enlace** (versión móvil).
2. Ábrelo en el móvil y pulsa **Conectar**.
3. Para instalarla como app: menú del navegador → **Instalar app / Añadir a pantalla de inicio**. Android y iPhone solo instalan PWA servidas por **HTTPS** (Tailscale lo da hecho) o desde `localhost`. Por la wifi de casa con `http://IP:8787` funciona en el navegador, pero no se instala como app.

## 5b. App de Android (APK)

La app completa también existe como **APK de Android** (`io.github.prayforchicken.comemos`). La web va dentro de la APK, así que abre sin conexión, y habla por la red con el ordenador de casa.

### Instalarla

1. Pasa `comemos-0.3.1.apk` al móvil (Drive, Telegram, cable...).
2. Ábrela. Android pedirá permiso para «instalar apps de origen desconocido» desde esa app: acéptalo solo para esto.
3. Abre **Comemos** y elige: crear un hogar o **«Tengo una invitación»** (pega el enlace que da *Hogar → Invitar* en otro dispositivo).

### Varios ordenadores (hogares)

En **Hogar → Hogares en este dispositivo → Añadir otro hogar u ordenador** puedes tener el piso actual, el siguiente o la casa de tu familia, cada uno con su propio ordenador. Los datos de cada hogar se guardan aparte; cambias con **Abrir** y quitas uno con **×** (sus datos siguen en su ordenador). Esto también funciona en la versión web.

La dirección del ordenador se puede escribir tal cual: `192.168.1.20:8787` (wifi de casa) o `https://mi-pc.tu-red.ts.net` (Tailscale, también fuera de casa). La APK admite servidores `http://` de la red local.

### Compilarla tú (para actualizar)

Necesitas Node.js 22 y el SDK de Android (lo más sencillo: instalar [Android Studio](https://developer.android.com/studio), que lo trae).

```bash
npm ci
npm run android:apk          # APK firmada → apk/comemos-<versión>.apk
npm run android:apk -- debug # APK de pruebas, firmada con la clave de depuración
```

- **Sube la versión en `package.json`** antes de cada actualización (0.3.0 → 0.3.1): Android solo instala encima una versión mayor.
- **La clave de firma** (`comemos-release.jks` + `keystore.properties`) va en la carpeta `android/` y **nunca al repositorio** (el `.gitignore` la bloquea). Todas las versiones deben firmarse con la misma clave: si se pierde, habrá que desinstalar la app y volver a unirse al hogar (los datos siguen en el ordenador). Guarda una copia en un sitio seguro.
- En Windows el script usa `gradlew.bat` automáticamente.

## 6. Una mano con IA

La app no llama a ninguna IA por su cuenta. Pulsa **Una mano con IA → Copiar contexto**, pégalo en tu chat favorito y pide, por ejemplo, «una receta con lo que caduca esta semana», «apunta este ticket» o «completa la mochila de emergencia para dos personas y un gato». La IA responde un JSON; lo pegas, la app lo **valida**, te enseña cada cambio y solo lo aplica si le das a «Aplicar».

## 7. Venir de las versiones anteriores

- **comemos 0.1**: si abres esta versión en el mismo navegador y dirección, tus datos se convierten solos (Adrián y Rali pasan a ser miembros del hogar).
- **Gestor de campañas**: en la app antigua pulsa *Exportar* y en **Campañas → Importar JSON** carga el archivo. Si no tenían tareas, se crean las de la plantilla con sus fechas.

---

## Cómo está hecha (para aprender)

```
src/
  data/
    estructura.ts  La estructura de artículos de la app (texto fácil de editar)
  domain/        Reglas del hogar, sin pantallas (se pueden probar con Node)
    types.ts       Qué datos hay: miembros, lotes, recetas, kits, campañas...
    ops.ts         Cada cambio es una «operación» pequeña: cocinar, servir, añadir gasto...
    reducer.ts     Aplica una operación al estado. Es la ÚNICA forma de cambiar datos.
    estructura.ts  Lee la estructura, forma los códigos internos, comprueba EAN y busca tipos
    stock.ts       Existencias por artículo o por tipo («cualquier arroz integral»)
    kits.ts        Vencimientos, plantillas y calendario .ics
    money.ts       Saldos y pagos para quedar en paz
    campaigns.ts   Plantillas de tareas con fechas, duplicar, importar
    ai.ts          Contexto para la IA y validación de su respuesta
  app/
    store.ts       Guarda en el dispositivo y sincroniza con el servidor
    context.tsx    Acceso al hogar desde cualquier pantalla
  ui/            Pantallas (React)
    App.tsx        Navegación, menú, ventanas
    pages/         Una pantalla por archivo
  movil/         Versión móvil mínima (movil.html)
  app/profiles.ts  Varios hogares (y ordenadores) en el mismo dispositivo
  styles/        Estilos
server/index.mjs Servidor del hogar (Node, sin dependencias)
android/         Proyecto Android (Capacitor). capacitor.config.ts lo configura
scripts/android-apk.mjs  Compila la APK
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
| `npm run android:apk` | Compila la APK de Android en `apk/`. |

## Límites (con honestidad)

- **No hay cuentas ni contraseñas por persona.** El enlace de invitación es la llave del hogar: quien lo tenga puede ver y cambiar todo. «Mi espacio» organiza por persona, pero no es privado frente a quien vive contigo.
- Los **avisos con la app cerrada** llegan a través del calendario del móvil (`.ics`), no con notificaciones propias.
- El seguimiento de **proteína** es orientativo: cuenta lo que se registra al servir. Cada persona puede fijar su objetivo en Hogar → Personas. No es una pauta nutricional.
- Las fechas de revisión de tuppers y los intervalos de los kits son recordatorios que eliges tú, no garantías sanitarias.
- Los precios del comparador de ejemplo son ficticios.
- El servidor guarda todas las operaciones desde el principio. Para un hogar es poquísimo; si algún día crece mucho, se puede añadir una «foto» periódica para unirse más rápido.
