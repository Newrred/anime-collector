import {readFile,writeFile} from 'node:fs/promises';
let html=await readFile('design/prototypes/film-archive/moemoa-film-grid.html','utf8');
html=html.replace('<head>','<head><base href="../prototypes/film-archive/">');
html=html.replace('</head>',`<style>
/* V8.1: preserve stable geometry; add local interaction feedback. */
.grid-prototype{--muted:#686862}
.grid-prototype .button:focus-visible,.grid-prototype button:focus-visible{outline:2px solid #315dce;outline-offset:3px}
.grid-prototype .button{transition:background-color 120ms,color 120ms,transform 80ms}
.grid-prototype .button:active:not(:disabled){transform:translateY(1px)}
.grid-prototype .shelf-cover[aria-expanded=true]{outline:2px solid #315dce;outline-offset:3px}
.grid-prototype .shelf-caption .desk-meta{color:#686862;font-size:12px}
.grid-prototype .shelf-cover .desk-pull-label{font-size:11px;display:flex;gap:5px;align-items:center}
.grid-prototype .shelf-cover:not([aria-expanded=true]) .desk-pull-label:after{content:'';width:14px;height:14px;background:url('../../ui-kit-v8.1/png/chevron-down-ink-48.png') center/contain no-repeat}
.grid-prototype .header-actions .primary img{width:20px;height:20px}
.grid-prototype .shelf-tabs .button{font-size:12px}
@media(prefers-reduced-motion:reduce){.grid-prototype *{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
</style></head>`);
html=html.replace('시안 08','시안 08.1').replace('<span aria-hidden="true">＋</span>','<img src="../../ui-kit-v8.1/png/plus-inverse-48.png" alt="">');
html=html.replace('전후 비교 ↗','V7/V8 비교 ↗');
await writeFile('design/ui-kit-v8.1/v8-refined.html',html);
