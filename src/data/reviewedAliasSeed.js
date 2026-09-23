import sourceRows from './aliases.json';
import overrides from './reviewed-alias-overrides.json';
import { applyReviewedAliases } from '../domain/search/applyReviewedAliases.js';

export default applyReviewedAliases(sourceRows, overrides);
