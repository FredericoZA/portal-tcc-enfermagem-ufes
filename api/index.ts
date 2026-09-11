import type{Request,Response}from'express';
import{createPortalApp}from'../server';

const appPromise=createPortalApp();
export default async function handler(req:Request,res:Response){
  const app=await appPromise;
  return app(req,res);
}
