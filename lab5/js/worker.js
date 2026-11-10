import {benchmark} from './benchmark.js';
onmessage=()=>{try{postMessage({result:benchmark(p=>postMessage({progress:p}))});}catch(e){postMessage({error:e.message});}};
