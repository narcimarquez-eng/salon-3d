# Lecciones de los modelos ya hechos

Fallos reales que aparecieron al revisar capturas, y cómo se arreglaron. Antes de dar un modelo
por bueno, comprueba que no repite ninguno.

## Contenido
1. Problemas de aspecto (colores, transparencia, texturas)
2. Problemas de geometría (giros, escala, juntas)
3. Problemas del motor Python
4. Problemas al capturar y exportar
5. GLB importados, optimización y monstruos
6. Modelos de referencia en el repo

## 1. Aspecto

- **Colores lavados** (vaso de café, 2026-11): un café con leche salía como leche. El motor trata
  el color como lineal y la luz del visor aclara más; se arregló bajando los valores a lineal
  (`(0.22, 0.095, 0.032)` para el cuerpo del café, `(0.035, 0.013, 0.005)` para café solo).
- **Hierro rosado** (muelle del tinto): `(0.10, 0.035, 0.022)` con metálico 0.35 se veía salmón.
  Un hierro oscuro de óxido es `(0.042, 0.013, 0.008)` con metálico 0.2.
- **Cristal blanco y opaco**: dos causas. (1) `Transmission Weight` no se ve bien en el visor;
  usa `Alpha`. (2) Un fallo de la app borraba la transparencia de todos los objetos de los
  scripts cuando no había textura global; ya está arreglado (cada malla guarda `baseAlpha` y
  `baseTransmission`). Si vuelve a pasar, comprueba el material con
  `celshadeViewer.materialOf('Prefijo')` (`?visor-api=1`).
- **Agua de piscina**: la textura `ocean_deep` dibuja celdas de cáusticas; para una ría, color
  liso verde turbio `(0.03, 0.045, 0.035)` con rugosidad baja.
- **Madera que parece arena**: la veta de `wood_oak` se estira en tablas de 20 m. En tableros
  largos, color liso.
- **Texturas por nombre**: antes la app ponía texturas según el nombre del material; ya no. Si
  quieres una textura, pon `mat.texture = "..."` de forma explícita.
- **Pantalla o LED que se ve blanca** (videomarcador del Bernabéu): con `Emission Strength` 1,8 y
  bloom, un azul claro sale casi blanco y parece cielo. Para pantallas grandes usa una imagen
  (`mat.color_map`) con emisión baja (0,5–0,7) de color oscuro y saturado.
- **Con `mat.color_map` el color base no cuenta**: la app pone el color a blanco y usa la imagen
  tal cual. Para aclarar, oscurecer o teñir, cambia la propia imagen (ver
  `bernabeu/preparar_texturas.py`, que tiñe y hace variantes de texturas descargadas).
- **Gradas que salen blancas**: con huellas azules y contrahuellas de hormigón, desde el campo
  solo se ven las contrahuellas. Divide cada contrahuella en una franja baja de hormigón y el
  respaldo de la butaca (textura `bb_butacas`, solo varía en horizontal).
- **Letras de rótulo** (pasarela de Moguer): se hacen con trazos (`barra` de punto a punto en el
  plano de la cara) alargados medio grueso por cada lado para que las esquinas queden macizas.
  Rematar cada trazo con cilindros redondos deja "bolitas" brillantes en las juntas. Un rojo de
  rótulo es `(0.30, 0.010, 0.008)`; con más valor sale salmón.
- **Suelo de rejilla**: `cyber_circuits` dibuja líneas azules de circuito; para rejilla metálica
  va mejor `carbon_weave` sobre gris oscuro.
- **Pelaje que parece plástico** (monstruos de Enemigo-rpg): el color venía del brillo "sheen"
  sobre una base casi negra; al poner la textura de pelaje se aclara la base con su mismo tono.

## 2. Geometría

- **Tejado en valle** (ermita): el faldón derecho tenía `ry = -θ`. Correcto: derecho `+θ`,
  izquierdo `-θ` (función `tejado_dos_aguas` de la plantilla).
- **Diagonales mal giradas**: usa siempre la función `viga(a, b)`; calcula inclinación y rumbo
  con el convenio de signos correcto.
- **Juntas en curvas** (muelle): las piezas entre dos puntos de una curva dejan cuñas en el lado
  exterior; alarga cada pieza 0,5–1 m.
- **Modelo diminuto en la vista general**: el suelo o el agua eran mucho más grandes que el
  modelo. Ajústalos al tamaño del modelo.
- **Partes finas que desaparecen al reducir triángulos**: ver sección 5.
- **Mallas propias (`from_pydata`) sin material**: `me.materials.append(mat)` antes de
  `objects.new` no hace nada. Asigna el material después de enlazar:
  `bpy.context.collection.objects.link(ob)` y luego `ob.data.materials.append(mat)`.
- **Caras de `from_pydata` invisibles**: las mallas opacas solo pintan la cara delantera
  (vértices en sentido antihorario vistos desde fuera). Las funciones `anillo_arriba`,
  `pared_dentro`, `pared_fuera`... de `bernabeu/santiago_bernabeu.py` ya traen el orden bueno.
