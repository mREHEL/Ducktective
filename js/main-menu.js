// Présentation du menu uniquement : les niveaux et la partie restent dans game.js.
const dossiers = [
  {theme:'salon',name:'Le salon',detail:'Coussins & petits secrets',difficulty:'Observation',marks:1},
  {theme:'atelier',name:'L’atelier',detail:'Une manivelle, un mystère',difficulty:'Fouille',marks:2},
  {theme:'serre',name:'La serre',detail:'Sous les feuilles, la nuit',difficulty:'Discrétion',marks:2},
  {theme:'grenier',name:'Le grenier',detail:'Souvenirs sous la poussière',difficulty:'Fouille',marks:3},
  {theme:'bibliotheque',name:'La bibliothèque',detail:'Les livres gardent un secret',difficulty:'Déduction',marks:3},
  {theme:'labyrinthe',name:'Le labyrinthe',detail:'Des impasses et un levier',difficulty:'Orientation',marks:4}
];
const icons={
  salon:'<path d="M5 13V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5M5 11H3v7h18v-7h-2M5 15h14M6 18v2m12-2v2"/>',
  atelier:'<path d="m5 4 15 15-2 2L3 6l2-2Zm9 0a5 5 0 0 0-4 7L4 17a2 2 0 0 0 3 3l6-6a5 5 0 0 0 7-5l-3 2-3-3 2-4h-2Z"/>',
  serre:'<path d="M12 21V9m0 6C5 16 3 12 3 7c5 0 9 2 9 8Zm0-3c0-6 4-9 9-9 0 5-3 9-9 9Z"/>',
  grenier:'<path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7M8 8h8"/>',
  bibliotheque:'<path d="M3 4h4v16H3V4Zm6 2h4v14H9V6Zm6-1 4-1 3 15-4 1-3-15ZM3 16h4m2 0h4"/>',
  labyrinthe:'<path d="M10 3H3v18h18V3h-7v6H7v6h7v6M21 9h-4v6h4M3 9h4M10 3v2"/>'
};

export function createMainMenu(levels,onSelect) {
  const container=document.getElementById('levelCards');
  const cards=levels.map((level,index)=>{
    const data=dossiers[index],card=document.createElement('button');
    card.type='button';card.className=`dossier-card theme-${data.theme}`;
    card.dataset.level=String(index);card.setAttribute('aria-label',`Niveau ${index+1} : ${level.name}`);
    const icon=`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${icons[data.theme]}</svg>`;
    card.innerHTML=`<span class="dossier-top"><span class="dossier-icon" aria-hidden="true">${icon}</span><span class="dossier-number">DOSSIER ${String(index+1).padStart(2,'0')}</span><span class="dossier-check" aria-hidden="true">✓</span></span><span class="dossier-name">${data.name}</span><span class="dossier-detail">${data.detail}</span><span class="dossier-bottom"><span>${data.difficulty}</span><span class="dossier-marks" aria-hidden="true">${'<i></i>'.repeat(data.marks)}</span></span>`;
    card.addEventListener('click',()=>onSelect(index));container.append(card);return card;
  });
  return {
    selectLevel(index) {
      cards.forEach((card,i)=>{card.classList.toggle('selected',i===index);card.setAttribute('aria-pressed',String(i===index));});
      document.getElementById('startButton').setAttribute('aria-label',`Ouvrir le dossier : ${levels[index].name}`);
    }
  };
}
