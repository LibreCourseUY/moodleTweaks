# Modo oscuro: gotchas del tema `fing`

El modo oscuro vive en `src/content/css/dark.css`. El CSS de la extensión se
inyecta en `document_start`, **antes** de la hoja del tema
(`/theme/styles.php/fing/...`), así que ante selectores de igual especificidad
**gana el tema**. Eso, sumado al markup autogenerado por los editores de Moodle
(inline styles incluidos), produce un puñado de trampas que ya nos mordieron y
quedan documentadas acá.

## 1. Selector más específico o `!important` cuando haya empate

Cualquier override cuyo selector empate la especificidad del tema se pierde
silenciosamente, por el orden de carga. Ejemplo real: el theme de syntax
highlighting deja `pre[class*="language-"]{background:#f5f2f0;color:#000}` con
especificidad `(0,1,1)`; escribir `html.moodle-tweaks-dark pre` (también
`(0,1,1)`) no hacía nada y los bloques de código quedaban beige.

```css
/* Falla: debe ganar el tema por ser cargado después */
html.moodle-tweaks-dark pre { background-color: #000; }
```

```css
/* Bien: sube la especificidad por encima del empate */
html.moodle-tweaks-dark pre,
html.moodle-tweaks-dark pre[class*="language-"] {
  background-color: #000 !important;
}
```

Regla: **antes de escribir un override, revisá la complejidad del selector del
tema** que querés pisar.

## 2. Backgrounds inline: también hay que matar `background-image`

Los autores suelen pintar cajas con `background: linear-gradient(...)` o
`background: url(...)`. Atacar solo `background-color` no alcanza: el gradiente
o la imagen quedan *encima* del color oscuro y la mezcla clara se camufla con
texto claro. Hay que neutralizar ambos:

```css
#region-main [style*="background:"] {
  background-color: var(--moodle-tweaks-surface-alt) !important;
  background-image: none !important;
}
```

Sin el `background-image: none`, este fue el bug del banner del curso "PIm".

## 3. Simetría para `color:` inline

Los `color:` escritos inline por el autor (accent de asignatura, etc.) se
aplanan a texto neutro, porque la alternativa —respeta el color del autor sobre
una superficie oscura— suele quedar ilegible. Se matchean con
`[style*=" color:"]`/`[style^="color:"]` y los links internos pasan a la marca.
Se pierden los acentos del autor (los bordes coloreados sobreviven).

## 4. Blancos translúcidos anidados re-iluminan cajas

El tema usa fondos translúcidos blancos (`#fffb`, `background: #fff` con alpha)
en contenedores anidados. Al oscurecer el contenedor padre, estos fondos
translúcidos siguen "rellenando" de luz cada nivel, así que la caja vuelve a
verse clara aunque el padre esté oscuro.

Ejemplos conocidos que requirieron override explícito:

```css
.format-onetopic .onetopic-withsectionbg .course-section,
div[role="main"] {
  /* fondos #fffb del tema, re-iluminan sobre nuestro oscuro */
  background-color: var(--moodle-tweaks-surface-alt);
}
```

## 5. El borde universal: todas las reglas `:not()` en UNA línea

Para forzar bordes oscuros sin dejar bordes claros desperdigados existe una
regla universal en `dark.css`:

```css
html.moodle-tweaks-dark *:where(:not(.btn):not(.nav-link):...):not(.form-control) {
  border-color: var(--moodle-tweaks-border) !important;
}
```

Dos cosas que no hacer:

- **No poner un salto de línea entre los `:not()`.** Dentro de `:where()`, un
  espacio o newline crea un combinador descendente: el selector pasa a significar
  "descendiente de `.not(...)`", y la exclusión queda neutra. Todo el encadenado
  tiene que vivir en la misma línea.
- La regla pisa también bordes inline del autor (accent izquierdo coloreado,
  por ejemplo). Es el comportamiento buscado: uniformidad.

## 6. Variantes dim / amoled

Se implementan como clases adicionales sobre `moodle-tweaks-dark`
(`moodle-tweaks-dark-dim`, `moodle-tweaks-dark-amoled`) y solo sustituyen las
superficies/brillos de la variante `default`. El grueso de los overrides oscuros
pertenece a `moodle-tweaks-dark` y es compartido.

## Checklist antes de mergear un cambio de dark mode

1. Probar el Tema "fing" real (no solo una página local) y validar que el
   override gane el empate de especificidad.
2. Cajas con inline styles: ¿hay gradiente/imagen atrás?
3. ¿Algún contenedor anidado podría estar re-iluminando con un blanco
   translúcido?
4. Si tocaste la regla de bordes, que el encadenado `:not()` siga en una línea.