- **Gradas y anillos de estadio**: un contorno de rectángulo con esquinas redondeadas definido
  como lista de [centro, normal] permite sacar curvas paralelas a cualquier distancia R con la
  misma cantidad de puntos (`P(k, R, z)`), y coser gradas, cubierta y fachada sin juntas.

## 3. Motor Python

- `for (x, y, z) in [...]` falla: recorre una lista e indexa.
- Una expresión condicional en una línea hizo fallar la ermita v1: usa `if` normal.
- Variable sin definir (`m_correa` en el orco): el error dice la línea; revisa nombres.
- El mensaje de error aparece en la consola del estudio como "Fallo en Línea N" y el script de
  captura lo imprime.

## 4. Capturar y exportar

- El servidor de Vite se apaga con el comando que lo lanzó: arráncalo en segundo plano.
- Un servidor de archivos estáticos (`python3 -m http.server`) debe escuchar solo en
  `--bind 127.0.0.1`; si no, el sistema de permisos lo bloquea.
- La primera carga de un módulo nuevo puede recargar la página (Vite optimiza dependencias):
  si Playwright dice "Execution context was destroyed", espera unos segundos y repite.
- El estudio Python tapa la vista: el script de captura lo cierra con Escape.
- El botón de modo (EEVEE) vuelve al de la sesión al cerrar el estudio; no hace falta tocarlo.
- **Anillos amarillo y azul en las vistas cercanas**: es el cursor del pincel de esculpir, que
  se queda donde pasó el ratón. El script de captura lo oculta con `OCULTAR_PLATAFORMA=1`
  (`celshadeViewer.setPedestalVisible(false)` tras mover el ratón), junto con plataforma y ejes.
- **La vista propia sale en otro sitio**: la cámara se mueve con una transición suave; en escenas
  de cientos de metros 3,5 s no bastan. Usa `ESPERA_VISTA=10000`.
- `celshadeViewer.pickAt(x, y)` (x, y de 0 a 1 en el lienzo) dice qué objetos hay bajo ese punto:
  sirve para saber qué es una mancha rara en una captura.
- Las texturas incluidas solo se descargan si el script las nombra (`mat.color_map = "id"`), así
  que añadir texturas a `textureLibrary.ts` no frena los demás modelos.
- Todos los GLB exportados llevan como nodo raíz "Golem_Enemigo_LowPoly" (herencia del modelo de
  demostración). No cambia nada visual; pendiente de arreglar si el usuario lo pide.

## 5. GLB importados, optimización y monstruos

- El botón "GLB Ligero" de la app reconstruye el modelo y **pierde esqueletos y animaciones**.
  Para monstruos o personajes animados usa el panel "Optimizar GLB por zonas", que solo reescribe
  lo que cambia del archivo original.
- Reducción de triángulos: el optimizador usa meshoptimizer con un mismo error máximo para todo
  el modelo (búsqueda binaria). Con un porcentaje igual por pieza, los cuernos del dragón se
  aplanaban hasta desaparecer.
- Para monstruos de Enemigo-rpg, mejor usar su calidad propia (Low ~15 k triángulos) que reducir
  la High al 25 %: Low quita los mechones de pelo sueltos y la textura de pelaje hace el resto.
- El validador oficial (`npx gltf-transform validate`) marca `EXT_materials_bump` como extensión
  no soportada y los colores de vértice > 1 de Enemigo-rpg: vienen del original, no son errores
  nuevos.
- Los 282 monstruos se generan sin errores: Low 46 s y 333 MB en total; Medium 70 s y 558 MB.

## 6. Modelos de referencia en el repo

Mira el script más parecido antes de empezar uno nuevo:

| Carpeta | Qué enseña |
|---|---|
| `cafe/` | Objeto pequeño a escala 1 = 10 cm, cristal con Alpha, líquido por capas, colores lineales |
| `muelle_tinto/` | Estructura larga con trazado curvo `punto(s)`, celosías con diagonales, muchas piezas repetidas, datos del BOJA |
| `ermita_montemayor/` | Edificio a partir de fotos del usuario, tejado a dos aguas, torre octogonal |
| `plaza_espana/` | Conjunto grande semicircular, arcos con cajas escalonadas, solo giros en Z |
| `ayuntamiento/` | Fachada con texturas CC0 (`mat.color_map`) y optimización del GLB |
| `puestos/` | Props ligeros de estilo Lineage 2 (pocos lados, materiales compartidos) |
| `orco/` | Personaje con manos, pies y armadura hecho con primitivas |
| `pasarela_moguer/` | Pasarela de celosía tubular a partir de fotos del usuario: función `tubo(a, b)` para tubos redondos en cualquier dirección, escaleras, rampas en zigzag con barandillas y rótulo de letras por trazos |
| `bernabeu/` | Estadio de 72 k triángulos con mallas propias (`from_pydata`): gradas escalonadas, cubierta, fachada de lamas; texturas CC0 de ambientCG y Poly Haven descargadas y preparadas con un script |
