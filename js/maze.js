// Labyrinthe déterministe : un seul réseau connecté, aucun canard dans une zone isolée.
export function createMazeLayout(cells=7,seed=0xdac6,spacing=1.9) {
  let randomState=seed>>>0;
  const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
  const size=cells*2+1;
  const grid=Array.from({length:size},()=>Array(size).fill(1));
  const start={x:1,z:size-2};
  const stack=[start];
  grid[start.z][start.x]=0;
  const directions=[[0,-2],[2,0],[0,2],[-2,0]];
  while(stack.length) {
    const cell=stack[stack.length-1];
    const options=directions.filter(([dx,dz])=>{
      const x=cell.x+dx,z=cell.z+dz;
      return x>0 && x<size-1 && z>0 && z<size-1 && grid[z][x]===1;
    });
    if(!options.length){stack.pop();continue;}
    const [dx,dz]=stack.length===1 && grid[size-3][1]===1?[0,-2]:options[Math.floor(random()*options.length)];
    grid[cell.z+dz/2][cell.x+dx/2]=0;
    grid[cell.z+dz][cell.x+dx]=0;
    stack.push({x:cell.x+dx,z:cell.z+dz});
  }
  const neighbors=cell=>[[0,-1],[1,0],[0,1],[-1,0]].map(([dx,dz])=>({x:cell.x+dx,z:cell.z+dz})).filter(c=>grid[c.z]?.[c.x]===0);
  const key=c=>`${c.x},${c.z}`;
  const distancesFrom=origin=>{
    const distances=new Map([[key(origin),0]]),queue=[origin];
    for(let i=0;i<queue.length;i++)for(const next of neighbors(queue[i])) {
      if(!distances.has(key(next))){distances.set(key(next),distances.get(key(queue[i]))+1);queue.push(next);}
    }
    return distances;
  };
  const distances=distancesFrom(start),deadEnds=[];
  for(let z=1;z<size-1;z++)for(let x=1;x<size-1;x++) {
    const cell={x,z};
    if(grid[z][x]===0 && key(cell)!==key(start) && neighbors(cell).length===1)deadEnds.push(cell);
  }
  // Répartir les cinq cachettes entre des branches éloignées, pas dans un seul coin.
  const selected=[],chosenDistances=[];
  const candidates=deadEnds.length>=5?deadEnds:[...deadEnds,...Array.from(distances.keys()).map(k=>{const [x,z]=k.split(',').map(Number);return{x,z};}).filter(c=>c.x%2 && c.z%2 && key(c)!==key(start))];
  while(selected.length<5) {
    const remaining=candidates.filter(c=>!selected.some(s=>key(s)===key(c)));
    if(!remaining.length)throw new Error('Labyrinthe trop petit pour cinq cachettes.');
    remaining.sort((a,b)=>{
      const score=c=>distances.get(key(c))*.6+(chosenDistances.length?Math.min(...chosenDistances.map(d=>d.get(key(c))))*.9:0);
      return score(b)-score(a) || a.z-b.z || a.x-b.x;
    });
    selected.push(remaining[0]);chosenDistances.push(distancesFrom(remaining[0]));
  }
  const toWorld=cell=>({x:(cell.x-(size-1)/2)*spacing,z:(cell.z-(size-1)/2)*spacing});
  const duckCells=selected.map(cell=>{
    const inward=neighbors(cell)[0];
    return {...cell,world:toWorld(cell),inward:{x:inward.x-cell.x,z:inward.z-cell.z},distance:distances.get(key(cell))};
  });
  return {grid,size,spacing,start,spawn:toWorld(start),duckCells,toWorld,deadEnds:deadEnds.length,reachable:distances.size};
}

export const MAZE_LAYOUT=createMazeLayout();
