import type { MyContext } from './types';

export type BoolHandler = (ctx: MyContext) => Promise<boolean>;
export type VoidHandler = (ctx: MyContext) => Promise<void>;

export const textHandlers: BoolHandler[] = [];
export const mediaHandlers: BoolHandler[] = []; // photo/document
export const locationHandlers: BoolHandler[] = [];
export const messageEditHandlers: BoolHandler[] = [];
