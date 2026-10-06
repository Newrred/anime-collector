import {readFile,writeFile} from 'node:fs/promises';
let html=await readFile('design/prototypes/film-archive/moemoa-film-grid.html','utf8');
html=html.replace('<head>','<head><base href="../prototypes/film-archive/">');
html=html.replace('</head>',`<style>
/* V8.2: preserve stable geometry; add local interaction feedback. */
.grid-prototype{--muted:#686862}
.grid-prototype .button:focus-visible,.grid-prototype button:focus-visible{outline:2px solid #e60068;outline-offset:3px}
.grid-prototype .button{transition:background-color 120ms,color 120ms,transform 80ms}
.grid-prototype .button:active:not(:disabled){transform:translateY(1px)}
.grid-prototype .shelf-cover[aria-expanded=true]{outline:2px solid #e60068;outline-offset:3px}
.grid-prototype .shelf-caption .desk-meta{color:#686862;font-size:12px}
.grid-prototype .shelf-cover .desk-pull-label{font-size:11px;display:flex;gap:5px;align-items:center}
.grid-prototype .shelf-cover:not([aria-expanded=true]) .desk-pull-label:after{content:'';width:14px;height:14px;background:url('../../ui-kit-v8.2/png/chevron-down-ink-48.png') center/contain no-repeat}
.grid-prototype .header-actions .primary img{width:20px;height:20px}
.grid-prototype .shelf-tabs .button{font-size:12px}
@media(prefers-reduced-motion:reduce){.grid-prototype *{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
.grid-prototype .header-actions .primary{position:relative;background:#e60068;border-color:#e60068;color:#fff;border-radius:7px;box-shadow:0 3px 0 #a8004c;gap:22px;padding-inline:12px 16px;font-weight:600}
.grid-prototype .header-actions .primary:before{content:'';position:absolute;left:43px;top:9px;bottom:9px;border-left:1px dashed #ffffff80}
.grid-prototype .header-actions .primary:hover{background:#d0005e}
.grid-prototype .header-actions .primary:active{box-shadow:none;transform:translateY(2px)}
.grid-prototype .shelf-tabs .button[aria-pressed=true]{color:#c40059}
.grid-prototype .shelf-tabs .button[aria-pressed=true]:after{background:#e60068;height:2px}
.grid-prototype .shelf-cover[aria-expanded=true] .desk-pull-label{background:#e60068;color:white}
.grid-prototype .shelf-cover .desk-pull-label{border-radius:3px}
.grid-prototype .shelf-film-panel .desk-drawer-footer .button{border-radius:5px}
.grid-prototype .shelf-film-panel .desk-drawer-footer .button:hover{background:#fff0f6;color:#c40059}
@media(prefers-reduced-motion:reduce){.grid-prototype .button:active{transform:none}}
</style><link rel="stylesheet" href="../../ui-kit-v8.2/line-film.css"></head>`);
html=html.replace('시안 08','시안 08.2').replace('<span aria-hidden="true">＋</span>','<img src="../../ui-kit-v8.2/png/plus-inverse-48.png" alt="">');
html=html.replace('전후 비교 ↗','V7/V8 비교 ↗');
await writeFile('design/ui-kit-v8.2/v8-refined.html',html);
