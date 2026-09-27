import {defineCollection,z} from 'astro:content';
import {glob} from 'astro/loaders';
const products=defineCollection({loader:glob({pattern:'**/*.md',base:'./src/content/products'}),schema:z.object({title:z.string(),description:z.string(),category:z.string(),checks:z.array(z.string())})});
const knowledge=defineCollection({loader:glob({pattern:'**/*.md',base:'./src/content/knowledge'}),schema:z.object({title:z.string(),description:z.string(),tag:z.string()})});
export const collections={products,knowledge};
