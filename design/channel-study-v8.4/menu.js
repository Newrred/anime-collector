document.addEventListener('click',event=>{for(const menu of document.querySelectorAll('.shelf-menu[open]'))if(!menu.contains(event.target))menu.open=false;});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){const menu=document.querySelector('.shelf-menu[open]');if(menu){menu.open=false;menu.querySelector('summary').focus();event.preventDefault();}}});
