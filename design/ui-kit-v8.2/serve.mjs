import { createDesignPrototypeServer } from '../../scripts/serve-design-prototypes.mjs';
import { fileURLToPath } from 'node:url';
const server=await createDesignPrototypeServer({root:fileURLToPath(new URL('../',import.meta.url))});
server.listen(4351,'127.0.0.1',()=>console.log('http://127.0.0.1:4351/ui-kit-v8.2/index.html'));
