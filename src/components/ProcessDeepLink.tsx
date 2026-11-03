import {useEffect} from 'react';
import {useAuth} from '../context/AuthContext';
import {readProcessLink} from '../utils/processLink';
/** Preserve the destination during login. The API still checks process access. */
export function ProcessDeepLink(){
 const {isLoading,isAuthenticated}=useAuth();
 useEffect(()=>{
  if(isLoading)return;
  const open=()=>{
   const link=readProcessLink(window.location.search);
   window.dispatchEvent(new CustomEvent('portal:open-process',{detail:link?{...link,readOnly:true}:null}));
  };
  open();window.addEventListener('popstate',open);return()=>window.removeEventListener('popstate',open);
 },[isLoading,isAuthenticated]);
 return null;
}
